# Identity, Tenancy, Business Profiles and Locations

**Status:** Tenant/RLS foundation, provider-neutral session core, actor/CSRF guards, atomic tenant bootstrap, invitation lifecycle, membership lifecycle, terminal lifecycle and HTTP authorization matrix are merged. Authentication-provider integration, browser login/recovery, invitation delivery/abuse controls, device authentication and sync remain open.

## 1. Core concepts

- **User:** global human identity. A user may belong to multiple tenants.
- **Tenant:** workspace/security and commercial-customer boundary.
- **Membership:** a user's authorization relationship with a tenant.
- **Business profile:** a versioned operating business with an industry template and configured capabilities.
- **Business location:** a physical branch, office, workshop, project site, virtual operation or service area.
- **Store:** optional retail/POS concept. It must not be required for a service or project business.
- **Terminal:** registered device assigned to a supported location and workflow.
- **Accounting book:** ledger boundary for a legal/accounting entity; it is not automatically identical to a store.
- **Session:** authenticated server-side session for one user.

Do not equate user, tenant, membership, business profile, location, store, terminal, accounting book and session IDs. They represent different concepts and may have different security and lifecycle rules.

## 2. Target relationship model

`User → Membership → Tenant → BusinessProfile → BusinessLocation`

Optional operational relationships:

- Business location → Store/POS configuration.
- Store/location → Terminal assignments.
- Business profile/legal entity → one or more AccountingBooks, subject to approved accounting policy.
- Operational documents → explicit profile and location scope where relevant.
- Journals → AccountingBook, with location/source dimensions where appropriate.

The current M2 schema is tenant/store-centric. The multi-industry proposal must not be merged until its forced-store bootstrap and store-scoped accounting assumptions are reconciled with this target model.

## 3. Membership and permission model

Initial fixed roles:

- OWNER
- MANAGER
- CASHIER
- ACCOUNTANT
- VIEWER

Roles are server-owned. Every use case checks a named permission. Industry selection does not grant a role. A user may have different roles in different tenants. Custom roles and complex multi-role composition remain deferred until pilot evidence requires them.

## 4. Tenant resolution and authorization

1. Authenticate the server-side session and resolve the actor.
2. Read tenant/profile/location selectors from the route or request.
3. Verify active membership and tenant status.
4. Verify the business profile and location belong to the tenant and are active.
5. Resolve role and named permission server-side.
6. Begin a database transaction and set transaction-local scope.
7. Execute module repositories with explicit tenant/profile/location predicates.
8. Return only data within the authorized scope.

Never trust tenant_id, profile_id, role, user_id or location_id in a command body as proof of authorization.

## 5. PostgreSQL isolation

- Tenant-owned rows carry tenant_id.
- Profile-owned rows carry tenant_id and business_profile_id where appropriate.
- Location-specific rows also carry location_id.
- Composite foreign keys prevent cross-tenant/profile/location references.
- RLS is enabled for tenant-owned tables where it provides defense in depth.
- Runtime roles are non-superuser and have no BYPASSRLS.
- Migrations use a separate privileged connection.
- Tenant context is transaction-local; pooled connections must not retain scope.
- Background jobs establish fresh actor/system and tenant context for every job.
- Cross-tenant administration uses a separate, explicit and audited path.

Custom PostgreSQL settings are not non-forgeable identity assertions against arbitrary SQL under the runtime credential. Never expose DB credentials to clients or permit arbitrary SQL. RLS does not replace API authorization.

## 6. Business-profile and capability rules

Industry profiles are versioned templates. They suggest capabilities; they do not grant legal permission, commercial entitlement or actor authorization.

The server must check:

1. deployed release supports the capability;
2. profile version permits it;
3. dependencies and setup are complete;
4. tenant entitlement permits it, where applicable;
5. actor has the named permission;
6. location and accounting-book scope are valid;
7. jurisdiction requirements are satisfied;
8. required specialist approval exists.

Keep suggested, available, enabled, suspended and retired states distinct. Regulated profile selection must not activate regulated workflows without the required review.

## 7. Database command boundary

Tenant creation, profile changes, location creation, membership changes, invitations, capability activation and terminal administration are security-sensitive commands. Do not grant broad table writes to the ordinary application role.

Use narrowly scoped application services and, where needed, PostgreSQL command functions with fixed safe search_path, fully qualified objects, actor/scope validation, state-transition checks, atomic audit and minimal return values. Revoke EXECUTE from PUBLIC and grant only intended runtime permissions.

## 8. MVP and migration

The existing MVP policy scopes onboarding to one store per tenant. This is a product limitation, not the final multi-industry model. Before the first multi-industry schema merge:

- decide whether one tenant may contain multiple profiles;
- add a generic business-location concept;
- keep store/POS optional;
- decide accounting-book ownership independent from store;
- preserve old store IDs and historical records through an explicit migration;
- test old retail tenant backfill and non-retail onboarding separately.

Do not create a fake store merely to let a service business use finance.

## 9. Release gates

- Cross-tenant and cross-profile access tests for every API family.
- Location/store/accounting-book scope tests.
- Role and capability authorization matrix.
- Session expiry, revocation and recovery tests.
- Invitation identity binding, replay and concurrency tests.
- Terminal authentication and immediate revocation tests before sync.
- Audit of privileged changes.
- PostgreSQL tests using actual runtime roles and connection pools.
