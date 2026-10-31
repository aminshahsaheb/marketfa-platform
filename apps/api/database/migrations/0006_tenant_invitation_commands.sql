-- Atomic invitation create, revoke, and accept commands.
-- Raw invitation tokens are generated and returned only by the API; PostgreSQL
-- stores a SHA-256 token hash.
GRANT SELECT ON auth_identities TO marketfa_tenant_admin_owner;
GRANT SELECT, INSERT ON tenant_invitations TO marketfa_tenant_admin_owner;
GRANT UPDATE ON tenant_invitations TO marketfa_tenant_admin_owner;
GRANT INSERT ON tenant_memberships TO marketfa_tenant_admin_owner;
GRANT INSERT ON audit_events TO marketfa_tenant_admin_owner;

CREATE POLICY tenant_admin_owner_membership_read ON tenant_memberships
  FOR SELECT TO marketfa_tenant_admin_owner
  USING (tenant_id = app_current_tenant_id());

CREATE POLICY tenant_admin_owner_membership_insert ON tenant_memberships
  FOR INSERT TO marketfa_tenant_admin_owner
  WITH CHECK (tenant_id = app_current_tenant_id());

CREATE POLICY tenant_admin_owner_invitation_read ON tenant_invitations
  FOR SELECT TO marketfa_tenant_admin_owner
  USING (tenant_id = app_current_tenant_id());

-- The acceptance command must locate an invitation by its hash before it
-- knows the tenant. The hash is high entropy and only the command owner can
-- use this policy; the ordinary runtime role has no direct table privileges.
CREATE POLICY tenant_admin_owner_invitation_lookup ON tenant_invitations
  FOR SELECT TO marketfa_tenant_admin_owner
  USING (true);

CREATE UNIQUE INDEX tenant_invitations_one_pending_identifier_uq
  ON tenant_invitations (tenant_id, intended_identifier)
  WHERE status = 'PENDING';

CREATE POLICY tenant_admin_owner_invitation_insert ON tenant_invitations
  FOR INSERT TO marketfa_tenant_admin_owner
  WITH CHECK (tenant_id = app_current_tenant_id());

CREATE POLICY tenant_admin_owner_invitation_update ON tenant_invitations
  FOR UPDATE TO marketfa_tenant_admin_owner
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

-- Acceptance must lock a token-hash match before it knows the tenant context.
-- This broad policy is only for the non-login command owner; the function
-- validates the token, status, identity, and tenant before each state change.
CREATE POLICY tenant_admin_owner_invitation_command_update ON tenant_invitations
  FOR UPDATE TO marketfa_tenant_admin_owner
  USING (true)
  WITH CHECK (true);

CREATE POLICY tenant_admin_owner_identity_read ON auth_identities
  FOR SELECT TO marketfa_tenant_admin_owner
  USING (user_id = app_current_user_id());

CREATE POLICY tenant_admin_owner_audit_insert ON audit_events
  FOR INSERT TO marketfa_tenant_admin_owner
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND (actor_user_id IS NULL OR actor_user_id = app_current_user_id())
  );

CREATE OR REPLACE FUNCTION tenant_invitation_create(
  p_tenant_id UUID,
  p_token_hash BYTEA,
  p_intended_identifier TEXT,
  p_role tenant_role,
  p_ttl_seconds INTEGER DEFAULT 604800
)
RETURNS TABLE(invitation_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  actor_id UUID;
  inviter_role tenant_role;
  new_invitation_id UUID;
  new_expires_at TIMESTAMPTZ;
  normalized_invitee_identifier TEXT;
BEGIN
  actor_id := public.app_current_user_id();
  normalized_invitee_identifier := lower(btrim(p_intended_identifier));

  IF actor_id IS NULL
     OR p_tenant_id IS NULL
     OR p_token_hash IS NULL
     OR octet_length(p_token_hash) <> 32
     OR normalized_invitee_identifier IS NULL
     OR length(normalized_invitee_identifier) NOT BETWEEN 3 AND 320
     OR p_role IS NULL
     OR p_role NOT IN ('MANAGER', 'CASHIER', 'ACCOUNTANT', 'VIEWER')
     OR p_ttl_seconds IS NULL
     OR p_ttl_seconds < 3600
     OR p_ttl_seconds > 2592000 THEN
    RAISE EXCEPTION 'Invalid invitation input'
      USING ERRCODE = '22023';
  END IF;

  IF public.app_current_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant context mismatch'
      USING ERRCODE = '42501';
  END IF;

  -- Serialize invitation creation for this tenant without granting UPDATE
  -- privileges on membership or tenant tables to the command owner.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::TEXT, 0)
  );

  SELECT membership.role
  INTO inviter_role
  FROM public.tenant_memberships AS membership
  JOIN public.users AS account ON account.id = membership.user_id
  JOIN public.tenants AS tenant ON tenant.id = membership.tenant_id
  WHERE membership.tenant_id = p_tenant_id
    AND membership.user_id = actor_id
    AND membership.status = 'ACTIVE'
    AND account.status = 'ACTIVE'
    AND tenant.status = 'ACTIVE';

  IF NOT FOUND OR inviter_role <> 'OWNER' THEN
    RAISE EXCEPTION 'Invitation permission denied'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.auth_identities AS identity
    JOIN public.tenant_memberships AS membership
      ON membership.user_id = identity.user_id
    WHERE membership.tenant_id = p_tenant_id
      AND membership.status IN ('INVITED', 'ACTIVE')
      AND identity.verified_at IS NOT NULL
      AND lower(identity.normalized_identifier) = normalized_invitee_identifier
  ) THEN
    RAISE EXCEPTION 'Identity already has a tenant membership'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.tenant_invitations AS invitation
  SET status = 'EXPIRED'
  WHERE invitation.tenant_id = p_tenant_id
    AND invitation.status = 'PENDING'
    AND invitation.expires_at <= statement_timestamp();

  IF EXISTS (
    SELECT 1
    FROM public.tenant_invitations AS invitation
    WHERE invitation.tenant_id = p_tenant_id
      AND invitation.intended_identifier = normalized_invitee_identifier
      AND invitation.status = 'PENDING'
  ) THEN
    RAISE EXCEPTION 'A pending invitation already exists'
      USING ERRCODE = '23505';
  END IF;

  new_expires_at := statement_timestamp() + make_interval(secs => p_ttl_seconds);

  INSERT INTO public.tenant_invitations (
    tenant_id,
    token_hash,
    intended_identifier,
    role,
    status,
    invited_by_user_id,
    expires_at
  )
  VALUES (
    p_tenant_id,
    p_token_hash,
    normalized_invitee_identifier,
    p_role,
    'PENDING',
    actor_id,
    new_expires_at
  )
  RETURNING id INTO new_invitation_id;

  INSERT INTO public.audit_events (
    tenant_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    p_tenant_id,
    actor_id,
    'tenant.invitation.create',
    'tenant_invitation',
    new_invitation_id,
    jsonb_build_object('role', p_role, 'expires_at', new_expires_at)
  );

  RETURN QUERY SELECT new_invitation_id, new_expires_at;
END;
$function$;

CREATE OR REPLACE FUNCTION tenant_invitation_revoke(
  p_tenant_id UUID,
  p_invitation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  actor_id UUID;
  inviter_role tenant_role;
  invitation_row public.tenant_invitations%ROWTYPE;
BEGIN
  actor_id := public.app_current_user_id();
  IF actor_id IS NULL
     OR p_tenant_id IS NULL
     OR p_invitation_id IS NULL
     OR public.app_current_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Invalid invitation revoke context'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::TEXT, 0)
  );

  SELECT membership.role
  INTO inviter_role
  FROM public.tenant_memberships AS membership
  JOIN public.users AS account ON account.id = membership.user_id
  JOIN public.tenants AS tenant ON tenant.id = membership.tenant_id
  WHERE membership.tenant_id = p_tenant_id
    AND membership.user_id = actor_id
    AND membership.status = 'ACTIVE'
    AND account.status = 'ACTIVE'
    AND tenant.status = 'ACTIVE';

  IF NOT FOUND OR inviter_role <> 'OWNER' THEN
    RAISE EXCEPTION 'Invitation permission denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT invitation.*
  INTO invitation_row
  FROM public.tenant_invitations AS invitation
  WHERE invitation.tenant_id = p_tenant_id
    AND invitation.id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND OR invitation_row.status <> 'PENDING'
     OR invitation_row.expires_at <= statement_timestamp() THEN
    RETURN false;
  END IF;

  UPDATE public.tenant_invitations
  SET status = 'REVOKED'
  WHERE id = invitation_row.id;

  INSERT INTO public.audit_events (
    tenant_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    p_tenant_id, actor_id, 'tenant.invitation.revoke',
    'tenant_invitation', invitation_row.id,
    jsonb_build_object('role', invitation_row.role)
  );

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION tenant_invitation_accept(p_token_hash BYTEA)
RETURNS TABLE(tenant_id UUID, membership_id UUID, role tenant_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  actor_id UUID;
  invitation_row public.tenant_invitations%ROWTYPE;
  new_membership_id UUID;
BEGIN
  actor_id := public.app_current_user_id();
  IF actor_id IS NULL OR p_token_hash IS NULL OR octet_length(p_token_hash) <> 32 THEN
    RETURN;
  END IF;

  SELECT invitation.*
  INTO invitation_row
  FROM public.tenant_invitations AS invitation
  WHERE invitation.token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND
     OR invitation_row.status <> 'PENDING'
     OR invitation_row.expires_at <= statement_timestamp() THEN
    RETURN;
  END IF;

  -- Resolve tenant context from the locked invitation before RLS-protected
  -- identity and tenant checks. The API transaction rolls this setting back.
  PERFORM set_config(
    'app.current_tenant_id',
    invitation_row.tenant_id::TEXT,
    true
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS account
    JOIN public.auth_identities AS identity ON identity.user_id = account.id
    WHERE account.id = actor_id
      AND account.status = 'ACTIVE'
      AND identity.verified_at IS NOT NULL
      AND lower(identity.normalized_identifier) = invitation_row.intended_identifier
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.tenants AS tenant
    WHERE tenant.id = invitation_row.tenant_id
      AND tenant.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Invitation identity does not match a verified identity'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tenant_memberships AS membership
    WHERE membership.tenant_id = invitation_row.tenant_id
      AND membership.user_id = actor_id
  ) THEN
    RAISE EXCEPTION 'User already has a membership in this tenant'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.tenant_memberships (
    tenant_id, user_id, role, status, invited_by_user_id
  )
  VALUES (
    invitation_row.tenant_id, actor_id, invitation_row.role, 'ACTIVE',
    invitation_row.invited_by_user_id
  )
  RETURNING id INTO new_membership_id;

  UPDATE public.tenant_invitations
  SET status = 'ACCEPTED',
      accepted_by_user_id = actor_id,
      accepted_at = statement_timestamp()
  WHERE id = invitation_row.id;

  INSERT INTO public.audit_events (
    tenant_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    invitation_row.tenant_id, actor_id, 'tenant.invitation.accept',
    'tenant_invitation', invitation_row.id,
    jsonb_build_object('membership_id', new_membership_id,
                       'role', invitation_row.role)
  );

  RETURN QUERY
  SELECT invitation_row.tenant_id, new_membership_id, invitation_row.role;
END;
$function$;

GRANT CREATE ON SCHEMA public TO marketfa_tenant_admin_owner;
ALTER FUNCTION tenant_invitation_create(UUID, BYTEA, TEXT, tenant_role, INTEGER)
  OWNER TO marketfa_tenant_admin_owner;
ALTER FUNCTION tenant_invitation_revoke(UUID, UUID)
  OWNER TO marketfa_tenant_admin_owner;
ALTER FUNCTION tenant_invitation_accept(BYTEA)
  OWNER TO marketfa_tenant_admin_owner;
REVOKE CREATE ON SCHEMA public FROM marketfa_tenant_admin_owner;

REVOKE ALL ON FUNCTION tenant_invitation_create(UUID, BYTEA, TEXT, tenant_role, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION tenant_invitation_revoke(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION tenant_invitation_accept(BYTEA) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenant_invitation_create(UUID, BYTEA, TEXT, tenant_role, INTEGER) TO marketfa_app;
GRANT EXECUTE ON FUNCTION tenant_invitation_revoke(UUID, UUID) TO marketfa_app;
GRANT EXECUTE ON FUNCTION tenant_invitation_accept(BYTEA) TO marketfa_app;
