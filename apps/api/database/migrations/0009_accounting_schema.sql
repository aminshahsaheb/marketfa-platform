-- M3 accounting schema foundation aligned to M2 tenant/store boundaries.
-- No chart-of-accounts template or fiscal-year policy is seeded here.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'marketfa_accounting_owner'
  ) THEN
    CREATE ROLE marketfa_accounting_owner
      NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;

ALTER ROLE marketfa_accounting_owner
  NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;

CREATE TYPE accounting_account_type AS ENUM (
  'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
);
CREATE TYPE accounting_normal_balance AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE accounting_account_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE accounting_period_status AS ENUM ('OPEN', 'CLOSING', 'CLOSED');
CREATE TYPE accounting_rule_status AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');
CREATE TYPE accounting_journal_status AS ENUM ('DRAFT', 'POSTED');

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL,
  code VARCHAR(32) NOT NULL,
  name_key VARCHAR(120) NOT NULL,
  account_type accounting_account_type NOT NULL,
  normal_balance accounting_normal_balance NOT NULL,
  parent_account_id UUID,
  is_postable BOOLEAN NOT NULL DEFAULT TRUE,
  status accounting_account_status NOT NULL DEFAULT 'ACTIVE',
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, store_id, id),
  UNIQUE (tenant_id, store_id, code),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, store_id, parent_account_id)
    REFERENCES accounts (tenant_id, store_id, id) ON DELETE RESTRICT,
  CHECK (parent_account_id IS NULL OR parent_account_id <> id),
  CHECK (length(btrim(code)) BETWEEN 1 AND 32),
  CHECK (length(btrim(name_key)) BETWEEN 1 AND 120)
);

CREATE INDEX accounts_store_parent_status_idx
  ON accounts (tenant_id, store_id, parent_account_id, status);

CREATE TABLE fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL,
  name VARCHAR(80) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status accounting_period_status NOT NULL DEFAULT 'OPEN',
  closed_at TIMESTAMPTZ,
  closed_by_user_id UUID,
  close_reason TEXT,
  reopened_at TIMESTAMPTZ,
  reopened_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, store_id, id),
  UNIQUE (tenant_id, store_id, name),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, closed_by_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, reopened_by_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT,
  CHECK (start_date <= end_date),
  CHECK (
    (status = 'CLOSED' AND closed_at IS NOT NULL AND closed_by_user_id IS NOT NULL)
    OR
    (status <> 'CLOSED' AND closed_at IS NULL AND closed_by_user_id IS NULL)
  ),
  CHECK ((reopened_at IS NULL) = (reopened_by_user_id IS NULL)),
  CHECK (length(btrim(name)) BETWEEN 1 AND 80)
);

CREATE INDEX fiscal_periods_store_dates_idx
  ON fiscal_periods (tenant_id, store_id, start_date, end_date);

CREATE TABLE posting_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL,
  rule_key VARCHAR(100) NOT NULL,
  version VARCHAR(40) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_reference TEXT,
  approved_by_user_id UUID,
  approved_at TIMESTAMPTZ,
  status accounting_rule_status NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, store_id, id),
  UNIQUE (tenant_id, store_id, rule_key, version),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, approved_by_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT,
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (
    (status = 'DRAFT' AND approved_by_user_id IS NULL AND approved_at IS NULL)
    OR
    (status IN ('APPROVED', 'RETIRED')
      AND approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CHECK (length(btrim(rule_key)) BETWEEN 1 AND 100),
  CHECK (length(btrim(version)) BETWEEN 1 AND 40)
);

CREATE INDEX posting_rule_versions_effective_idx
  ON posting_rule_versions (tenant_id, store_id, rule_key, effective_from);

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL,
  period_id UUID NOT NULL,
  entry_number BIGINT,
  entry_date DATE NOT NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'IRR',
  status accounting_journal_status NOT NULL DEFAULT 'DRAFT',
  source_type VARCHAR(50) NOT NULL,
  source_id UUID,
  posting_purpose VARCHAR(50) NOT NULL,
  posting_rule_version_id UUID,
  idempotency_key VARCHAR(128) NOT NULL,
  reverses_entry_id UUID,
  description TEXT,
  created_by_user_id UUID NOT NULL,
  posted_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at TIMESTAMPTZ,
  request_id UUID,
  UNIQUE (tenant_id, store_id, id),
  UNIQUE (tenant_id, store_id, idempotency_key),
  UNIQUE (tenant_id, store_id, reverses_entry_id),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, store_id, period_id)
    REFERENCES fiscal_periods (tenant_id, store_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, store_id, posting_rule_version_id)
    REFERENCES posting_rule_versions (tenant_id, store_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, store_id, reverses_entry_id)
    REFERENCES journal_entries (tenant_id, store_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, created_by_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, posted_by_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT,
  CHECK (currency_code = 'IRR'),
  CHECK (entry_number IS NULL OR entry_number > 0),
  CHECK (length(btrim(source_type)) BETWEEN 1 AND 50),
  CHECK (length(btrim(posting_purpose)) BETWEEN 1 AND 50),
  CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 128),
  CHECK (
    (source_type = 'MANUAL' AND source_id IS NULL
      AND posting_rule_version_id IS NULL)
    OR
    (source_type <> 'MANUAL' AND source_id IS NOT NULL
      AND posting_rule_version_id IS NOT NULL)
  ),
  CHECK (reverses_entry_id IS NULL OR reverses_entry_id <> id),
  CHECK (
    (status = 'DRAFT' AND entry_number IS NULL
      AND posted_at IS NULL AND posted_by_user_id IS NULL)
    OR
    (status = 'POSTED' AND entry_number IS NOT NULL
      AND posted_at IS NOT NULL AND posted_by_user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX journal_entries_store_number_uq
  ON journal_entries (tenant_id, store_id, entry_number)
  WHERE entry_number IS NOT NULL;
CREATE UNIQUE INDEX journal_entries_source_purpose_uq
  ON journal_entries (tenant_id, store_id, source_type, source_id, posting_purpose)
  WHERE source_id IS NOT NULL;
CREATE INDEX journal_entries_store_date_idx
  ON journal_entries (tenant_id, store_id, entry_date, entry_number);
CREATE INDEX journal_entries_store_period_status_idx
  ON journal_entries (tenant_id, store_id, period_id, status);

CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL,
  journal_entry_id UUID NOT NULL,
  line_number SMALLINT NOT NULL,
  account_id UUID NOT NULL,
  account_code_snapshot VARCHAR(32) NOT NULL,
  account_name_key_snapshot VARCHAR(120) NOT NULL,
  account_type_snapshot accounting_account_type NOT NULL,
  normal_balance_snapshot accounting_normal_balance NOT NULL,
  description TEXT,
  debit_irr BIGINT NOT NULL DEFAULT 0,
  credit_irr BIGINT NOT NULL DEFAULT 0,
  dimensions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, store_id, journal_entry_id, line_number),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, store_id, journal_entry_id)
    REFERENCES journal_entries (tenant_id, store_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, store_id, account_id)
    REFERENCES accounts (tenant_id, store_id, id) ON DELETE RESTRICT,
  CHECK (line_number > 0),
  CHECK (debit_irr >= 0 AND credit_irr >= 0),
  CHECK (
    (debit_irr > 0 AND credit_irr = 0)
    OR
    (credit_irr > 0 AND debit_irr = 0)
  ),
  CHECK (length(btrim(account_code_snapshot)) BETWEEN 1 AND 32),
  CHECK (length(btrim(account_name_key_snapshot)) BETWEEN 1 AND 120)
);

CREATE INDEX journal_lines_store_account_idx
  ON journal_lines (tenant_id, store_id, account_id, journal_entry_id);
CREATE INDEX journal_lines_entry_line_idx
  ON journal_lines (tenant_id, store_id, journal_entry_id, line_number);

CREATE TABLE accounting_sequences (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL,
  next_entry_number BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, store_id),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores (tenant_id, id) ON DELETE RESTRICT,
  CHECK (next_entry_number > 0)
);

CREATE TABLE accounting_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL,
  actor_user_id UUID,
  command_id UUID NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, actor_user_id)
    REFERENCES tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, store_id, command_id, event_type),
  CHECK (length(btrim(event_type)) BETWEEN 1 AND 80),
  CHECK (length(btrim(entity_type)) BETWEEN 1 AND 50)
);

CREATE INDEX accounting_audit_store_time_idx
  ON accounting_audit_events (tenant_id, store_id, occurred_at DESC);
CREATE INDEX accounting_audit_entity_idx
  ON accounting_audit_events (tenant_id, store_id, entity_type, entity_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION accounting_prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION 'Accounting audit events are append-only'
    USING ERRCODE = '55000';
END;
$function$;

CREATE TRIGGER accounting_audit_immutable_trg
  BEFORE UPDATE OR DELETE ON accounting_audit_events
  FOR EACH ROW EXECUTE FUNCTION accounting_prevent_audit_mutation();

CREATE OR REPLACE FUNCTION accounting_protect_approved_posting_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status IN ('APPROVED', 'RETIRED') THEN
    RAISE EXCEPTION 'Approved posting rule versions are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'RETIRED' THEN
      RAISE EXCEPTION 'Retired posting rule versions are immutable'
        USING ERRCODE = '55000';
    END IF;

    IF OLD.status = 'APPROVED'
       AND (
         NEW.rule_key IS DISTINCT FROM OLD.rule_key
         OR NEW.version IS DISTINCT FROM OLD.version
         OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
         OR NEW.effective_to IS DISTINCT FROM OLD.effective_to
         OR NEW.configuration IS DISTINCT FROM OLD.configuration
         OR NEW.source_reference IS DISTINCT FROM OLD.source_reference
       ) THEN
      RAISE EXCEPTION 'Approved posting rule configuration is immutable'
        USING ERRCODE = '55000';
    END IF;

    IF NEW.status = 'APPROVED'
       AND current_user <> 'marketfa_accounting_owner' THEN
      RAISE EXCEPTION 'Only the accounting command owner can approve posting rules'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

CREATE TRIGGER posting_rule_versions_immutable_trg
  BEFORE UPDATE OR DELETE ON posting_rule_versions
  FOR EACH ROW EXECUTE FUNCTION accounting_protect_approved_posting_rule();

CREATE OR REPLACE FUNCTION accounting_prevent_posted_journal_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'POSTED' THEN
      RAISE EXCEPTION 'Posted journal entries are immutable'
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'POSTED' THEN
    RAISE EXCEPTION 'Posted journal entries are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.status = 'POSTED'
     AND current_user <> 'marketfa_accounting_owner' THEN
    RAISE EXCEPTION 'Only the accounting command owner can post journals'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER journal_entries_immutable_trg
  BEFORE INSERT OR UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION accounting_prevent_posted_journal_mutation();

CREATE OR REPLACE FUNCTION accounting_prevent_posted_line_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  parent_status accounting_journal_status;
  parent_tenant_id UUID;
  parent_store_id UUID;
  parent_entry_id UUID;
BEGIN
  IF current_user <> 'marketfa_accounting_owner' THEN
    RAISE EXCEPTION 'Journal lines require the accounting command boundary'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    parent_tenant_id := OLD.tenant_id;
    parent_store_id := OLD.store_id;
    parent_entry_id := OLD.journal_entry_id;
  ELSE
    parent_tenant_id := NEW.tenant_id;
    parent_store_id := NEW.store_id;
    parent_entry_id := NEW.journal_entry_id;
  END IF;

  SELECT entry.status
  INTO parent_status
  FROM public.journal_entries AS entry
  WHERE entry.tenant_id = parent_tenant_id
    AND entry.store_id = parent_store_id
    AND entry.id = parent_entry_id;

  IF parent_status = 'POSTED' THEN
    RAISE EXCEPTION 'Lines of posted journals are immutable'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER journal_lines_immutable_trg
  BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION accounting_prevent_posted_line_mutation();

CREATE OR REPLACE FUNCTION accounting_prevent_used_account_reclassification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF (NEW.account_type IS DISTINCT FROM OLD.account_type
      OR NEW.normal_balance IS DISTINCT FROM OLD.normal_balance)
     AND EXISTS (
       SELECT 1
       FROM public.journal_lines AS line
       JOIN public.journal_entries AS entry
         ON entry.tenant_id = line.tenant_id
        AND entry.store_id = line.store_id
        AND entry.id = line.journal_entry_id
       WHERE line.tenant_id = OLD.tenant_id
         AND line.store_id = OLD.store_id
         AND line.account_id = OLD.id
         AND entry.status = 'POSTED'
     ) THEN
    RAISE EXCEPTION 'Used account classification cannot be changed'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER accounts_classification_immutable_trg
  BEFORE UPDATE OF account_type, normal_balance ON accounts
  FOR EACH ROW EXECUTE FUNCTION accounting_prevent_used_account_reclassification();

CREATE OR REPLACE FUNCTION accounting_validate_period_nonoverlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.start_date > NEW.end_date THEN
    RAISE EXCEPTION 'Fiscal period start date must not be after end date'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.store_id::TEXT, 0));

  IF EXISTS (
    SELECT 1
    FROM public.fiscal_periods AS period
    WHERE period.tenant_id = NEW.tenant_id
      AND period.store_id = NEW.store_id
      AND period.id <> NEW.id
      AND daterange(period.start_date, period.end_date, '[]')
          && daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'Fiscal periods cannot overlap within a store'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER fiscal_periods_nonoverlap_trg
  BEFORE INSERT OR UPDATE OF start_date, end_date, store_id ON fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION accounting_validate_period_nonoverlap();

CREATE OR REPLACE FUNCTION accounting_assert_posted_journal()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  line_count BIGINT;
  debit_total NUMERIC;
  credit_total NUMERIC;
  period_state accounting_period_status;
  original_status accounting_journal_status;
  original_currency CHAR(3);
  mismatch_count BIGINT;
BEGIN
  SELECT count(*), COALESCE(sum(line.debit_irr), 0), COALESCE(sum(line.credit_irr), 0)
  INTO line_count, debit_total, credit_total
  FROM public.journal_lines AS line
  WHERE line.tenant_id = NEW.tenant_id
    AND line.store_id = NEW.store_id
    AND line.journal_entry_id = NEW.id;

  IF line_count < 2 OR debit_total <= 0 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'Posted journal must contain at least two balanced lines'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.journal_lines AS line
    JOIN public.accounts AS account
      ON account.tenant_id = line.tenant_id
     AND account.store_id = line.store_id
     AND account.id = line.account_id
    WHERE line.tenant_id = NEW.tenant_id
      AND line.store_id = NEW.store_id
      AND line.journal_entry_id = NEW.id
      AND (
        account.status <> 'ACTIVE'
        OR account.is_postable = FALSE
        OR account.code IS DISTINCT FROM line.account_code_snapshot
        OR account.name_key IS DISTINCT FROM line.account_name_key_snapshot
        OR account.account_type IS DISTINCT FROM line.account_type_snapshot
        OR account.normal_balance IS DISTINCT FROM line.normal_balance_snapshot
      )
  ) THEN
    RAISE EXCEPTION 'Posted journal lines require active postable accounts'
      USING ERRCODE = '23514';
  END IF;

  SELECT period.status
  INTO period_state
  FROM public.fiscal_periods AS period
  WHERE period.tenant_id = NEW.tenant_id
    AND period.store_id = NEW.store_id
    AND period.id = NEW.period_id;

  IF period_state IS DISTINCT FROM 'OPEN' THEN
    RAISE EXCEPTION 'Journal cannot post to a non-open fiscal period'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.reverses_entry_id IS NOT NULL THEN
    SELECT original.status, original.currency_code
    INTO original_status, original_currency
    FROM public.journal_entries AS original
    WHERE original.tenant_id = NEW.tenant_id
      AND original.store_id = NEW.store_id
      AND original.id = NEW.reverses_entry_id;

    IF original_status IS DISTINCT FROM 'POSTED'
       OR original_currency IS DISTINCT FROM NEW.currency_code THEN
      RAISE EXCEPTION 'Reversal must reference a posted journal in the same currency'
        USING ERRCODE = '23514';
    END IF;

    SELECT count(*)
    INTO mismatch_count
    FROM public.journal_lines AS original_line
    FULL JOIN public.journal_lines AS reversal_line
      ON reversal_line.tenant_id = NEW.tenant_id
     AND reversal_line.store_id = NEW.store_id
     AND reversal_line.journal_entry_id = NEW.id
     AND reversal_line.line_number = original_line.line_number
    WHERE original_line.tenant_id = NEW.tenant_id
      AND original_line.store_id = NEW.store_id
      AND original_line.journal_entry_id = NEW.reverses_entry_id
      AND (
        reversal_line.id IS NULL
        OR reversal_line.account_id IS DISTINCT FROM original_line.account_id
        OR reversal_line.debit_irr IS DISTINCT FROM original_line.credit_irr
        OR reversal_line.credit_irr IS DISTINCT FROM original_line.debit_irr
        OR reversal_line.account_code_snapshot IS DISTINCT FROM original_line.account_code_snapshot
        OR reversal_line.account_name_key_snapshot IS DISTINCT FROM original_line.account_name_key_snapshot
        OR reversal_line.account_type_snapshot IS DISTINCT FROM original_line.account_type_snapshot
        OR reversal_line.normal_balance_snapshot IS DISTINCT FROM original_line.normal_balance_snapshot
        OR reversal_line.dimensions IS DISTINCT FROM original_line.dimensions
      );

    IF mismatch_count <> 0 OR EXISTS (
      SELECT 1
      FROM public.journal_lines AS reversal_line
      LEFT JOIN public.journal_lines AS original_line
        ON original_line.tenant_id = NEW.tenant_id
       AND original_line.store_id = NEW.store_id
       AND original_line.journal_entry_id = NEW.reverses_entry_id
       AND original_line.line_number = reversal_line.line_number
      WHERE reversal_line.tenant_id = NEW.tenant_id
        AND reversal_line.store_id = NEW.store_id
        AND reversal_line.journal_entry_id = NEW.id
        AND original_line.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Full reversal must exactly invert the original journal lines'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

CREATE CONSTRAINT TRIGGER journal_entries_posted_balance_ct
  AFTER INSERT OR UPDATE ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW.status = 'POSTED')
  EXECUTE FUNCTION accounting_assert_posted_journal();

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY accounts_app_read ON accounts
  FOR SELECT TO marketfa_app
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY accounts_command_owner_all ON accounts
  FOR ALL TO marketfa_accounting_owner
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods FORCE ROW LEVEL SECURITY;
CREATE POLICY fiscal_periods_app_read ON fiscal_periods
  FOR SELECT TO marketfa_app
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY fiscal_periods_command_owner_all ON fiscal_periods
  FOR ALL TO marketfa_accounting_owner
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE posting_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_rule_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY posting_rules_app_read ON posting_rule_versions
  FOR SELECT TO marketfa_app
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY posting_rules_command_owner_all ON posting_rule_versions
  FOR ALL TO marketfa_accounting_owner
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY journal_entries_app_read ON journal_entries
  FOR SELECT TO marketfa_app
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY journal_entries_command_owner_all ON journal_entries
  FOR ALL TO marketfa_accounting_owner
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY journal_lines_app_read ON journal_lines
  FOR SELECT TO marketfa_app
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY journal_lines_command_owner_all ON journal_lines
  FOR ALL TO marketfa_accounting_owner
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE accounting_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_sequences FORCE ROW LEVEL SECURITY;
CREATE POLICY accounting_sequences_app_read ON accounting_sequences
  FOR SELECT TO marketfa_app
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY accounting_sequences_command_owner_all ON accounting_sequences
  FOR ALL TO marketfa_accounting_owner
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

ALTER TABLE accounting_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY accounting_audit_app_read ON accounting_audit_events
  FOR SELECT TO marketfa_app
  USING (tenant_id = app_current_tenant_id());
CREATE POLICY accounting_audit_command_owner_all ON accounting_audit_events
  FOR ALL TO marketfa_accounting_owner
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

GRANT USAGE ON SCHEMA public TO marketfa_accounting_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  accounts,
  fiscal_periods,
  posting_rule_versions,
  journal_entries,
  journal_lines,
  accounting_sequences,
  accounting_audit_events
TO marketfa_accounting_owner;

GRANT SELECT ON
  accounts,
  fiscal_periods,
  posting_rule_versions,
  journal_entries,
  journal_lines,
  accounting_sequences,
  accounting_audit_events
TO marketfa_app;
