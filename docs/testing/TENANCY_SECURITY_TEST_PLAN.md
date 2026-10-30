# Tenant Isolation and Identity Verification Plan

**Status:** Required M2 test specification; a first PostgreSQL integration slice is implemented on `feat/m2-tenant-core`. Full authorization, session, invitation, worker and API-level coverage remains pending.

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
- Token is one-time and replay fails under concurrency.
- Role grant cannot exceed inviter's permission.
- Invitation is bound to intended identity where configured.
- Concurrent acceptance creates one membership only.

## Terminal tests

- Terminal secret is never stored or returned after creation.
- Revoked/rotated terminal credential fails immediately.
- Terminal from store A cannot send commands to store B.
- Terminal identity is separate from cashier actor identity.

## Evidence

Run against PostgreSQL with the actual runtime DB role and connection pool. Retain migration version, DB version, test command, report, and date. Mocks alone do not prove RLS or FK isolation.
