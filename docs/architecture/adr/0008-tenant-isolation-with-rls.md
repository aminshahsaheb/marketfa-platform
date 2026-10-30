# ADR 0008: Tenant Isolation with Database-Enforced Boundaries

- **Status:** Accepted design baseline; implementation pending M1 and M2
- **Date:** 2026-10-30

## Context

MarketFa is a multi-tenant retail system. A query bug, guessed UUID, background job, or connection-pool context leak must not expose another tenant's data.

## Decision

- User is global; tenant membership is an explicit relation.
- Every tenant-owned business row carries tenant_id. Store-specific rows also carry store_id.
- Server derives tenant context from authenticated user membership; client tenant IDs are selectors only.
- Application repositories always scope by tenant.
- PostgreSQL RLS is defense in depth for tenant-owned tables.
- Set tenant context transaction-locally within every tenant-scoped transaction.
- Runtime login is non-superuser, has no BYPASSRLS, and is `NOINHERIT`; it must explicitly `SET LOCAL ROLE marketfa_app` inside each transaction. The application role is `NOLOGIN`, non-superuser, `NOBYPASSRLS`, and `NOINHERIT`; migration role is separate.
- Composite foreign keys enforce same-tenant references.
- Background jobs establish context per job.
- The MVP creates one store per tenant, but the schema does not permanently forbid multiple stores.

## Consequences

- Tenant queries must use explicit transactions.
- RLS policies and pool behavior require real PostgreSQL tests.
- No direct unscoped tenant repository calls are permitted.
- Cross-tenant administrative operations require a separate, explicit, audited privilege path.

## Security boundary clarification

The `app.current_user_id` and `app.current_tenant_id` values are transaction-local PostgreSQL settings supplied by the trusted API process. PostgreSQL RLS using these settings protects against missing tenant predicates and accidental unscoped repository queries. It does **not** authenticate those values against a caller that already has arbitrary SQL execution under the runtime database credential: such a caller can set different custom settings. Therefore:

- Never expose the runtime database credential to browsers, desktop clients, or POS terminals.
- Never accept arbitrary SQL or user-controlled SQL fragments in the API.
- Derive the actor only from a validated server-side session; never pass a request-body user ID as the actor.
- Treat SQL injection prevention, parameterized queries, narrow repositories, and API authorization as primary controls; RLS is defense in depth.
- A future stronger database-verifiable actor context requires a separately reviewed design (for example, a narrowly scoped SECURITY DEFINER context setter with a non-forgeable server assertion), not a claim that custom GUCs are intrinsically trusted.
