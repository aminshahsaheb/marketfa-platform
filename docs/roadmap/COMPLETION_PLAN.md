# MarketFa Platform — Completion Plan and Architecture Review

**Review snapshot:** 2026-11-01  
**Repository:** `aminshahsaheb/marketfa-platform`  
**Basis:** current `main`, open PRs, CI history, roadmap/PRD/ADR/security/finance docs, API/database/web source tree, and the legacy audit. This is an engineering plan, not a claim of production readiness.

## Executive assessment

The repository has a useful foundation: modular-monolith direction, PostgreSQL as source of truth, tenant-scoped RLS, server-side sessions, request actor/CSRF guards, tenant bootstrap, invitation/membership/terminal lifecycle commands, and integration tests against PostgreSQL.

It is **not yet a usable retail product**. The web app is a shell. There is no selected authentication provider or login/recovery flow, no catalog/inventory/sales/shift modules, no accounting posting service or reports, no durable offline outbox/sync, and no production operations or pilot evidence.

The correct sequence is to close product/legal decisions and identity entry points, finish the accounting foundation and posting boundary, then build inventory and POS around atomic source-document-to-ledger transactions. Offline scope must remain bounded until online workflows and device revocation are proven.

## Verified current state

### Merged foundation

- M1 workspace, NestJS API shell, React/Vite shell, PostgreSQL, CI and smoke checks (PR #4).
- Tenant/store identity schema, RLS and pooled-connection isolation tests (PRs #8, #11, #12). PR #16 was verified as duplicate and closed as superseded.
- Provider-neutral server-side session lifecycle and actor/CSRF guards (PRs #9, #10).
- Tenant bootstrap (PR #15), invitation lifecycle (PR #17), membership lifecycle (PR #18), terminal lifecycle (PR #19), and current tenant-admin HTTP authorization matrix (PR #20).
- Integer IRR money primitive with explicit Toman conversion.
- Legacy source audit and migration policy.

### In progress

- **PR #21 — M3 accounting schema foundation.** The branch contains accounts, fiscal periods, posting-rule versions, journals/lines, sequences, audit events, RLS, database constraints and PostgreSQL integration tests. It does not implement posting application services, durable command idempotency, sequence allocation, period close/reopen commands, ledger/trial-balance queries, or source-module integration.
- CI passes on exact PR #21 head `fbac60de7788f2257b2f79335670cee135106f66` (format, lint, typecheck, migrations, PostgreSQL integration tests, build, API+Web smoke). An earlier run exposed a duplicate journal-number fixture in the closed-period test; the fixture was corrected and the exact-head rerun passed.

### Not implemented or not approved

- Authentication provider, login/logout, recovery, session-cookie browser flow and abuse/rate controls.
- Product discovery: first retail vertical, pilot operator, hardware, offline limits and measurable pilot criteria.
- Accountant-approved chart of accounts, fiscal calendar, quantity/rounding, inventory costing and COGS timing.
- Current official Iran tax/Moadian rule pack and specialist review.
- Catalog, procurement, inventory ledger, POS, tenders, shifts, returns, reports.
- Durable local outbox, device authentication and sync protocol.
- Deployment, backups/restore rehearsal, monitoring, incident/rollback runbooks, security review and pilot operations.

## Architecture review — risks and required controls

1. **Identity is not end-to-end yet.** Session primitives exist, but there is no provider-backed login/recovery path. Do not expose tenant administration as a usable product until authentication, cookie policy, recovery, rate limits, abuse handling and account lifecycle are implemented and tested.
2. **Accounting schema is not an accounting service.** Keep direct table writes unavailable to `marketfa_app`. Implement a narrow command boundary with transaction-scoped tenant/store authorization, durable idempotency, atomic audit/outbox, deterministic locks, and stable error contracts.
3. **Period close/post concurrency is a critical invariant.** Posting and close/reopen commands must lock the same period row in a deterministic order. Test the race so exactly one serialized outcome occurs; a closed period must never accept a late post.
4. **Posting-rule version selection needs a defined overlap policy.** Schema currently stores effective dates but does not by itself prove there is only one approved applicable rule for a key/date. Add exclusion/validation logic and tests, or define an explicit priority policy.
5. **Account hierarchy needs domain validation beyond FK integrity.** Enforce active/non-postable parents and cycle prevention; decide whether child account types must match parent/control-account rules. Add concurrent hierarchy mutation tests if hierarchy editing is exposed.
6. **Financial source modules must post atomically.** Sale/return/purchase/settlement source record, stock movement, tender, journal, audit and outbox must commit in one PostgreSQL transaction. No external network call inside that transaction.
7. **Offline is a consistency and security feature, not just IndexedDB.** Persist command IDs before send; use server idempotency outcomes; revalidate current price/tax/stock/shift/permission/terminal state; define reject/review states and bounded allowed commands. Never promise unrestricted multi-terminal offline stock allocation.
8. **Tax compliance must be evidence-versioned.** Keep generic accounting separate from Iran tax and Moadian adapters. Do not encode rates, taxpayer applicability, schema fields, outage rules or rounding without primary official source, effective date, scope, reviewer and golden test vectors.
9. **Operational safety is not yet proven.** Add backup encryption/retention, restore drills, migrations/rollback policy, structured logs/metrics/alerts, incident procedures, deployment secrets and data-residency decisions before pilot.
10. **Legacy migration needs a real sanitized export.** Build mapping/validation/reconciliation artifacts and a staging import. Do not migrate credentials or modify the only source backup.
11. **Quality evidence must be feature-complete.** Every tenant-owned API family needs role and cross-tenant tests. Every financial feature needs golden, boundary, property, retry/concurrency, reconciliation and restore coverage. Existing web test is only a shell test; browser E2E and accessibility/localization coverage remain future gates.
12. **API edge hardening must be standardized before external exposure.** The current bootstrap config is minimal. Define and test request validation/unknown-field behavior, allowed origins, security headers, request-size limits, stable error envelopes, correlation IDs, rate limits, and graceful shutdown. Keep route-specific parsers strict and avoid logging secrets or financial payloads.

## Ordered completion plan

### Phase 0 — Product and policy decisions (gate before financial behavior)

- [ ] Select first retail vertical and pilot operator; record SKU/transaction/terminal scale.
- [ ] Confirm one-store-per-tenant MVP or document why multi-store is required.
- [ ] Define core workflows and at least 10 end-to-end acceptance scenarios.
- [ ] Approve device/hardware list: barcode scanner, scale, receipt printer, cash drawer, supported browsers.
- [ ] Define offline duration, terminal count and allowed commands; default to online-first and bounded capture.
- [ ] Approve quantity precision, line/tax rounding and deterministic remainder allocation with an Iran accountant.
- [ ] Approve fiscal-year/calendar, close/reopen, starter CoA, inventory costing and COGS timing.
- [ ] Verify current tax/Moadian requirements from official primary sources and obtain specialist review.
- [ ] Define hosting/data residency, privacy, retention and pilot success metrics.
- **Exit:** signed decisions, source evidence and golden acceptance scenarios; unresolved items are explicit launch blockers.

### Phase 1 — Close M2 identity and administration

- [ ] Decide authentication method from pilot evidence (password, OTP, email link or provider); do not assume.
- [ ] Implement provider adapter, login/logout, session-cookie issuance/clearing, expiry/rotation/revocation and recovery.
- [ ] Add abuse controls: rate limits, enumeration-resistant responses, invitation delivery and resend limits, audit and alerting.
- [ ] Implement tenant/store onboarding UI and secure first-owner flow.
- [ ] Define ownership transfer, account deletion/disable, support recovery and shared-device behavior.
- [x] Close PR #16 as superseded after verifying its test changes are already in `main`.
- [ ] Extend auth/authorization tests to login/recovery and future endpoint families.
- **Exit:** user can securely create/recover an account, create a tenant/store, invite users and revoke access; tests prove session and membership revocation.

### Phase 2 — Finish M3 accounting schema foundation

- [x] Confirm PR #21 CI passes on exact head; migration privilege/RLS review is recorded as a follow-up gate.
- [ ] Add/verify rule effective-date overlap semantics and account hierarchy policy.
- [ ] Confirm deferred constraints, rollback behavior, audit immutability and test cleanup.
- [ ] Merge PR #21 only after review and green CI.
- [ ] Update main roadmap/status docs to match merged implementation.
- **Exit:** schema migration is merged, reproducible on clean PostgreSQL, and constraints are backed by integration tests.

### Phase 3 — Accounting command boundary and read models

- [ ] Implement account CRUD/lifecycle, localized labels and account validation.
- [ ] Implement fiscal period create/open/close/reopen commands with authorization, reason, audit and serialized locks.
- [ ] Implement journal draft, post, reverse and manual-journal approval workflow.
- [ ] Implement durable idempotency table/outcome semantics; concurrent same-key requests return one stable result.
- [ ] Allocate store sequence under row lock; define gap policy and numbering requirements.
- [ ] Implement approved posting-rule selection/versioning and typed configuration validation.
- [ ] Add transactional audit and outbox records to every command.
- [ ] Implement general ledger, trial balance and initial financial reports with pagination and filters.
- [ ] Add golden, property, concurrency, period-close race, reversal and tenant-isolation tests.
- **Exit:** independent fixtures reconcile; posting is atomic/idempotent; closed periods cannot accept late posts; trial balance balances; accountant approves scenarios.

### Phase 4 — Catalog, procurement and inventory

- [ ] Product/SKU/barcode, localized labels, units and exact conversion rules.
- [ ] Supplier and purchase order/receipt workflow; decide supplier invoice/payable scope.
- [ ] Stock movement ledger with immutable adjustments and traceable source documents.
- [ ] Batch/expiry and FEFO allocation where pilot needs it.
- [ ] Cost layers/valuation method and COGS timing approved; inventory subledger reconciles to GL.
- [ ] Concurrency controls for receipts, adjustments, allocation and negative-stock policy.
- [ ] Import/export, pagination, search and audit.
- **Exit:** stock quantities and valuation reconcile for purchase, sale, return, adjustment and expiry scenarios.

### Phase 5 — POS, tender and shifts

- [ ] Shift open/close, opening float, cash count and variance workflow.
- [ ] Server-authoritative cart pricing, discount permissions, tax calculation and stock allocation.
- [ ] Sale command atomically writes sale, lines, tender, stock movements, journal, audit and outbox.
- [ ] Cash/card tender recording; external payment integration remains a separate adapter.
- [ ] Full/partial returns tied to original lines; restock/damaged disposition; refund and reversal rules.
- [ ] Receipt rendering/printing in Persian RTL and English LTR.
- [ ] Role-based HTTP tests, duplicate retries, concurrent sales, oversell and rollback tests.
- **Exit:** end-to-end sale/return/shift scenarios reconcile cash, stock, tax and ledger exactly.

### Phase 6 — Bounded offline and terminal sync

- [ ] Device authentication using terminal credentials; revoked/suspended terminals fail closed.
- [ ] IndexedDB schema, durable outbox, command UUID/schema version and persisted idempotency keys.
- [ ] Sync API with retry/backoff, replay protection, conflict states and stored outcomes.
- [ ] Define permitted offline operations and explicit limits; stale price/tax/stock/shift rules.
- [ ] Handle reload, browser crash, storage quota/private mode, clock drift and network interruption.
- [ ] Test duplicate delivery, out-of-order events, stale data, revocation during offline, and manual review.
- **Exit:** documented offline scenarios pass; no duplicate financial effects; unsafe commands are rejected or sent to review.

### Phase 7 — Localization, compliance, reports and migration

- [ ] Complete translation-key coverage and RTL/LTR flows across all modules.
- [ ] Jalali/Gregorian, timezone/DST, Persian/Latin digits, money-unit and rounding golden tests.
- [ ] CSV/PDF/receipt exports with locale, calendar, timezone and currency metadata; test Persian shaping/fonts.
- [ ] Versioned Iran tax profile and Moadian adapter only after specialist-approved source/rules.
- [ ] Tax invoice states, durable submission/reconciliation and outage/rejection workflows.
- [ ] Sanitized legacy import mapping, validation report, rejected-row log and reconciliation.
- **Exit:** compliance and migration evidence are approved; no unsupported compliance claims.

### Phase 8 — Pilot readiness and controlled rollout

- [ ] Production deployment topology, secrets, TLS, data residency and access controls.
- [ ] Automated encrypted backups, retention and restore rehearsal with ledger/sequence/audit verification.
- [ ] Structured logs, metrics, alerts, correlation IDs and operational dashboards.
- [ ] Security review, dependency/secret scans, threat-model update and incident runbook.
- [ ] Load tests based on pilot workload; browser/device compatibility and accessibility tests.
- [ ] Training, support, rollback, release notes, pilot metrics and reconciliation checklist.
- [ ] Pilot run, review metrics/defects, and approve expansion only from evidence.
- **Exit:** signed pilot checklist, tested recovery, no unresolved critical correctness/security issues.

## Cross-cutting Definition of Done

A feature is complete only when it has:

- Domain rules and explicit acceptance scenarios.
- Authenticated actor, tenant/store scope and role authorization.
- Database constraints and transaction boundaries where data integrity requires them.
- Idempotency/retry and concurrency behavior.
- Audit/outbox behavior for consequential changes.
- Unit + PostgreSQL integration + API authorization tests; browser tests for user workflows.
- Persian/English, RTL/LTR, date, currency and accessibility coverage where applicable.
- Documentation, migration/rollback notes and operator guidance.
- CI evidence from the exact commit.

## Recommended immediate next actions

1. Complete human review of PR #21 migration/RLS and schema invariants; CI is green on its exact head.
2. Merge PR #21 only after review; then implement Phase 3 accounting commands.
3. Review/merge PR #22, which updates the roadmap and records this plan.
4. Make Phase 0 decisions with the pilot operator/accountant before implementing posting behavior.
5. Build accounting commands before starting POS, so sales cannot invent their own financial writes.
