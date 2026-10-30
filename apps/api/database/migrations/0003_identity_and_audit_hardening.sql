-- Enforce store/terminal consistency and bind audit attribution to the
-- transaction-local actor supplied by the trusted API boundary.
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

DROP POLICY audit_events_current_tenant_insert ON audit_events;

CREATE POLICY audit_events_current_tenant_insert ON audit_events
  FOR INSERT
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND (actor_user_id IS NULL OR actor_user_id = app_current_user_id())
  );

REVOKE INSERT, UPDATE, DELETE ON
  users,
  auth_identities,
  user_sessions
FROM marketfa_app;
