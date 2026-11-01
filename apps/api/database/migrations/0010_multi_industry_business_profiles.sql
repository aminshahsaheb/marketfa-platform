-- Multi-industry business profiles and server-authoritative capability defaults.
-- This migration follows the accounting schema foundation (0009).

CREATE TABLE industry_catalog (
  industry_key VARCHAR(80) NOT NULL,
  profile_version INTEGER NOT NULL,
  display_name_key VARCHAR(120) NOT NULL,
  group_key VARCHAR(80) NOT NULL,
  is_regulated BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (industry_key, profile_version),
  CHECK (profile_version > 0),
  CHECK (status IN ('ACTIVE', 'DEPRECATED')),
  CHECK (length(btrim(industry_key)) BETWEEN 1 AND 80),
  CHECK (length(btrim(display_name_key)) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX industry_catalog_one_active_version_uq
  ON industry_catalog (industry_key)
  WHERE status = 'ACTIVE';

CREATE TABLE capability_catalog (
  capability_key VARCHAR(80) PRIMARY KEY,
  display_name_key VARCHAR(120) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  CHECK (status IN ('ACTIVE', 'DEPRECATED')),
  CHECK (length(btrim(capability_key)) BETWEEN 1 AND 80),
  CHECK (length(btrim(display_name_key)) BETWEEN 1 AND 120)
);

CREATE TABLE industry_capability_defaults (
  industry_key VARCHAR(80) NOT NULL,
  profile_version INTEGER NOT NULL,
  capability_key VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (industry_key, profile_version, capability_key),
  FOREIGN KEY (industry_key, profile_version)
    REFERENCES industry_catalog (industry_key, profile_version)
    ON DELETE RESTRICT,
  FOREIGN KEY (capability_key)
    REFERENCES capability_catalog (capability_key)
    ON DELETE RESTRICT
);

INSERT INTO industry_catalog (
  industry_key, profile_version, display_name_key, group_key, is_regulated
)
VALUES
  ('general-retail', 1, 'industry.general_retail', 'retail', FALSE),
  ('grocery', 1, 'industry.grocery', 'retail', FALSE),
  ('apparel', 1, 'industry.apparel', 'retail', FALSE),
  ('electronics', 1, 'industry.electronics', 'retail', FALSE),
  ('pharmacy', 1, 'industry.pharmacy', 'regulated-retail', TRUE),
  ('restaurant', 1, 'industry.restaurant', 'food-service', FALSE),
  ('cafe-bakery', 1, 'industry.cafe_bakery', 'food-service', FALSE),
  ('professional-services', 1, 'industry.professional_services', 'services', FALSE),
  ('repair-maintenance', 1, 'industry.repair_maintenance', 'services', FALSE),
  ('health-wellness', 1, 'industry.health_wellness', 'appointments', TRUE),
  ('education', 1, 'industry.education', 'services', FALSE),
  ('construction', 1, 'industry.construction', 'projects', FALSE),
  ('wholesale', 1, 'industry.wholesale', 'trade', FALSE),
  ('manufacturing', 1, 'industry.manufacturing', 'production', FALSE),
  ('transport', 1, 'industry.transport', 'operations', FALSE),
  ('hospitality', 1, 'industry.hospitality', 'hospitality', FALSE),
  ('custom', 1, 'industry.custom', 'custom', FALSE);

INSERT INTO capability_catalog (capability_key, display_name_key)
VALUES
  ('customers', 'capability.customers'),
  ('suppliers', 'capability.suppliers'),
  ('sales', 'capability.sales'),
  ('payments', 'capability.payments'),
  ('expenses', 'capability.expenses'),
  ('finance', 'capability.finance'),
  ('reports', 'capability.reports'),
  ('catalog', 'capability.catalog'),
  ('inventory', 'capability.inventory'),
  ('procurement', 'capability.procurement'),
  ('point_of_sale', 'capability.point_of_sale'),
  ('appointments', 'capability.appointments'),
  ('work_orders', 'capability.work_orders'),
  ('projects', 'capability.projects'),
  ('reservations', 'capability.reservations'),
  ('production', 'capability.production'),
  ('delivery', 'capability.delivery');

INSERT INTO industry_capability_defaults (
  industry_key, profile_version, capability_key
)
SELECT profile.industry_key, 1, capability.capability_key
FROM (
  VALUES
    ('general-retail', ARRAY['customers','suppliers','sales','payments','expenses','finance','reports','catalog','inventory','procurement','point_of_sale']::TEXT[]),
    ('grocery', ARRAY['customers','suppliers','sales','payments','expenses','finance','reports','catalog','inventory','procurement','point_of_sale']::TEXT[]),
    ('apparel', ARRAY['customers','suppliers','sales','payments','expenses','finance','reports','catalog','inventory','procurement','point_of_sale']::TEXT[]),
    ('electronics', ARRAY['customers','suppliers','sales','payments','expenses','finance','reports','catalog','inventory','procurement','point_of_sale']::TEXT[]),
    ('pharmacy', ARRAY['customers','suppliers','sales','payments','expenses','finance','reports','catalog','inventory','procurement','point_of_sale']::TEXT[]),
    ('restaurant', ARRAY['customers','suppliers','sales','payments','expenses','finance','reports','catalog','inventory','procurement','point_of_sale','reservations','delivery']::TEXT[]),
    ('cafe-bakery', ARRAY['customers','suppliers','sales','payments','expenses','finance','reports','catalog','inventory','procurement','point_of_sale','production']::TEXT[]),
    ('professional-services', ARRAY['customers','sales','payments','expenses','finance','reports','projects']::TEXT[]),
    ('repair-maintenance', ARRAY['customers','suppliers','sales','payments','expenses','finance','reports','catalog','inventory','procurement','work_orders']::TEXT[]),
    ('health-wellness', ARRAY['customers','sales','payments','expenses','finance','reports','appointments']::TEXT[]),
    ('education', ARRAY['customers','sales','payments','expenses','finance','reports','appointments','projects']::TEXT[]),
    ('construction', ARRAY['customers','suppliers','sales','payments','expenses','finance','reports','procurement','projects','work_orders']::TEXT[]),
    ('wholesale', ARRAY['customers','suppliers','sales','payments','expenses','finance','reports','catalog','inventory','procurement','delivery']::TEXT[]),
    ('manufacturing', ARRAY['customers','suppliers','sales','payments','expenses','finance','reports','catalog','inventory','procurement','production','work_orders']::TEXT[]),
    ('transport', ARRAY['customers','sales','payments','expenses','finance','reports','delivery','work_orders']::TEXT[]),
    ('hospitality', ARRAY['customers','sales','payments','expenses','finance','reports','reservations','appointments']::TEXT[]),
    ('custom', ARRAY['customers','sales','payments','expenses','finance','reports']::TEXT[])
) AS profile(industry_key, capability_keys)
CROSS JOIN LATERAL unnest(profile.capability_keys) AS capability(capability_key);

CREATE TABLE business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  display_name VARCHAR(160) NOT NULL,
  industry_key VARCHAR(80) NOT NULL,
  industry_profile_version INTEGER NOT NULL,
  accounting_book_id UUID,
  status record_status NOT NULL DEFAULT 'ACTIVE',
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (industry_key, industry_profile_version)
    REFERENCES industry_catalog (industry_key, profile_version)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id)
    ON DELETE RESTRICT,
  CHECK (length(btrim(display_name)) BETWEEN 1 AND 160)
);

CREATE INDEX business_profiles_tenant_status_idx
  ON business_profiles (tenant_id, status);

CREATE TABLE business_profile_capabilities (
  tenant_id UUID NOT NULL,
  business_profile_id UUID NOT NULL,
  capability_key VARCHAR(80) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'SUGGESTED',
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_by_user_id UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, business_profile_id, capability_key),
  FOREIGN KEY (tenant_id, business_profile_id)
    REFERENCES business_profiles (tenant_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (capability_key)
    REFERENCES capability_catalog (capability_key)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, assigned_by_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id)
    ON DELETE RESTRICT,
  CHECK (status IN ('SUGGESTED', 'PENDING_APPROVAL', 'ENABLED', 'DISABLED'))
);

CREATE INDEX business_profile_capabilities_status_idx
  ON business_profile_capabilities (
    tenant_id, business_profile_id, status, capability_key
  );

-- Existing tenants were created under the retail-only product contract.
-- Preserve their behaviour by assigning the general-retail profile.
INSERT INTO business_profiles (
  tenant_id,
  display_name,
  industry_key,
  industry_profile_version,
  created_by_user_id
)
SELECT
  tenant.id,
  tenant.display_name,
  'general-retail',
  1,
  (
    SELECT membership.user_id
    FROM tenant_memberships AS membership
    WHERE membership.tenant_id = tenant.id
      AND membership.status = 'ACTIVE'
    ORDER BY
      CASE WHEN membership.user_id = tenant.created_by_user_id THEN 0 ELSE 1 END,
      membership.created_at,
      membership.user_id
    LIMIT 1
  )
FROM tenants AS tenant;

-- Give each existing business profile a separate default accounting book.
-- A later reviewed command may map multiple profiles to one book when they
-- belong to the same legal/accounting entity.
WITH profile_book_map AS MATERIALIZED (
  SELECT
    profile.id AS profile_id,
    profile.tenant_id,
    profile.display_name,
    profile.created_by_user_id,
    gen_random_uuid() AS accounting_book_id
  FROM business_profiles AS profile
),
inserted_books AS (
  INSERT INTO accounting_books (
    id, tenant_id, name, created_by_user_id
  )
  SELECT
    profile_book_map.accounting_book_id,
    profile_book_map.tenant_id,
    profile_book_map.display_name,
    profile_book_map.created_by_user_id
  FROM profile_book_map
  RETURNING id
)
UPDATE business_profiles AS profile
SET accounting_book_id = profile_book_map.accounting_book_id
FROM profile_book_map
JOIN inserted_books
  ON inserted_books.id = profile_book_map.accounting_book_id
WHERE profile.id = profile_book_map.profile_id;

ALTER TABLE business_profiles
  ALTER COLUMN accounting_book_id SET NOT NULL,
  ADD CONSTRAINT business_profiles_accounting_book_fk
    FOREIGN KEY (tenant_id, accounting_book_id)
    REFERENCES accounting_books (tenant_id, id)
    ON DELETE RESTRICT;


INSERT INTO business_profile_capabilities (
  tenant_id,
  business_profile_id,
  capability_key,
  status,
  assigned_by_user_id
)
SELECT
  profile.tenant_id,
  profile.id,
  defaults.capability_key,
  CASE WHEN industry.is_regulated THEN 'PENDING_APPROVAL' ELSE 'SUGGESTED' END,
  profile.created_by_user_id
FROM business_profiles AS profile
JOIN industry_catalog AS industry
  ON industry.industry_key = profile.industry_key
 AND industry.profile_version = profile.industry_profile_version
JOIN industry_capability_defaults AS defaults
  ON defaults.industry_key = profile.industry_key
 AND defaults.profile_version = profile.industry_profile_version
JOIN capability_catalog AS capability
  ON capability.capability_key = defaults.capability_key
 AND capability.status = 'ACTIVE';

ALTER TABLE stores
  ADD COLUMN business_profile_id UUID;

UPDATE stores AS store
SET business_profile_id = profile.id
FROM business_profiles AS profile
WHERE profile.tenant_id = store.tenant_id;

ALTER TABLE stores
  ALTER COLUMN business_profile_id SET NOT NULL,
  ADD CONSTRAINT stores_business_profile_fk
    FOREIGN KEY (tenant_id, business_profile_id)
    REFERENCES business_profiles (tenant_id, id)
    ON DELETE RESTRICT;

CREATE INDEX stores_business_profile_idx
  ON stores (tenant_id, business_profile_id);

ALTER TABLE stores
  ADD CONSTRAINT stores_tenant_profile_id_uq
  UNIQUE (tenant_id, business_profile_id, id);

CREATE TABLE business_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  business_profile_id UUID NOT NULL,
  name VARCHAR(160) NOT NULL,
  location_type VARCHAR(24) NOT NULL DEFAULT 'OTHER',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Tehran',
  store_id UUID,
  status record_status NOT NULL DEFAULT 'ACTIVE',
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, store_id),
  FOREIGN KEY (tenant_id, business_profile_id)
    REFERENCES business_profiles (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, business_profile_id, store_id)
    REFERENCES stores (tenant_id, business_profile_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT,
  CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  CHECK (location_type IN (
    'BRANCH', 'OFFICE', 'WORKSHOP', 'WAREHOUSE',
    'PROJECT_SITE', 'SERVICE_AREA', 'REMOTE', 'OTHER'
  )),
  CHECK (length(btrim(timezone)) BETWEEN 1 AND 64)
);

CREATE INDEX business_locations_profile_status_idx
  ON business_locations (tenant_id, business_profile_id, status);

-- Map every legacy store to one business location. Non-retail profiles can
-- create locations without creating a store.
INSERT INTO business_locations (
  tenant_id,
  business_profile_id,
  name,
  location_type,
  timezone,
  store_id
)
SELECT
  store.tenant_id,
  store.business_profile_id,
  store.name,
  'BRANCH',
  store.timezone,
  store.id
FROM stores AS store;

INSERT INTO business_locations (
  tenant_id,
  business_profile_id,
  name,
  location_type,
  created_by_user_id
)
SELECT
  profile.tenant_id,
  profile.id,
  profile.display_name,
  'OFFICE',
  profile.created_by_user_id
FROM business_profiles AS profile
WHERE NOT EXISTS (
  SELECT 1
  FROM business_locations AS location
  WHERE location.tenant_id = profile.tenant_id
    AND location.business_profile_id = profile.id
);

CREATE OR REPLACE FUNCTION prevent_store_business_profile_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.business_profile_id IS DISTINCT FROM OLD.business_profile_id
     AND current_user <> 'marketfa_tenant_admin_owner' THEN
    RAISE EXCEPTION 'Business profile reassignment requires an approved command'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER stores_business_profile_reassignment_trg
  BEFORE UPDATE OF business_profile_id ON stores
  FOR EACH ROW
  EXECUTE FUNCTION prevent_store_business_profile_reassignment();

CREATE OR REPLACE FUNCTION enforce_store_profile_pos_capability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.business_profiles AS profile
    JOIN public.industry_capability_defaults AS defaults
      ON defaults.industry_key = profile.industry_key
     AND defaults.profile_version = profile.industry_profile_version
     AND defaults.capability_key = 'point_of_sale'
    JOIN public.capability_catalog AS capability
      ON capability.capability_key = defaults.capability_key
     AND capability.status = 'ACTIVE'
    WHERE profile.tenant_id = NEW.tenant_id
      AND profile.id = NEW.business_profile_id
  ) THEN
    RAISE EXCEPTION 'Business profile does not support a retail store/POS'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER stores_profile_pos_capability_trg
  BEFORE INSERT OR UPDATE OF tenant_id, business_profile_id ON stores
  FOR EACH ROW
  EXECUTE FUNCTION enforce_store_profile_pos_capability();

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY business_profiles_current_tenant_read ON business_profiles
  FOR SELECT TO marketfa_app
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY business_profiles_tenant_admin_read ON business_profiles
  FOR SELECT TO marketfa_tenant_admin_owner
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY business_profiles_tenant_admin_insert ON business_profiles
  FOR INSERT TO marketfa_tenant_admin_owner
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND (
      created_by_user_id IS NULL
      OR created_by_user_id = app_current_user_id()
    )
  );

ALTER TABLE business_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_locations FORCE ROW LEVEL SECURITY;
CREATE POLICY business_locations_current_tenant_read ON business_locations
  FOR SELECT TO marketfa_app
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY business_locations_tenant_admin_read ON business_locations
  FOR SELECT TO marketfa_tenant_admin_owner
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY business_locations_tenant_admin_insert ON business_locations
  FOR INSERT TO marketfa_tenant_admin_owner
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND (
      created_by_user_id IS NULL
      OR created_by_user_id = app_current_user_id()
    )
  );

ALTER TABLE business_profile_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profile_capabilities FORCE ROW LEVEL SECURITY;
CREATE POLICY business_profile_capabilities_current_tenant_read
  ON business_profile_capabilities
  FOR SELECT TO marketfa_app
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY business_profile_capabilities_tenant_admin_read
  ON business_profile_capabilities
  FOR SELECT TO marketfa_tenant_admin_owner
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY business_profile_capabilities_tenant_admin_insert
  ON business_profile_capabilities
  FOR INSERT TO marketfa_tenant_admin_owner
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND (
      assigned_by_user_id IS NULL
      OR assigned_by_user_id = app_current_user_id()
    )
  );

GRANT SELECT ON
  industry_catalog,
  capability_catalog,
  industry_capability_defaults
TO marketfa_app, marketfa_tenant_admin_owner;

GRANT SELECT ON business_profiles, business_profile_capabilities,
  business_locations TO marketfa_app;
GRANT SELECT, INSERT ON
  business_profiles,
  business_profile_capabilities,
  business_locations
TO marketfa_tenant_admin_owner;

CREATE POLICY accounting_books_tenant_admin_read ON accounting_books
  FOR SELECT TO marketfa_tenant_admin_owner
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY accounting_books_tenant_admin_insert ON accounting_books
  FOR INSERT TO marketfa_tenant_admin_owner
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND (
      created_by_user_id IS NULL
      OR created_by_user_id = app_current_user_id()
    )
  );
GRANT SELECT, INSERT ON accounting_books TO marketfa_tenant_admin_owner;

GRANT SELECT ON business_profiles, business_profile_capabilities
  TO marketfa_tenant_admin_owner;

-- Tenant bootstrap creates a business profile and a generic location.
-- A retail store is optional. Suggested modules are not treated as live modules.
CREATE OR REPLACE FUNCTION tenant_bootstrap(
  p_display_name TEXT,
  p_legal_name TEXT,
  p_location_name TEXT,
  p_store_name TEXT,
  p_industry_key TEXT
)
RETURNS TABLE (
  created_tenant_id UUID,
  created_store_id UUID,
  owner_membership_id UUID,
  created_business_profile_id UUID,
  created_business_location_id UUID,
  created_accounting_book_id UUID
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
  new_business_profile_id UUID;
  new_business_location_id UUID;
  new_accounting_book_id UUID;
  selected_profile_version INTEGER;
  selected_profile_regulated BOOLEAN;
BEGIN
  IF p_display_name IS NULL
     OR length(btrim(p_display_name)) NOT BETWEEN 1 AND 160
     OR (p_legal_name IS NOT NULL AND length(btrim(p_legal_name)) > 200)
     OR p_location_name IS NULL
     OR length(btrim(p_location_name)) NOT BETWEEN 1 AND 160
     OR (p_store_name IS NOT NULL
         AND length(btrim(p_store_name)) NOT BETWEEN 1 AND 160)
     OR p_industry_key IS NULL
     OR length(btrim(p_industry_key)) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Invalid tenant bootstrap input'
      USING ERRCODE = '22023';
  END IF;

  SELECT industry.profile_version, industry.is_regulated
  INTO selected_profile_version, selected_profile_regulated
  FROM public.industry_catalog AS industry
  WHERE industry.industry_key = btrim(p_industry_key)
    AND industry.status = 'ACTIVE';

  IF selected_profile_version IS NULL THEN
    RAISE EXCEPTION 'Unknown or inactive industry profile'
      USING ERRCODE = '22023';
  END IF;

  IF p_store_name IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.industry_capability_defaults AS defaults
    JOIN public.capability_catalog AS capability
      ON capability.capability_key = defaults.capability_key
     AND capability.status = 'ACTIVE'
    WHERE defaults.industry_key = btrim(p_industry_key)
      AND defaults.profile_version = selected_profile_version
      AND defaults.capability_key = 'point_of_sale'
  ) THEN
    RAISE EXCEPTION 'Selected industry profile does not support a retail store/POS'
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

  INSERT INTO public.accounting_books (
    tenant_id,
    name,
    created_by_user_id
  )
  VALUES (
    new_tenant_id,
    btrim(p_display_name),
    actor_id
  )
  RETURNING id INTO new_accounting_book_id;

  INSERT INTO public.business_profiles (
    tenant_id,
    display_name,
    industry_key,
    industry_profile_version,
    accounting_book_id,
    created_by_user_id
  )
  VALUES (
    new_tenant_id,
    btrim(p_display_name),
    btrim(p_industry_key),
    selected_profile_version,
    new_accounting_book_id,
    actor_id
  )
  RETURNING id INTO new_business_profile_id;

  INSERT INTO public.business_profile_capabilities (
    tenant_id,
    business_profile_id,
    capability_key,
    status,
    assigned_by_user_id
  )
  SELECT
    new_tenant_id,
    new_business_profile_id,
    defaults.capability_key,
    CASE
      WHEN selected_profile_regulated THEN 'PENDING_APPROVAL'
      ELSE 'SUGGESTED'
    END,
    actor_id
  FROM public.industry_capability_defaults AS defaults
  JOIN public.capability_catalog AS capability
    ON capability.capability_key = defaults.capability_key
   AND capability.status = 'ACTIVE'
  WHERE defaults.industry_key = btrim(p_industry_key)
    AND defaults.profile_version = selected_profile_version;

  IF p_store_name IS NOT NULL THEN
    INSERT INTO public.stores (
      tenant_id,
      name,
      business_profile_id
    )
    VALUES (
      new_tenant_id,
      btrim(p_store_name),
      new_business_profile_id
    )
    RETURNING id INTO new_store_id;
  END IF;

  INSERT INTO public.business_locations (
    tenant_id,
    business_profile_id,
    name,
    location_type,
    store_id,
    created_by_user_id
  )
  VALUES (
    new_tenant_id,
    new_business_profile_id,
    btrim(p_location_name),
    'OTHER',
    new_store_id,
    actor_id
  )
  RETURNING id INTO new_business_location_id;

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
    jsonb_build_object(
      'store_id', new_store_id,
      'business_profile_id', new_business_profile_id,
      'business_location_id', new_business_location_id,
      'accounting_book_id', new_accounting_book_id,
      'industry_key', btrim(p_industry_key),
      'industry_profile_version', selected_profile_version,
      'regulated', selected_profile_regulated
    )
  );

  RETURN QUERY
  SELECT
    new_tenant_id,
    new_store_id,
    new_membership_id,
    new_business_profile_id,
    new_business_location_id,
    new_accounting_book_id;
END;
$function$;

-- Keep the previous four-argument SQL signature for existing internal clients.
CREATE OR REPLACE FUNCTION tenant_bootstrap(
  p_display_name TEXT,
  p_legal_name TEXT,
  p_store_name TEXT,
  p_industry_key TEXT
)
RETURNS TABLE (
  created_tenant_id UUID,
  created_store_id UUID,
  owner_membership_id UUID,
  created_business_profile_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    result.created_tenant_id,
    result.created_store_id,
    result.owner_membership_id,
    result.created_business_profile_id
  FROM public.tenant_bootstrap(
    p_display_name,
    p_legal_name,
    p_store_name,
    p_store_name,
    p_industry_key
  ) AS result
$function$;

-- Preserve the original three-argument SQL call for existing internal fixtures.
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    result.created_tenant_id,
    result.created_store_id,
    result.owner_membership_id
  FROM public.tenant_bootstrap(
    p_display_name,
    p_legal_name,
    p_store_name,
    p_store_name,
    'general-retail'
  ) AS result
$function$;

GRANT CREATE ON SCHEMA public TO marketfa_tenant_admin_owner;
ALTER FUNCTION tenant_bootstrap(TEXT, TEXT, TEXT, TEXT, TEXT)
  OWNER TO marketfa_tenant_admin_owner;
ALTER FUNCTION tenant_bootstrap(TEXT, TEXT, TEXT, TEXT)
  OWNER TO marketfa_tenant_admin_owner;
ALTER FUNCTION tenant_bootstrap(TEXT, TEXT, TEXT)
  OWNER TO marketfa_tenant_admin_owner;
REVOKE CREATE ON SCHEMA public FROM marketfa_tenant_admin_owner;

REVOKE ALL ON FUNCTION tenant_bootstrap(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION tenant_bootstrap(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION tenant_bootstrap(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenant_bootstrap(TEXT, TEXT, TEXT, TEXT, TEXT)
  TO marketfa_app;
GRANT EXECUTE ON FUNCTION tenant_bootstrap(TEXT, TEXT, TEXT, TEXT)
  TO marketfa_app;
GRANT EXECUTE ON FUNCTION tenant_bootstrap(TEXT, TEXT, TEXT)
  TO marketfa_app;
