# Engineering Roadmap

Work is gated by evidence. A phase is not complete because its files or screens exist. This roadmap describes the state of `main` and separates it from open pull requests.

**Repository snapshot:** `main` at `ed0e37c44b7358d2e77e7f62978bfce43966594c`, 2026-11-02.

## M0 — Product discovery and policy

- [x] Confirm Iran as the first launch jurisdiction.
- [x] Confirm Persian (`fa-IR`) and English (`en`) as first-release locales.
- [x] Confirm integer IRR as the canonical Iran ledger unit; Toman is explicit input/display (1 Toman = 10 Rial).
- [x] Confirm the product direction: multi-industry business operations platform, not retail-only.
- [ ] Select one or two pilot verticals and pilot operators.
- [ ] Record representative workflow volumes: users, locations, terminals, daily documents, SKUs/items and concurrent operators.
- [ ] Define at least ten pilot acceptance scenarios and measurable outcomes.
- [ ] Approve fractional quantity, line/tax rounding and deterministic remainder allocation with an Iran accountant.
- [ ] Verify current tax rules, invoice types, exemptions, thresholds and Moadian schema against official primary sources.
- [ ] Confirm timezone, fiscal calendar, legal entity and accounting-book policy.
- [ ] Approve starter chart of accounts, inventory costing and COGS timing.
- [ ] Define hardware, accessibility and bounded offline requirements.
- [ ] Define privacy, data retention, hosting/data residency and backup requirements.
- [ ] Obtain a sanitized legacy export and approve the mapping/reconciliation plan.

**Exit:** signed product decisions, legal/accounting evidence, pilot scenarios and measurable acceptance criteria. Unresolved policy is an explicit blocker, not an assumed default.

## M1 — Repository and engineering foundation

- [x] pnpm workspace, pinned Node/pnpm/dependency versions and frozen lockfile.
- [x] Strict TypeScript, lint and formatting baseline.
- [x] NestJS API and React/Vite web shell.
- [x] PostgreSQL development service, health checks and SQL migration workflow.
- [x] Money primitive and Rial/Toman conversion tests.
- [x] GitHub Actions CI, production builds and API/PostgreSQL/web smoke checks.
- [x] PR #4 reviewed and merged to `main`.

**Decision:** keep SQL-first PostgreSQL persistence. Do not add Prisma by default; ADR-0010 requires explicit SQL for RLS, composite constraints, locking and deferred financial invariants.

**Exit:** M1 complete.

## M2 — Identity, tenancy and administration

### Merged to main

- [x] Tenant/store schema, composite constraints and PostgreSQL RLS foundation (PR #8).
- [x] Provider-neutral opaque server-side session core (PR #9).
- [x] Request actor resolution and CSRF guards (PR #10).
- [x] RLS/privilege/pool isolation integration coverage (PRs #11 and #12).
- [x] Role/permission map and full permission matrix (PR #13).
- [x] Tenant administration command boundary (PR #14).
- [x] Atomic tenant bootstrap (PR #15).
- [x] Invitation create/revoke/accept lifecycle (PR #17).
- [x] Membership role change, suspension and removal; last active OWNER protection (PR #18).
- [x] Terminal register/rotate/suspend/reactivate/revoke lifecycle (PR #19).
- [x] HTTP authorization matrix for implemented tenant-admin endpoints (PR #20).

### Still open

- [ ] Select and implement the authentication provider and account proofing flow.
- [ ] Login, logout, recovery, cookie issuance/clearing and complete browser session integration.
- [ ] Invitation delivery provider and email/SMS abuse controls.
- [ ] Rate limits, bot/credential abuse protection and account recovery controls.
- [ ] Terminal device authentication and request signing/credential rotation at the API boundary.
- [ ] Extend role and tenant isolation tests to each new business API and worker.
- [ ] Operational account lifecycle, support and audit procedures.

**Exit:** end-to-end authentication works; all endpoints and workers fail closed under revoked access; abuse controls and account recovery are tested; every tenant-owned API has authorization and isolation evidence.

## M0.5 — Multi-industry business model

**Status on main:** the architecture baseline is merged in PR #27. The first implementation slice is in open PR #28, ready for review; it is not merged. The latest PR head includes store-eligibility, frontend-version and legacy HTTP bootstrap compatibility safeguards. The live PR records CI results for the exact current head.

- [x] Define tenant → business profile → business location boundaries in the merged architecture baseline.
- [x] Keep retail store/POS terminal concepts optional in the PR #28 implementation.
- [x] Add accounting-book ownership independently from POS store/location; current onboarding creates one book per profile.
- [x] Add versioned industry and capability catalogues.
- [x] Keep capability defaults as suggestions; regulated profiles start in `PENDING_APPROVAL`.
- [ ] Add server-side capability activation, dependency, entitlement, permission, setup and jurisdiction gates.
- [x] Prevent regulated workflows from being enabled by onboarding; specialist approval workflow remains unimplemented.
- [ ] Add module-owned dashboard cards, actions, routes and empty states.
- [ ] Select first pilot verticals and complete their workflows end to end.
- [ ] Test profile migration without changing historical records.

**Open PR #28:** ready for review; based directly on `main` (`ed0e37c44b7358d2e77e7f62978bfce43966594c`). Check the live PR for the current head and exact-head CI result. CodeRabbit's full review attempt was rate-limited; no completed human architecture review is recorded. PR #26 is closed as superseded.

**Exit:** the profile, location and capability contracts are merged; capability activation is enforced server-side with release, profile, dependency, entitlement, permission, setup, jurisdiction and specialist-approval gates; the UI renders only active, authorized module routes and actions; historical profile changes are explicit; and at least two selected pilot workflows pass end-to-end tests.

## M3 — Accounting kernel

- [x] Define immutable double-entry accounting domain rules.
- [x] Define logical accounting model and golden/property/concurrency test plan.
- [x] Record ADR-0007.
- [ ] Approve legal/accounting book scope, chart of accounts and fiscal-period policy.
- [x] Add the accounting-book-scoped SQL schema foundation (PR #21 merged).
- [ ] Review and validate the schema against approved legal/accounting policies and real pilot workflows.
- [ ] Approve posting-rule overlap/version selection policy.
- [ ] Implement restricted posting, reversal, idempotency and sequence commands.
- [ ] Implement period close/reopen commands serialized against posting.
- [ ] Implement general ledger, trial balance and reconciliation read models.
- [ ] Add transactional audit and outbox integration.
- [ ] Pass PostgreSQL, property, tenant-isolation, concurrency and accountant-reviewed golden tests.

**Merged PR #21:** accounting schema foundation only. It scopes accounts, periods, journals and sequences by `accounting_book_id`, not by retail store. This is a schema foundation, not a posting service. The accounting policy decisions and all posting/read-model commands remain open.

**Exit:** source transactions and journals commit atomically; duplicate commands return the same result; period close cannot race a late post; reports reconcile exactly; accountant-approved golden cases pass.

## M4 — Shared catalog and operational inventory

- [ ] Service/product catalogue with explicit item types.
- [ ] Units, conversion factors, precision and historical snapshots.
- [ ] Supplier and purchase workflows.
- [ ] Inventory movement ledger, batches, expiry and deterministic FEFO where relevant.
- [ ] Concurrency-safe allocation and adjustments.
- [ ] Service businesses can operate without inventory.

**Exit:** operational balances and valuation reconcile for the pilot verticals.

## M5 — First vertical workflows

- [ ] Build one or two selected pilot packs end to end.
- [ ] Retail pack: shifts, POS, tenders, returns and receipts only if retail is a pilot.
- [ ] Service/repair pack: appointments, quotes, work orders, time/parts and invoicing as required by pilot.
- [ ] Atomic source, inventory, tender, journal, audit and outbox behavior.
- [ ] Role-based API and browser workflow tests.
- [ ] Persian/English and RTL/LTR tests.

**Exit:** each selected vertical completes its real business workflow without fake modules; source records, stock (where used), cash and ledger reconcile.

## M6 — Bounded offline and terminal sync

- [ ] Device authentication, revocation and assignment checks.
- [ ] IndexedDB schema and durable outbox.
- [ ] Persist command UUID/schema version/idempotency key before send.
- [ ] Retry/backoff, replay protection and stored command outcomes.
- [ ] Define offline policy per command, including expiry and stale-data behavior.
- [ ] Handle browser crash, reload, quota, private mode and clock drift.
- [ ] Test duplicate, out-of-order, stale price/tax/stock/shift and revoked-device cases.

**Exit:** documented offline scenarios pass under interruption and replay; unsafe commands reject or enter manual review.

## M7 — Compliance, reporting and operational readiness

- [ ] Complete bilingual translation and accessible workflows.
- [ ] Jalali/Gregorian, timezone/DST, digit parsing, IRR/Toman and rounding golden tests.
- [ ] Reports and CSV/PDF/receipt exports with explicit locale, date, timezone and currency metadata.
- [ ] Current official Iran tax/Moadian rules and specialist-approved adapter.
- [ ] Durable tax submission/reconciliation and rejection/outage workflows.
- [ ] Encrypted backup, retention, restore rehearsal and ledger/audit verification.
- [ ] Structured logs, metrics, traces, alerts and incident runbook.
- [ ] Threat-model update and independent security review.
- [ ] Browser/device compatibility, accessibility and load tests based on pilot workload.

**Exit:** legal/compliance evidence is approved; restore is rehearsed; no unresolved critical correctness/security defect; operators can support the pilot.

## M8 — Controlled pilot and rollout

- [ ] Training, support, release notes and rollback procedure.
- [ ] Sanitized legacy import, rejected-row report and reconciliation sign-off.
- [ ] Pilot metrics and customer feedback review.
- [ ] Recovery and rollback rehearsal.
- [ ] Pricing/support model validation.
- [ ] Approve expansion only when evidence supports it.

**Exit:** signed pilot review and controlled release approval.

## Cross-cutting definition of done

A feature is done only when domain rules, authorization, database integrity, failure/retry behavior, audit, tests, localization, documentation and exact-commit CI evidence are complete. A green unit test alone does not prove production readiness.
