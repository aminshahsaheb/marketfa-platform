# Tenant Isolation and Identity Verification Plan

**Status:** Required M2 test specification. The PostgreSQL integration slice now covers cross-tenant visibility across users, identities, sessions, tenants, stores, memberships, invitations, terminals, assignments and audit events; write denial through application privileges/RLS; transaction-local context reset and tenant switching on pooled connection reuse; selected composite-FK checks; audit actor attribution; session lifecycle; atomic tenant bootstrap; and invitation create/revoke/accept with token-hash storage, verified-identity binding, concurrent one-time acceptance, role denial, and audit. The HTTP authorization matrix for current tenant-admin endpoints is merged in PR #20; worker and remaining business-endpoint coverage remain pending.

## PostgreSQL isolation tests

- User in tenant A cannot read tenant B row by guessed UUID.
- User in tenant A cannot create, update, delete, export or aggregate tenant B data.
- Cross-tenant store/account/source foreign keys fail.
- RLS blocks unscoped SELECT/UPDATE/DELETE for runtime DB role.
- Missing tenant context returns no tenant rows and rejects writes.
- Transaction-local tenant setting does not leak through pooled connection reuse.
- Background worker sets tenant context per job; context is cleared on transaction completion.
- Migration role is distinct from runtime role and never used by API request handling.
- Runtime login has no inherited application table privileges; the API explicitly switches to the NOLOGIN application role inside the transaction.
- Audit insert policy rejects an actor ID different from the transaction actor.
- Terminal assignment composite foreign key rejects a terminal/store mismatch.
- Session rotation foreign key rejects a parent session belonging to another user.
- Ordinary runtime cannot execute the session-creation function; the separate auth-runtime role can execute it but cannot read/write session tables directly.
- Auth-runtime resolves only verified provider identities; unverified or inactive identities cannot issue sessions.
- Session API stores only a SHA-256 hash of the 256-bit raw token.
- Session resolve enforces active user, absolute expiry, and idle expiry.
- Session rotation revokes the parent and creates a same-user child atomically.
- Reuse of a rotated parent token revokes the descendant session family.
- User deactivation revokes all active sessions; reactivation does not revive them.

## Authorization matrix

For each role (OWNER, MANAGER, CASHIER, ACCOUNTANT, VIEWER), test allowed and denied use cases:

- invite member, change role, suspend member, transfer ownership;
- create/edit product, receive purchase, adjust stock;
- create sale, discount, refund, close shift;
- view ledger, create manual journal, approve journal, close period;
- view/export reports and backups.

Test API endpoints directly; do not rely on UI hiding controls.

## Session and membership tests

- Expired, revoked, malformed, and rotated session tokens fail.
- Logout revokes session.
- Suspended user and removed membership lose access immediately.
- Changing active tenant requires a current membership.
- Role change affects the next request, not only the next login.
- CSRF/origin protections reject unauthorized state-changing cookie requests.
- Login/recovery rate limits and anti-enumeration behavior are verified.

## Invitation tests

- Expired and revoked invitations fail.
- Raw token is returned once; only its SHA-256 hash is stored.
- Token is one-time and replay fails under concurrency.
- Role grant cannot exceed inviter's permission; OWNER cannot be granted by ordinary invitation.
- Invitation is bound to the intended verified identity.
- Revocation and acceptance are atomic and write audit events.
- Concurrent acceptance creates one membership only.
- Delivery provider and endpoint rate limiting are verified when selected and implemented.

## Terminal tests

- Only an active OWNER can list, register, rotate credentials, suspend, reactivate, or revoke a terminal.
- Terminal listing is tenant/store scoped and never returns credential hashes or raw credentials.
- Registration requires an active store in the selected tenant; cross-tenant or inactive stores fail closed.
- A 256-bit credential is returned only at registration/rotation; PostgreSQL stores only its SHA-256 hash.
- Credential rotation replaces the stored hash; the previous credential no longer matches.
- Suspension blocks the terminal state; reactivation is allowed only from SUSPENDED.
- Revoked terminals cannot rotate or reactivate; repeated suspend/activate/revoke commands are safe and do not create duplicate audit events.
- Revocation marks active terminal assignments revoked in the same transaction.
- Terminal lifecycle audit events are atomic and contain no raw credential or hash.
- Runtime role cannot write terminal/assignment tables directly; only the scoped command functions can perform administration.
- Terminal from store A cannot send commands to store B; terminal identity is separate from cashier actor identity.
- Device-authentication and sync endpoints must reject suspended/revoked terminals and are not yet implemented; last-seen update tests remain pending.

## Evidence

Run against PostgreSQL with the actual runtime DB role and connection pool. Retain migration version, DB version, test command, report, and date. Mocks alone do not prove RLS or FK isolation.
