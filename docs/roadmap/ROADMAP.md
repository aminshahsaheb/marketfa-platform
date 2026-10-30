# Engineering Roadmap

Work is gated by evidence. A phase is not complete because its files exist.

## M0 — Discovery and legacy baseline
- [ ] Inventory legacy capabilities and known defects.
- [ ] Confirm target retail segment and pilot operator.
- [ ] Confirm jurisdiction, currency, timezone, tax, fiscal calendar.
- [ ] Define hardware and offline requirements.
- [ ] Define import/export sample and migration mapping.
- [ ] Approve MVP and measurable pilot outcomes.

**Exit:** signed-off PRD decisions and acceptance scenarios.

## M1 — Repository and engineering foundation
- [ ] Workspace and package manager selected.
- [ ] TypeScript strict configuration.
- [ ] API and web applications boot locally.
- [ ] PostgreSQL Docker Compose and health check.
- [ ] Prisma schema and migration workflow.
- [ ] CI: install, format/lint, typecheck, unit tests, build.
- [ ] Contribution, security, environment, and ADR rules.
- [ ] First architecture decision records.

**Exit:** clean clone can install, test, build, and run locally from documented steps.

## M2 — Identity and tenancy
- [ ] Authentication/session lifecycle.
- [ ] Tenant, store, terminal, membership.
- [ ] Roles and permissions.
- [ ] Tenant isolation integration tests.
- [ ] Audit events for access and configuration changes.

**Exit:** cross-tenant access tests fail closed.

## M3 — Accounting kernel
- [ ] Chart of accounts.
- [ ] Journal draft and posting.
- [ ] Balanced-entry invariant.
- [ ] Reversal and closed-period behavior.
- [ ] General ledger and trial balance.
- [ ] Property-based and invariant tests.

**Exit:** independent ledger fixtures reconcile exactly.

## M4 — Catalog and inventory
- [ ] Product, barcode, units and conversion.
- [ ] Supplier and purchase receipt.
- [ ] Batch, expiry and stock movement ledger.
- [ ] FEFO allocation.
- [ ] Concurrency tests for allocation and adjustments.

**Exit:** stock ledger and valuation reconcile for defined scenarios.

## M5 — POS and operations
- [ ] Shift lifecycle and cash counts.
- [ ] Sale command and tender records.
- [ ] Atomic inventory/accounting posting.
- [ ] Discounts and permissions.
- [ ] Full/partial returns and refund.
- [ ] Receipt and terminal workflow.

**Exit:** sale-to-ledger and return-to-ledger end-to-end tests pass.

## M6 — Bounded offline and sync
- [ ] Device registration/revocation.
- [ ] IndexedDB schema and outbox.
- [ ] Idempotent command protocol.
- [ ] Retry/backoff and typed conflict states.
- [ ] Offline policy per command.
- [ ] Duplicate, stale-price, stale-stock, revoked-device tests.

**Exit:** documented offline scenarios pass under network interruption and replay.

## M7 — Pilot readiness
- [ ] Reporting and exports.
- [ ] Backup and restore rehearsal.
- [ ] Observability and alerting.
- [ ] Browser/device compatibility.
- [ ] Security review and operational runbook.
- [ ] Pilot training and support process.

**Exit:** pilot checklist signed off; no unresolved critical correctness/security defects.

## M8 — Controlled rollout
- [ ] Pilot metrics review.
- [ ] Import validation and reconciliation.
- [ ] Recovery and rollback rehearsal.
- [ ] Pricing/support model validation.
- [ ] Release notes and versioning.

**Exit:** evidence supports expansion beyond the pilot.
