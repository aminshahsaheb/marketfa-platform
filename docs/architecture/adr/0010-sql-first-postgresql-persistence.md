# ADR 0010: SQL-First PostgreSQL Persistence for Tenant and Financial Invariants

- **Status:** Accepted for the first release
- **Date:** 2026-10-30

## Context

MarketFa depends on PostgreSQL-specific guarantees: row-level security, transaction-local tenant context, composite foreign keys, immutable journal triggers, partial indexes, deferred constraints, and exact transaction boundaries. A generic ORM abstraction must not hide or weaken these controls.

## Decision

- Use versioned SQL migrations as the schema source of truth.
- Use the existing `pg` driver and explicit repository/application services for critical data access.
- Keep SQL parameterized; never interpolate untrusted values into query text.
- Centralize transaction creation, tenant context, membership verification, and role switching in the database boundary.
- Treat migrations as immutable after application; checksum every migration and reject checksum drift.
- Use a separate migration-owner connection and a non-superuser runtime role with no `BYPASSRLS`.
- Reconsider an ORM/query builder only when it materially improves maintainability without obscuring RLS, locking, or posting invariants.

## Consequences

- Developers must understand the SQL schema and write explicit typed query contracts.
- PostgreSQL integration tests are mandatory; SQLite and mocks cannot validate RLS.
- Migration review is a required code-review gate.
- No automatic Prisma model generation is assumed.
