-- Keep tenant administration fail-closed until dedicated, permission-checked
-- application commands are implemented. Tenant membership alone must not grant
-- the ability to invite users, change roles, or register/revoke POS terminals.

REVOKE INSERT, UPDATE, DELETE ON
  tenants,
  stores,
  tenant_memberships,
  tenant_invitations,
  terminals,
  terminal_assignments
FROM marketfa_app;
