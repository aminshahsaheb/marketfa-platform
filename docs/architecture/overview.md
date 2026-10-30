# Architecture Overview

**Status:** Proposed baseline  
**Architecture style:** Modular monolith with explicit domain boundaries.

## 1. System context

The browser PWA is an untrusted client. It may cache application assets and a limited operational dataset, but it is never authoritative for price, tax, stock, accounting, permissions, or final posting.

The NestJS API authenticates the actor, resolves tenant membership, validates commands, and executes domain use cases. PostgreSQL is the authoritative store. Financial and stock effects are committed in database transactions.

## 2. Logical components

- Identity and Access: users, memberships, roles, sessions.
- Tenancy and Store Setup: tenant, store, terminal, configuration.
- Catalog: products, barcodes, units, price lists.
- Procurement: suppliers, purchase orders (later), receipts, supplier invoices.
- Inventory: batches, stock ledger, reservations, adjustments, transfers (later).
- Sales: cart validation, sales, sale lines, discounts.
- Payments: tender records, refunds, cash movements.
- POS Operations: shifts, cash counts, terminal sessions.
- Accounting: chart of accounts, journal entries, journal lines, periods, reports.
- Audit: append-only audit events and correlation.
- Sync: device identity, command inbox/outbox, idempotency, conflict responses.
- Reporting: read models and exports.

Modules own their write operations. Cross-module workflows call application services or domain events within the same transaction; avoid circular imports and shared mutable repositories.

## 3. Transaction boundary: posting a sale

A sale posting command must:
1. Authenticate actor and resolve tenant/store/terminal permissions.
2. Validate command schema and idempotency key.
3. Lock or conditionally update the required stock rows in a deterministic order.
4. Revalidate sellable quantity and current server-approved price/tax policy.
5. Allocate batches according to the configured policy.
6. Persist sale, lines, tenders, stock movements, and balanced journal entries.
7. Persist audit and outbox events.
8. Commit once; otherwise roll back all effects.

Do not call external payment providers inside a database transaction. Use a payment intent/state machine and reconciliation workflow if a provider is introduced.

## 4. Offline model

Offline support is bounded and explicit:
- Cache only data required for a terminal's permitted workflow.
- Store commands locally with UUID, device ID, tenant scope, creation time, schema version, and idempotency key.
- Do not trust client timestamps for financial ordering.
- Server revalidates every command at replay.
- Command states: queued, sending, accepted, rejected, needs_review.
- Retries reuse the same idempotency key.
- Conflicts return typed reason codes and do not silently overwrite.
- Initial release may allow offline draft capture while restricting final posting or stock-sensitive sales to a single-terminal allocation policy.

## 5. Data and consistency

- PostgreSQL is the source of truth.
- Use integer minor currency units where currency supports them; otherwise use explicit decimal precision. Never use binary floating point for money.
- Use NUMERIC for measured quantities with documented scale and rounding.
- Store UTC instants and the applicable IANA timezone separately.
- Posted journals and stock movements are immutable. Corrections use reversing/compensating records.
- Add tenant_id to tenant-owned records and enforce it in repository queries; evaluate PostgreSQL row-level security as defense in depth.
- Use foreign keys, unique constraints, check constraints, and appropriate indexes.
- Use migrations committed to source control.

## 6. API conventions

- Version external API paths (for example /api/v1).
- Validate all input at the boundary.
- Use stable error codes and correlation IDs.
- Apply pagination to collection endpoints.
- Avoid returning internal database models directly.
- Define idempotency behavior for every command endpoint.
- Use OpenAPI as a generated contract, then review breaking changes.

## 7. Security boundaries

- No secrets in source control or browser bundles.
- Authorization is enforced server-side on every request.
- Tenant scope comes from authenticated membership.
- Sensitive actions require explicit permissions and audit records.
- Rate-limit authentication and abuse-prone endpoints.
- Use secure, HttpOnly, SameSite cookies if cookie sessions are selected; document CSRF protection.
- Encrypt backups and restrict restore permissions.
- Log metadata, not passwords, tokens, card data, or unnecessary personal data.

## 8. Observability

Structured logs include timestamp, level, service, request_id, correlation_id, actor_id (when safe), tenant_id, and event name. Metrics cover API errors/latency, sync queue age, command rejection, transaction conflicts, and backup status. Never place secrets or sensitive payloads in logs.

## 9. Deployment shape

Local development uses Docker Compose for PostgreSQL and app services. Production topology, hosting provider, backups, monitoring, and data residency are decisions for the pilot environment, not assumptions embedded in code.
