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

ALTER TABLE user_sessions
  ADD CONSTRAINT user_sessions_user_id_id_uq UNIQUE (user_id, id);

ALTER TABLE user_sessions
  DROP CONSTRAINT user_sessions_rotation_parent_id_fkey,
  ADD CONSTRAINT user_sessions_rotation_same_user_fk
    FOREIGN KEY (user_id, rotation_parent_id)
    REFERENCES user_sessions (user_id, id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT user_sessions_rotation_not_self_ck
    CHECK (rotation_parent_id IS NULL OR rotation_parent_id <> id),
  ADD CONSTRAINT user_sessions_last_seen_after_creation_ck
    CHECK (last_seen_at IS NULL OR last_seen_at >= created_at),
  ADD CONSTRAINT user_sessions_revoked_after_creation_ck
    CHECK (revoked_at IS NULL OR revoked_at >= created_at);

ALTER TABLE terminals
  ADD CONSTRAINT terminals_revocation_state_ck
  CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL));

ALTER TABLE terminal_assignments
  ADD CONSTRAINT terminal_assignments_revoked_after_assignment_ck
  CHECK (revoked_at IS NULL OR revoked_at >= assigned_at);

CREATE UNIQUE INDEX terminal_assignments_one_active_user_terminal_uq
  ON terminal_assignments (tenant_id, store_id, terminal_id, user_id)
  WHERE revoked_at IS NULL;

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
