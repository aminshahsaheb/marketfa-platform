-- Atomic membership role, suspension, and removal commands.
-- All tenant administration commands use the same transaction-scoped advisory
-- lock so last-owner checks serialize with other membership changes/invitations.
GRANT SELECT, UPDATE ON tenant_memberships TO marketfa_tenant_admin_owner;

CREATE POLICY tenant_admin_owner_membership_update ON tenant_memberships
  FOR UPDATE TO marketfa_tenant_admin_owner
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

CREATE POLICY tenant_admin_owner_identity_tenant_read ON auth_identities
  FOR SELECT TO marketfa_tenant_admin_owner
  USING (
    user_id = app_current_user_id()
    OR EXISTS (
      SELECT 1
      FROM public.tenant_memberships AS membership
      WHERE membership.user_id = auth_identities.user_id
        AND membership.tenant_id = app_current_tenant_id()
    )
  );

-- A removed or suspended user cannot receive a new ordinary invitation.
-- Keep this check in the command boundary, not only in the HTTP service.
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

CREATE OR REPLACE FUNCTION tenant_membership_change_role(
  p_tenant_id UUID,
  p_membership_id UUID,
  p_new_role tenant_role
)
RETURNS TABLE(
  membership_id UUID,
  user_id UUID,
  role tenant_role,
  status membership_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  actor_id UUID;
  actor_role tenant_role;
  target public.tenant_memberships%ROWTYPE;
  old_role tenant_role;
BEGIN
  actor_id := public.app_current_user_id();

  IF actor_id IS NULL
     OR p_tenant_id IS NULL
     OR p_membership_id IS NULL
     OR p_new_role IS NULL
     OR p_new_role NOT IN ('MANAGER', 'CASHIER', 'ACCOUNTANT', 'VIEWER')
     OR public.app_current_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Invalid membership role-change input'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::TEXT, 0)
  );

  SELECT membership.role
  INTO actor_role
  FROM public.tenant_memberships AS membership
  JOIN public.users AS account ON account.id = membership.user_id
  JOIN public.tenants AS tenant ON tenant.id = membership.tenant_id
  WHERE membership.tenant_id = p_tenant_id
    AND membership.user_id = actor_id
    AND membership.status = 'ACTIVE'
    AND account.status = 'ACTIVE'
    AND tenant.status = 'ACTIVE';

  IF NOT FOUND OR actor_role <> 'OWNER' THEN
    RAISE EXCEPTION 'Membership administration permission denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT membership.*
  INTO target
  FROM public.tenant_memberships AS membership
  WHERE membership.tenant_id = p_tenant_id
    AND membership.id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND OR target.status NOT IN ('ACTIVE', 'SUSPENDED', 'INVITED') THEN
    RETURN;
  END IF;

  IF target.role = 'OWNER' THEN
    RAISE EXCEPTION 'Owner role changes require the ownership-transfer workflow'
      USING ERRCODE = '42501';
  END IF;

  old_role := target.role;
  IF old_role = p_new_role THEN
    membership_id := target.id;
    user_id := target.user_id;
    role := target.role;
    status := target.status;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.tenant_memberships AS membership
  SET role = p_new_role,
      updated_at = statement_timestamp()
  WHERE membership.tenant_id = p_tenant_id
    AND membership.id = p_membership_id
  RETURNING membership.id, membership.user_id, membership.role, membership.status
  INTO membership_id, user_id, role, status;

  INSERT INTO public.audit_events (
    tenant_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    p_tenant_id, actor_id, 'tenant.membership.role_change',
    'tenant_membership', membership_id,
    jsonb_build_object('user_id', user_id, 'old_role', old_role, 'new_role', role)
  );

  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION tenant_membership_suspend(
  p_tenant_id UUID,
  p_membership_id UUID
)
RETURNS TABLE(
  membership_id UUID,
  user_id UUID,
  role tenant_role,
  status membership_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  actor_id UUID;
  actor_role tenant_role;
  target public.tenant_memberships%ROWTYPE;
  other_active_owners INTEGER;
BEGIN
  actor_id := public.app_current_user_id();

  IF actor_id IS NULL
     OR p_tenant_id IS NULL
     OR p_membership_id IS NULL
     OR public.app_current_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Invalid membership suspension context'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::TEXT, 0)
  );

  SELECT membership.role
  INTO actor_role
  FROM public.tenant_memberships AS membership
  JOIN public.users AS account ON account.id = membership.user_id
  JOIN public.tenants AS tenant ON tenant.id = membership.tenant_id
  WHERE membership.tenant_id = p_tenant_id
    AND membership.user_id = actor_id
    AND membership.status = 'ACTIVE'
    AND account.status = 'ACTIVE'
    AND tenant.status = 'ACTIVE';

  IF NOT FOUND OR actor_role <> 'OWNER' THEN
    RAISE EXCEPTION 'Membership administration permission denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT membership.*
  INTO target
  FROM public.tenant_memberships AS membership
  WHERE membership.tenant_id = p_tenant_id
    AND membership.id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND OR target.status <> 'ACTIVE' THEN
    RETURN;
  END IF;

  IF target.role = 'OWNER' THEN
    SELECT count(*)
    INTO other_active_owners
    FROM public.tenant_memberships AS membership
    WHERE membership.tenant_id = p_tenant_id
      AND membership.role = 'OWNER'
      AND membership.status = 'ACTIVE'
      AND membership.id <> target.id;

    IF other_active_owners < 1 THEN
      RAISE EXCEPTION 'Cannot suspend the last active OWNER'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  UPDATE public.tenant_memberships AS membership
  SET status = 'SUSPENDED',
      updated_at = statement_timestamp()
  WHERE membership.tenant_id = p_tenant_id
    AND membership.id = p_membership_id
  RETURNING membership.id, membership.user_id, membership.role, membership.status
  INTO membership_id, user_id, role, status;

  INSERT INTO public.audit_events (
    tenant_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    p_tenant_id, actor_id, 'tenant.membership.suspend',
    'tenant_membership', membership_id,
    jsonb_build_object('user_id', user_id, 'role', role, 'old_status', target.status)
  );

  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION tenant_membership_remove(
  p_tenant_id UUID,
  p_membership_id UUID
)
RETURNS TABLE(
  membership_id UUID,
  user_id UUID,
  role tenant_role,
  status membership_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  actor_id UUID;
  actor_role tenant_role;
  target public.tenant_memberships%ROWTYPE;
  other_active_owners INTEGER;
BEGIN
  actor_id := public.app_current_user_id();

  IF actor_id IS NULL
     OR p_tenant_id IS NULL
     OR p_membership_id IS NULL
     OR public.app_current_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Invalid membership removal context'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::TEXT, 0)
  );

  SELECT membership.role
  INTO actor_role
  FROM public.tenant_memberships AS membership
  JOIN public.users AS account ON account.id = membership.user_id
  JOIN public.tenants AS tenant ON tenant.id = membership.tenant_id
  WHERE membership.tenant_id = p_tenant_id
    AND membership.user_id = actor_id
    AND membership.status = 'ACTIVE'
    AND account.status = 'ACTIVE'
    AND tenant.status = 'ACTIVE';

  IF NOT FOUND OR actor_role <> 'OWNER' THEN
    RAISE EXCEPTION 'Membership administration permission denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT membership.*
  INTO target
  FROM public.tenant_memberships AS membership
  WHERE membership.tenant_id = p_tenant_id
    AND membership.id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND OR target.status = 'REMOVED' THEN
    RETURN;
  END IF;

  IF target.role = 'OWNER' AND target.status = 'ACTIVE' THEN
    SELECT count(*)
    INTO other_active_owners
    FROM public.tenant_memberships AS membership
    WHERE membership.tenant_id = p_tenant_id
      AND membership.role = 'OWNER'
      AND membership.status = 'ACTIVE'
      AND membership.id <> target.id;

    IF other_active_owners < 1 THEN
      RAISE EXCEPTION 'Cannot remove the last active OWNER'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  UPDATE public.tenant_memberships AS membership
  SET status = 'REMOVED',
      updated_at = statement_timestamp()
  WHERE membership.tenant_id = p_tenant_id
    AND membership.id = p_membership_id
  RETURNING membership.id, membership.user_id, membership.role, membership.status
  INTO membership_id, user_id, role, status;

  INSERT INTO public.audit_events (
    tenant_id, actor_user_id, action, entity_type, entity_id, metadata
  )
  VALUES (
    p_tenant_id, actor_id, 'tenant.membership.remove',
    'tenant_membership', membership_id,
    jsonb_build_object('user_id', user_id, 'role', role, 'old_status', target.status)
  );

  RETURN NEXT;
END;
$function$;

GRANT CREATE ON SCHEMA public TO marketfa_tenant_admin_owner;
ALTER FUNCTION tenant_invitation_create(UUID, BYTEA, TEXT, tenant_role, INTEGER)
  OWNER TO marketfa_tenant_admin_owner;
ALTER FUNCTION tenant_membership_change_role(UUID, UUID, tenant_role)
  OWNER TO marketfa_tenant_admin_owner;
ALTER FUNCTION tenant_membership_suspend(UUID, UUID)
  OWNER TO marketfa_tenant_admin_owner;
ALTER FUNCTION tenant_membership_remove(UUID, UUID)
  OWNER TO marketfa_tenant_admin_owner;
REVOKE CREATE ON SCHEMA public FROM marketfa_tenant_admin_owner;

REVOKE ALL ON FUNCTION tenant_membership_change_role(UUID, UUID, tenant_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION tenant_membership_suspend(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION tenant_membership_remove(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenant_membership_change_role(UUID, UUID, tenant_role) TO marketfa_app;
GRANT EXECUTE ON FUNCTION tenant_membership_suspend(UUID, UUID) TO marketfa_app;
GRANT EXECUTE ON FUNCTION tenant_membership_remove(UUID, UUID) TO marketfa_app;
