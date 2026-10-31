-- Atomic first-tenant onboarding command. Direct tenant administration writes
-- remain revoked from the ordinary application role.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'marketfa_tenant_admin_owner'
  ) THEN
    CREATE ROLE marketfa_tenant_admin_owner
      NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;

ALTER ROLE marketfa_tenant_admin_owner
  NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;

GRANT USAGE ON SCHEMA public TO marketfa_tenant_admin_owner;
GRANT SELECT ON users, tenants, stores, tenant_memberships
  TO marketfa_tenant_admin_owner;
GRANT INSERT ON tenants, stores, tenant_memberships, audit_events
  TO marketfa_tenant_admin_owner;

CREATE POLICY tenant_admin_owner_tenant_insert ON tenants
  FOR INSERT TO marketfa_tenant_admin_owner
  WITH CHECK (created_by_user_id = app_current_user_id());

CREATE POLICY tenant_admin_owner_tenant_read ON tenants
  FOR SELECT TO marketfa_tenant_admin_owner
  USING (
    created_by_user_id = app_current_user_id()
    OR id = app_current_tenant_id()
  );

CREATE OR REPLACE FUNCTION tenant_bootstrap(
  p_display_name TEXT,
  p_legal_name TEXT,
  p_store_name TEXT
)
RETURNS TABLE (
  created_tenant_id UUID,
  created_store_id UUID,
  owner_membership_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  actor_id UUID;
  new_tenant_id UUID;
  new_store_id UUID;
  new_membership_id UUID;
BEGIN
  IF p_display_name IS NULL
     OR length(btrim(p_display_name)) NOT BETWEEN 1 AND 160
     OR (p_legal_name IS NOT NULL AND length(btrim(p_legal_name)) > 200)
     OR p_store_name IS NULL
     OR length(btrim(p_store_name)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Invalid tenant bootstrap input'
      USING ERRCODE = '22023';
  END IF;

  actor_id := public.app_current_user_id();
  IF actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.users AS account
    WHERE account.id = actor_id
      AND account.status = 'ACTIVE'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.tenants (
    display_name,
    legal_name,
    created_by_user_id
  )
  VALUES (
    btrim(p_display_name),
    NULLIF(btrim(p_legal_name), ''),
    actor_id
  )
  RETURNING id INTO new_tenant_id;

  PERFORM set_config(
    'app.current_tenant_id',
    new_tenant_id::TEXT,
    true
  );

  INSERT INTO public.stores (
    tenant_id,
    name
  )
  VALUES (
    new_tenant_id,
    btrim(p_store_name)
  )
  RETURNING id INTO new_store_id;

  INSERT INTO public.tenant_memberships (
    tenant_id,
    user_id,
    role,
    status
  )
  VALUES (
    new_tenant_id,
    actor_id,
    'OWNER',
    'ACTIVE'
  )
  RETURNING id INTO new_membership_id;

  INSERT INTO public.audit_events (
    tenant_id,
    store_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    new_tenant_id,
    new_store_id,
    actor_id,
    'tenant.bootstrap',
    'tenant',
    new_tenant_id,
    jsonb_build_object('store_id', new_store_id)
  );

  RETURN QUERY
  SELECT new_tenant_id, new_store_id, new_membership_id;
END;
$function$;

GRANT CREATE ON SCHEMA public TO marketfa_tenant_admin_owner;
ALTER FUNCTION tenant_bootstrap(TEXT, TEXT, TEXT)
  OWNER TO marketfa_tenant_admin_owner;
REVOKE CREATE ON SCHEMA public FROM marketfa_tenant_admin_owner;

REVOKE ALL ON FUNCTION tenant_bootstrap(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenant_bootstrap(TEXT, TEXT, TEXT)
  TO marketfa_app;
