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
- Runtime DB role is non-superuser and has no BYPASSRLS; migration role is separate.
- Composite foreign keys enforce same-tenant references.
- Background jobs establish context per job.
- The MVP creates one store per tenant, but the schema does not permanently forbid multiple stores.

## Consequences
- Tenant queries must use explicit transactions.
- RLS policies and pool behavior require real PostgreSQL tests.
- No direct unscoped tenant repository calls are permitted.
- Cross-tenant administrative operations require a separate, explicit, audited privilege path.
