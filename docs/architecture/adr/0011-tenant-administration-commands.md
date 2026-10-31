# ADR 0011: Tenant Administration Through Atomic Database Commands

- **Status:** Accepted; atomic tenant bootstrap and invitation lifecycle commands implemented, membership/terminal commands pending M2
- **Date:** 2026-10-31

## Context

The tenant schema is in place, but direct writes to tenant administration tables are intentionally revoked from `marketfa_app`. Tenant bootstrap, invitations, membership changes, and terminal administration affect security boundaries and must not become ordinary CRUD endpoints.

The system also requires atomic audit records, one-time invitation acceptance, same-tenant references, immediate access changes, and protection against removal of the last active OWNER.

## Decision

### Database command boundary

- Keep direct INSERT/UPDATE/DELETE privileges on tenant administration tables revoked from `marketfa_app`.
- Implement narrowly scoped PostgreSQL command functions owned by a dedicated non-login, non-superuser, non-BYPASSRLS role.
- Each function uses `SECURITY DEFINER`, a fixed safe `search_path`, and fully qualified object names.
- Revoke EXECUTE from PUBLIC. Grant only the required functions to the runtime role.
- Validate actor, active tenant, membership, permission, role limits, and state transitions inside each command.
- Derive actor and tenant from transaction-local context supplied by the trusted API boundary. Reject a command if its explicit tenant does not match that context.
- Write audit events in the same transaction as the state change. Do not include raw invitation or terminal secrets in audit metadata.
- Keep DTO validation, authentication, rate limits, and HTTP error mapping in the API layer.

### Initial commands

1. **Bootstrap tenant:** create a tenant, its first store, and the creator's OWNER membership in one transaction. The creator must be an active authenticated user.
2. **Invitations:** create, revoke, and accept invitations. Generate high-entropy tokens, store only hashes, enforce expiry, intended verified identity where supplied, and one-time acceptance under concurrency.
3. **Membership lifecycle:** change role, suspend, and remove memberships. Only OWNER can administer memberships under the initial permission map. Do not grant OWNER through an ordinary invitation. Prevent suspension/removal of the last active OWNER.
4. **Ownership transfer:** use a separate two-party confirmation flow with recent authentication and audit.
5. **Terminal lifecycle:** register, rotate, suspend, and revoke credentials. Store only hashes. Enforce tenant/store consistency and immediate revocation.

### Role grant policy

- OWNER may invite MANAGER, CASHIER, ACCOUNTANT, or VIEWER.
- OWNER assignment and transfer are not ordinary invitation roles.
- MANAGER and other roles cannot administer memberships unless the permission map changes through a reviewed decision.
- Role changes take effect on the next request. Membership removal or suspension denies tenant access immediately, even when the global session remains valid.

### Security boundary

Transaction-local PostgreSQL custom settings are not non-forgeable identity assertions against arbitrary SQL executed with the runtime credential. RLS and command functions protect against application mistakes and missing scope. The API remains a trusted boundary: no client database credentials, no arbitrary SQL, parameterized queries, and actor IDs derived only from validated sessions.

## Consequences

- Tenant administration is command-oriented, not generic CRUD.
- Integration tests must run against PostgreSQL using the actual runtime role and pool.
- Tests must cover permission denial, last-owner protection, invitation replay/concurrency, identity binding, same-tenant FKs, immediate access loss, terminal revocation, and atomic audit.
- Authentication provider and login method remain separate product decisions. Tenant command implementation can use the provider-neutral session actor boundary.
