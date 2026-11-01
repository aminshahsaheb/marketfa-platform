-- Keep immutable actor attribution after a tenant membership is removed.
-- Authorization is checked by commands and RLS at write time; historical rows
-- retain a stable reference to the user, not to a mutable membership record.

ALTER TABLE accounting_books
  DROP CONSTRAINT IF EXISTS accounting_books_tenant_id_created_by_user_id_fkey,
  ADD CONSTRAINT accounting_books_created_by_user_fk
    FOREIGN KEY (created_by_user_id)
    REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_tenant_id_created_by_user_id_fkey,
  ADD CONSTRAINT accounts_created_by_user_fk
    FOREIGN KEY (created_by_user_id)
    REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE fiscal_periods
  DROP CONSTRAINT IF EXISTS fiscal_periods_tenant_id_closed_by_user_id_fkey,
  DROP CONSTRAINT IF EXISTS fiscal_periods_tenant_id_reopened_by_user_id_fkey,
  ADD CONSTRAINT fiscal_periods_closed_by_user_fk
    FOREIGN KEY (closed_by_user_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fiscal_periods_reopened_by_user_fk
    FOREIGN KEY (reopened_by_user_id)
    REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE posting_rule_versions
  DROP CONSTRAINT IF EXISTS posting_rule_versions_tenant_id_approved_by_user_id_fkey,
  ADD CONSTRAINT posting_rule_versions_approved_by_user_fk
    FOREIGN KEY (approved_by_user_id)
    REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_tenant_id_created_by_user_id_fkey,
  DROP CONSTRAINT IF EXISTS journal_entries_tenant_id_posted_by_user_id_fkey,
  ADD CONSTRAINT journal_entries_created_by_user_fk
    FOREIGN KEY (created_by_user_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  ADD CONSTRAINT journal_entries_posted_by_user_fk
    FOREIGN KEY (posted_by_user_id)
    REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE accounting_audit_events
  DROP CONSTRAINT IF EXISTS accounting_audit_events_tenant_id_actor_user_id_fkey,
  ADD CONSTRAINT accounting_audit_events_actor_user_fk
    FOREIGN KEY (actor_user_id)
    REFERENCES users (id) ON DELETE RESTRICT;
