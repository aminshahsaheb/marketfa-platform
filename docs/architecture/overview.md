# Architecture Overview

**Status:** Proposed baseline. The M1 scaffold does not yet implement all components described here.

## System context

The browser is an untrusted client. It may cache limited operational data, but it is never authoritative for price, tax, stock, accounting, permissions, or final posting. The NestJS API authenticates actors, resolves tenant membership, validates commands, and executes use cases. PostgreSQL is authoritative.

## Modules

Identity and Access; Tenancy and Store Setup; Catalog; Procurement; Inventory; Sales; Payments; POS Operations; Accounting; Audit; Sync; Reporting. Each module owns its writes. Cross-module workflows use application interfaces and explicit transaction boundaries.

## Sale transaction target

1. Authenticate actor and resolve tenant/store/terminal permissions.
2. Validate command schema and idempotency key.
3. Lock or conditionally update stock rows in deterministic order.
4. Revalidate sellable quantity and server-approved price/tax policy.
5. Allocate batches according to configured policy.
6. Persist sale, lines, tenders, stock movements, and balanced journal entries.
7. Persist audit and outbox events.
8. Commit once; otherwise roll back all local effects.

External provider calls do not run inside the database transaction.

## Offline target

Offline capture is bounded. Every command carries a UUID, device ID, schema version, tenant scope and idempotency key. The server revalidates on replay. States: queued, sending, accepted, rejected, needs_review. No unrestricted multi-device offline stock allocation is promised.

## Data consistency

- PostgreSQL is the source of truth.
- Initial Iran ledger amounts use integer IRR; Toman is an explicit input/display unit (1 Toman = 10 Rial).
- Use NUMERIC/exact decimal intermediates for measured quantities and prorated calculations; no binary floating-point money.
- Store UTC instants and IANA timezone separately. Store accounting dates as date-only values.
- Posted journals and stock movements are immutable; corrections use reversals/compensating records.
- Tenant scope is server-derived and enforced in queries and database constraints.

## API and security

Version APIs under `/api/v1`; validate input at boundaries; use stable error codes, correlation IDs, pagination and idempotency. Enforce authorization on every request. Use secure sessions, CSRF defenses where applicable, rate limits, encrypted backups and least privilege. Log metadata, not secrets or sensitive payloads.

## Observability and deployment

Structured logs include timestamp, level, service, request/correlation ID, actor and tenant identifiers where safe. Metrics cover latency, errors, sync age, conflicts and backup status. Production hosting, data residency and backup topology remain pilot decisions.
