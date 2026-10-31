# Identity, Tenancy, and Store Boundary

**Status:** Tenant/RLS foundation, provider-neutral session core, and request actor/CSRF guards are merged. PostgreSQL tests cover the current identity/tenancy schema. Authentication provider, HTTP login/session issuance, and tenant administration use cases remain open.  
**MVP policy:** one store per tenant in the first release; schema supports future multiple stores without assuming them in product scope.

## 1. Core concepts

- **User:** a human identity that may participate in more than one tenant.
- **Tenant:** the legal/business customer boundary. All tenant-owned data belongs to exactly one tenant.
- **Membership:** a user's authorization relationship with one tenant.
- **Store:** a physical or logical retail location owned by a tenant. The MVP UI/onboarding creates one store, but the data model does not make this a permanent database limitation.
- **Terminal:** a registered POS endpoint belonging to one store.
- **Session:** an authenticated server-side session for one user. Active tenant/store context is revalidated against current membership on every request.

Do not equate tenant, user, store, terminal, and session IDs. They represent different security boundaries.

## 2. Data ownership model

Logical entities:

- users
- auth_identities
- user_sessions
- tenants
- stores
- tenant_memberships
- tenant_invitations
- terminals
- terminal_assignments
- audit_events

Tenant-owned business tables carry tenant_id. Store-specific operational records also carry store_id. Composite unique keys and foreign keys enforce that a referenced store, membership, terminal, account, or source record belongs to the same tenant.

A user is global. User records must not contain a single tenant_id. A user can belong to multiple tenants through memberships.

## 3. Membership and role model

Initial fixed roles:

- OWNER
- MANAGER
- CASHIER
- ACCOUNTANT
- VIEWER

Roles are not arbitrary strings supplied by the client. A server-owned permission map defines allowed actions. Every application use case checks a named permission; hiding a button is not authorization.

Initial permission intent:

- OWNER: all store/tenant operations, invitations, role changes, financial reports, period-close approval, ownership transfer.
- MANAGER: catalog, purchasing, inventory, shifts, sales oversight, refunds within configured limits; cannot transfer ownership or close fiscal periods.
- CASHIER: assigned-terminal POS operations and own shift; refunds only with explicit permission/limit.
- ACCOUNTANT: financial read, reconciliation, controlled journal workflows; no POS cashier operations by default.
- VIEWER: read-only access to granted views.

A membership has one primary role in MVP. Custom roles and multi-role composition are deferred until real customer needs justify the added complexity.

## 4. Tenant resolution and authorization

1. Authenticate the session and resolve the user from the server-side session record.
2. Read the requested tenant/store selector from the route/header only as a selector.
3. Verify an active membership for that user and tenant.
4. Verify store belongs to that tenant and is active.
5. Resolve role and named permission server-side.
6. Begin a database transaction and set transaction-local tenant context.
7. Execute repository operations with explicit tenant scope.
8. Return only data within that authorized tenant/store.

Never trust tenant_id, role, user_id, or store_id in a command body as proof of authorization. The actor identity is derived from the session.

## 5. PostgreSQL isolation

Use defense in depth:

- Application repositories include tenant_id in every tenant-owned query.
- Composite foreign keys prevent cross-tenant references.
- PostgreSQL RLS is enabled for tenant-owned tables.
- Runtime database role is not a superuser and has no BYPASSRLS.
- Migrations run under a separate privileged role.
- RLS context is set transaction-locally using set_config('app.current_tenant_id', tenantId, true).
- Tenant-scoped data access must occur inside a transaction so pooled connections cannot leak session state.
- Background workers must establish tenant context per job and must not reuse a prior job's context.
- Cross-tenant administrative jobs use an explicit privileged path, separate from normal application requests, with audited authorization.

RLS is a second barrier, not a replacement for application-level permission checks. Test the actual PostgreSQL role and connection pool.

## 6. Tenant administration command boundary

Tenant creation, store creation, membership changes, invitations, and terminal administration are security-sensitive writes. Do not grant direct table-write privileges to the ordinary application role to implement these workflows.

Use narrowly scoped PostgreSQL command functions owned by a dedicated non-login, non-superuser, non-BYPASSRLS role. Each function must:

- use a fixed safe `search_path` and fully qualified table references;
- derive the actor and active tenant from transaction-local server context, and reject mismatches;
- validate active user, tenant, membership, named permission, and role-grant limits inside the command;
- enforce state transitions and same-tenant foreign-key invariants;
- write the audit event in the same transaction;
- return only the fields needed by the API;
- expose EXECUTE only to the intended runtime role; never expose function-owner credentials to the API.

Initial command set:

- **Bootstrap tenant:** create tenant, its first store, and the creator's OWNER membership atomically.
- **Invitation:** create, revoke, and accept a high-entropy one-time token; persist only its hash; bind to the intended verified identity when supplied; enforce expiry and replay safety.
- **Membership:** change role, suspend, or remove; prevent removal/suspension of the last active OWNER. Ownership transfer is a separate confirmation workflow.
- **Terminal:** register, rotate, suspend, and revoke credentials; store only hashes; audit each change.

The initial permission map gives membership administration to OWNER. A command must not allow a caller to grant OWNER through an ordinary invitation or grant a role above the caller's authority. Role changes and membership removal must affect the next request.

The API service remains responsible for validated session authentication, DTO validation, rate limits, and mapping command outcomes to HTTP responses. The database command boundary adds defense in depth; it does not make transaction-local custom settings a non-forgeable identity proof against arbitrary SQL under the runtime credential.

## 7. Invitations and membership lifecycle

Membership states: INVITED, ACTIVE, SUSPENDED, REMOVED.

Invitation:

- Random high-entropy token shown once; store only a cryptographic hash.
- Bind invitation to tenant, intended identity if known, role, inviter, expiry and status.
- Accept atomically; replay must fail.
- Inviter must hold the invite/manage-members permission and cannot grant a role above their authority.
- Ownership transfer is a dedicated two-party confirmation workflow with audit trail.
- Removing/suspending membership invalidates tenant access immediately, even if the user's global session remains valid.

## 8. Terminal/device boundary

- Terminal belongs to one store and tenant.
- Device credentials are high-entropy random secrets; store only a one-way hash.
- Support registration, rotation, revocation, last-seen, and audit.
- A revoked terminal cannot sync queued commands.
- Terminal identity does not imply cashier identity. Each sale still records the authenticated actor and terminal separately.
- Offline command permissions are separately constrained in the later sync design.

## 9. Data minimization and audit

Store only identity data required for login, recovery, legal/business records, and support. Keep authentication secrets out of audit metadata and logs. Record actor, tenant, store, action, entity, reason where required, timestamp, request ID, and result for security-sensitive operations.

## 10. Authentication method decision remains open

The architecture supports an AuthProvider boundary and normalized identities. Do not select SMS OTP, password, email link, or an external identity provider until the target operator's login/recovery needs, delivery reliability, abuse controls, and operating cost are validated.

Regardless of mechanism:

- Use opaque random session tokens; store token hashes only.
- Set cookies Secure, HttpOnly, and an appropriate SameSite policy.
- Rotate sessions after authentication and privilege changes.
- Revoke sessions on logout, credential reset, account suspension, and security events.
- Apply rate limits and anti-enumeration behavior to login/recovery.
- Use CSRF protection for cookie-authenticated state-changing requests.
- Require step-up confirmation for ownership transfer and high-risk security settings.
- Never log passwords, OTP values, session tokens, or device secrets.

## 11. M2 exit criteria

- Tenant, user, membership, store, terminal and session schemas migrated.
- Authenticated request context resolves actor and tenant on server.
- Fixed role/permission matrix implemented and tested.
- Tenant RLS and composite foreign keys active in PostgreSQL.
- Cross-tenant access tests pass for reads, writes, IDs, joins, exports, and background jobs.
- Membership removal and terminal revocation take effect immediately.
- Invitation acceptance is atomic and replay-safe.
- Audit events cover role, membership, session, terminal, and tenant-setting changes.
- No sensitive secrets appear in logs, error responses, or audit payloads.
