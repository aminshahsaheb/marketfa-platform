# ADR 0002: PostgreSQL Is the Authoritative Store

- **Status:** Accepted as initial direction
- **Date:** 2026-10-30

## Context
Financial and inventory operations require relational constraints, transactions, unique idempotency keys, and reliable joins/reporting.

## Decision
Use PostgreSQL as the authoritative server-side database. Use IndexedDB only as a bounded local cache and command queue. Use Prisma for schema and migrations, while retaining the option to use reviewed SQL for locking and specialized queries.

## Consequences
- Financial state is committed centrally and transactionally.
- Offline commands must be revalidated on replay.
- Database constraints are part of domain correctness.
- No client-side database is treated as the source of truth.
