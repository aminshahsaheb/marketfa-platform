# ADR 0011: Tenant Administration Through Atomic Database Commands

- **Status:** Accepted; tenant bootstrap, invitation, membership and terminal lifecycle commands are implemented and merged. Authentication-provider integration and browser login remain open.
- **Date:** 2026-10-31

## Context

Tenant administration changes security boundaries. Direct writes to tenant administration tables are intentionally revoked from the ordinary application role. These workflows require atomic audit, replay protection, same-tenant references, immediate access changes and last-active-OWNER protection.

## Decision

### Database command boundary

- Keep direct INSERT/UPDATE/DELETE privileges on tenant administration tables revoked from `marketfa_app`.
- Use narrowly scoped PostgreSQL command functions owned by dedicated non-login, non-superuser, non-BYPASSRLS roles where database-level command enforcement is required.
- Use fixed safe `search_path` and fully qualified object names in SECURITY DEFINER functions.
- Revoke EXECUTE from PUBLIC and grant only intended functions to the runtime role.
- Validate actor, active tenant, membership, permission, role limits and state transitions inside each command.
- Derive actor and tenant from trusted server-side context; reject mismatches.
- Write audit in the same transaction. Never store raw invitation or terminal secrets in audit metadata.
- Keep DTO validation, authentication, rate limits and HTTP error mapping in the API.

### Implemented lifecycle commands

1. **Tenant bootstrap:** create tenant, first store and OWNER membership atomically.
2. **Invitations:** create, revoke and accept; store token hashes, enforce expiry and verified identity binding, prevent replay/concurrent double acceptance.
3. **Membership:** change role, suspend and remove; protect the last active OWNER.
4. **Terminal:** register, rotate, suspend, reactivate and revoke credentials; store only hashes and audit consequential changes.

### Remaining identity work

- Authentication provider and account proofing.
- Login/logout, recovery, secure cookie issuance/clearing and browser integration.
- Invitation delivery provider and abuse/rate controls.
- Terminal device authentication at the request boundary and sync enforcement.

### Security boundary

Transaction-local PostgreSQL custom settings are not non-forgeable identity assertions against arbitrary SQL executed with the runtime credential. RLS and command functions protect against application mistakes and missing scope. The API remains trusted: no client DB credentials, no arbitrary SQL, parameterized queries and actor IDs derived only from validated sessions.

## Consequences

- Tenant administration is command-oriented, not generic CRUD.
- PostgreSQL integration tests use actual runtime roles and connection pools.
- Tests cover permission denial, last-owner protection, invitation replay/concurrency, identity binding, same-tenant FKs, immediate access loss, terminal revocation and atomic audit.
- Authentication provider and login method remain separate product decisions.
