-- Enforce store/terminal consistency and prevent runtime impersonation in audit rows.
-- Authentication and tenant-administration writes remain disabled until their
-- dedicated, server-authorized commands are implemented.

ALTER TABLE terminals
  ADD CONSTRAINT terminals_tenant_store_id_uq
  UNIQUE (tenant_id, store_id, id);

ALTER TABLE terminal_assignments
  ADD CONSTRAINT terminal_assignments_same_store_terminal_fk
  FOREIGN KEY (tenant_id, store_id, terminal_id)
  REFERENCES terminals (tenant_id, store_id, id)
  ON DELETE CASCADE;

ALTER TABLE audit_events
  ADD CONSTRAINT audit_events_actor_matches_context_ck
  CHECK (
    actor_user_id IS NULL
    OR actor_user_id = app_current_user_id()
  );

REVOKE INSERT, UPDATE, DELETE ON
  users,
  auth_identities,
  user_sessions
FROM marketfa_app;
