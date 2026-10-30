DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'marketfa_app') THEN
    EXECUTE 'CREATE ROLE marketfa_app NOLOGIN NOSUPERUSER NOBYPASSRLS';
  END IF;
END
$$;

CREATE TYPE tenant_role AS ENUM (
  'OWNER',
  'MANAGER',
  'CASHIER',
  'ACCOUNTANT',
  'VIEWER'
);

CREATE TYPE membership_status AS ENUM (
  'INVITED',
  'ACTIVE',
  'SUSPENDED',
  'REMOVED'
);

CREATE TYPE invitation_status AS ENUM (
  'PENDING',
  'ACCEPTED',
  'REVOKED',
  'EXPIRED'
);

CREATE TYPE record_status AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'INACTIVE'
);

CREATE TYPE terminal_status AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'REVOKED'
);

CREATE TYPE display_money_unit AS ENUM (
  'IRR',
  'TOMAN'
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  email_normalized TEXT,
  phone_e164 TEXT,
  status record_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_normalized_uq
  ON users (email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE UNIQUE INDEX users_phone_e164_uq
  ON users (phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE TABLE auth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  normalized_identifier TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_key, provider_subject)
);

CREATE INDEX auth_identities_user_idx ON auth_identities (user_id);

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  rotation_parent_id UUID REFERENCES user_sessions(id),
  user_agent TEXT,
  CHECK (expires_at > created_at)
);

CREATE INDEX user_sessions_user_expiry_idx
  ON user_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  legal_name TEXT,
  status record_status NOT NULL DEFAULT 'ACTIVE',
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Tehran',
  default_locale TEXT NOT NULL DEFAULT 'fa-IR',
  currency_code CHAR(3) NOT NULL DEFAULT 'IRR',
  money_display_unit display_money_unit NOT NULL DEFAULT 'TOMAN',
  status record_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (default_locale IN ('fa-IR', 'en')),
  CHECK (currency_code = 'IRR'),
  UNIQUE (tenant_id, id)
);

CREATE INDEX stores_tenant_status_idx ON stores (tenant_id, status);

CREATE TABLE tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role tenant_role NOT NULL,
  status membership_status NOT NULL DEFAULT 'INVITED',
  invited_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, invited_by_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX tenant_memberships_user_status_idx
  ON tenant_memberships (user_id, status);

CREATE TABLE tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL UNIQUE,
  intended_identifier TEXT,
  role tenant_role NOT NULL,
  status invitation_status NOT NULL DEFAULT 'PENDING',
  invited_by_user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_by_user_id UUID,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, invited_by_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, accepted_by_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  name TEXT NOT NULL,
  credential_hash BYTEA NOT NULL UNIQUE,
  status terminal_status NOT NULL DEFAULT 'ACTIVE',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores (tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX terminals_store_status_idx
  ON terminals (tenant_id, store_id, status);

CREATE TABLE terminal_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  store_id UUID NOT NULL,
  terminal_id UUID NOT NULL,
  user_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  FOREIGN KEY (tenant_id, terminal_id)
    REFERENCES terminals (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, user_id)
    REFERENCES tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX terminal_assignments_user_active_idx
  ON terminal_assignments (tenant_id, user_id)
  WHERE revoked_at IS NULL;

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id UUID,
  actor_user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  reason TEXT,
  request_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, actor_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX audit_events_tenant_time_idx
  ON audit_events (tenant_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID
$$;

CREATE OR REPLACE FUNCTION app_current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_self_or_same_tenant_read ON users
  FOR SELECT
  USING (
    id = app_current_user_id()
    OR EXISTS (
      SELECT 1
      FROM tenant_memberships membership
      WHERE membership.user_id = users.id
        AND membership.tenant_id = app_current_tenant_id()
        AND membership.status = 'ACTIVE'
    )
  );
CREATE POLICY users_self_write ON users
  FOR ALL
  USING (id = app_current_user_id())
  WITH CHECK (id = app_current_user_id());

ALTER TABLE auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_identities FORCE ROW LEVEL SECURITY;
CREATE POLICY auth_identities_self ON auth_identities
  FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY user_sessions_self ON user_sessions
  FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenants_current_tenant ON tenants
  FOR ALL
  USING (id = app_current_tenant_id())
  WITH CHECK (id = app_current_tenant_id());

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores FORCE ROW LEVEL SECURITY;
CREATE POLICY stores_current_tenant ON stores
  FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY memberships_current_tenant_or_self_read ON tenant_memberships
  FOR SELECT
  USING (
    tenant_id = app_current_tenant_id()
    OR user_id = app_current_user_id()
  );
CREATE POLICY memberships_current_tenant_insert ON tenant_memberships
  FOR INSERT
  WITH CHECK (tenant_id = app_current_tenant_id());
CREATE POLICY memberships_current_tenant_update ON tenant_memberships
  FOR UPDATE
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY invitations_current_tenant ON tenant_invitations
  FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminals FORCE ROW LEVEL SECURITY;
CREATE POLICY terminals_current_tenant ON terminals
  FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE terminal_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY terminal_assignments_current_tenant ON terminal_assignments
  FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_events_current_tenant_read ON audit_events
  FOR SELECT
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY audit_events_current_tenant_insert ON audit_events
  FOR INSERT
  WITH CHECK (tenant_id = app_current_tenant_id());

GRANT USAGE ON SCHEMA public TO marketfa_app;
GRANT SELECT, INSERT, UPDATE ON
  users,
  auth_identities,
  user_sessions,
  tenants,
  stores,
  tenant_memberships,
  tenant_invitations,
  terminals,
  terminal_assignments
TO marketfa_app;
GRANT SELECT, INSERT ON audit_events TO marketfa_app;
GRANT EXECUTE ON FUNCTION app_current_user_id() TO marketfa_app;
GRANT EXECUTE ON FUNCTION app_current_tenant_id() TO marketfa_app;
