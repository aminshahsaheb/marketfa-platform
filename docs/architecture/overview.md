# Architecture Overview

**Status:** Target architecture for the Iran-first multi-industry platform. Implemented state is tracked in the roadmap; this document does not claim every target component exists.

## 1. System context

The browser is an untrusted client. It may cache limited operational data and queue bounded commands, but it is never authoritative for identity, permissions, price, tax, inventory, accounting or final posting.

The NestJS API authenticates the actor, resolves tenant/business-profile/location scope, authorizes the command and coordinates module use cases. PostgreSQL is the source of truth for transactional records. External providers are called through adapters and durable outbox workers after local commit.

Use a modular monolith. Modules own their data and application interfaces. Do not introduce microservices until measured load, independent scaling, team ownership or fault isolation justify the operational cost.

## 2. Business and security hierarchy

- User: global human identity.
- Tenant: workspace/security and commercial-customer boundary.
- Membership: user's role and permissions in a tenant.
- Business profile: versioned operating business and industry template.
- Business location: physical branch, office, workshop, project site, virtual operation or service area.
- Store: optional retail/POS operating location.
- Terminal: optional registered device assigned to a location and workflow.
- Accounting book: financial ledger boundary for a legal/accounting entity. Do not assume one book per store.
- Jurisdiction profile: legal/tax rules independent from industry and UI locale.

A client-supplied ID is a selector, never proof of authorization. Resolve and validate every relationship on the server and in database constraints.

## 3. Capability model

Industry profiles suggest capabilities; they do not grant them. The server evaluates release support, profile eligibility, dependencies, setup, commercial entitlement, actor permission, location scope, jurisdiction and specialist approval. Unknown or unavailable capabilities fail closed and produce an explicit state; they are not silently dropped.

Each capability owns its domain model, commands, read models, routes, permission requirements, audit events, dashboard cards, empty states and tests. Shared finance must not require fake stock, cash-drawer or POS records.

## 4. Module boundaries

### Shared platform core

Identity/access, tenant administration, business profiles, locations, customer/supplier directory, documents, payments, expenses, accounting books, audit, notifications, localization, reporting and integration contracts.

### Vertical modules

Retail, food service, services, repair/maintenance, projects/construction, wholesale/distribution, manufacturing, hospitality and transport/logistics. Each vertical has its own workflow and data model. A business may combine capabilities where dependencies and policy allow.

## 5. Transaction and command rules

Every consequential write is a typed command with:

- authenticated actor and validated scope;
- schema version and durable command/idempotency ID;
- explicit authorization and domain validation;
- one PostgreSQL transaction for related local records;
- deterministic lock order and explicit concurrency policy;
- append-only audit and transactional outbox where required;
- stable result/error contract for safe retries.

Do not make network calls to external providers inside the database transaction. Persist intent to the outbox, commit, then deliver and reconcile asynchronously.

## 6. Financial transaction target

A source workflow (sale, return, purchase, payment, project claim or service invoice) validates its source state, pricing, tax and permissions. It writes the source record, relevant stock/cash effects, journal, audit and outbox in one transaction where those records share a consistency boundary. If a workflow has independent legal or asynchronous states, model them explicitly rather than pretending the external effect is atomic.

The accounting book is the ledger scope. Store/location is an operational dimension unless the approved accounting policy explicitly requires separate books. Posted journals are immutable. Corrections use linked reversals or compensating entries.

## 7. Data consistency

- PostgreSQL is the transactional source of truth.
- Canonical Iran ledger amounts are integer IRR; Toman is explicit input/display.
- Quantities and unit prices use exact decimal representations with explicit precision.
- Rounding occurs only at approved, versioned domain boundaries.
- Store UTC instants and IANA timezone separately. Accounting dates are canonical date-only values.
- Preserve historical snapshots of item descriptions, units, prices, costs, account identity and rule versions.
- Enforce tenant/profile/location relationships with composite foreign keys and RLS where appropriate.
- Never use binary floating point for authoritative money.

## 8. Offline and device model

Offline is a bounded command-capture feature, not a second source of truth. Persist command ID and idempotency key before sending. The server revalidates actor, terminal, price, tax, stock, shift, permission and policy on replay. States include queued, sending, accepted, rejected and needs_review. Revoked devices fail closed. Do not promise unrestricted multi-terminal offline stock allocation.

## 9. Iran localization and compliance

Persian defaults to RTL/Jalali presentation; English defaults to LTR/Gregorian. Locale does not change jurisdiction, currency, tax or accounting. Store explicit currency/unit, timezone, calendar presentation and legal profile. Moadian is an isolated, versioned adapter; no live compliance claim until current official sources and specialist review are recorded.

## 10. API, security and privacy

Version APIs under `/api/v1`. Validate request schemas and reject unknown fields where appropriate. Use stable error codes, correlation IDs, pagination, rate limits, secure cookies, CSRF protection, least-privilege roles and secret rotation. Avoid logging credentials, tokens, full financial payloads or sensitive personal data.

RLS protects against accidental missing scope; it does not protect against arbitrary SQL under the runtime credential. Parameterized queries, no client DB credentials, narrow repositories and API authorization remain primary controls.

## 11. Data and analytics

Keep operational transactions separate from analytical aggregates. Define versioned event contracts, timestamps, tenant scope, schema evolution and retention. Minimize PII in telemetry. Do not use analytics events as the accounting source of truth. Audit records and product analytics have different purposes, access policies and retention rules.

## 12. Observability and operations

Use structured logs, metrics and traces with correlation IDs and safe tenant context. Monitor request latency/errors, database pool saturation, command retries/conflicts, outbox age, sync lag, backup freshness and restore outcomes. Define RPO/RTO from pilot needs and rehearse recovery before pilot.

## 13. Quality strategy

Use unit/property tests for pure domain rules; PostgreSQL integration tests for RLS, locks, triggers and transactions; API authorization tests for every endpoint; browser E2E for user journeys; accessibility and localization checks; load tests based on measured pilot workloads; backup/restore tests for financial history.

A test passes only when executed against the exact commit and its environment/result is retained.
