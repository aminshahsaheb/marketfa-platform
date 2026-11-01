# Engineering Roadmap

Work is gated by evidence. A phase is not complete because its files exist.

**Product scope:** MarketFa is a multi-industry business operations platform. Retail POS, inventory and accounting are the first vertical pack, not the only supported business model. See [multi-industry architecture](../architecture/MULTI_INDUSTRY_PLATFORM.md) and [ADR-0008](../architecture/adr/ADR-0008-MULTI-INDUSTRY-PROFILES.md).

## M0 — Discovery and legacy baseline

- [x] Audit supplied legacy capabilities and record known architectural risks.
- [x] Confirm first launch jurisdiction: Iran.
- [x] Confirm first-release languages: Persian (fa-IR) and English (en).
- [x] Decide canonical Iran ledger unit: integer IRR; Toman is explicit input/display (1 Toman = 10 Rial).
- [ ] Select the first two vertical packs and pilot operators. Do not assume all businesses need inventory or POS.
- [ ] Approve fractional quantity, line rounding, tax rounding, and deterministic remainder allocation with an Iran accountant.
- [ ] Verify current tax rules, invoice types, exemptions, thresholds, and Moadian schema against official primary sources.
- [ ] Confirm timezone, fiscal calendar, tax and legal reporting policy.
- [ ] Define hardware and offline requirements.
- [ ] Define sanitized import/export sample and migration mapping.
- [ ] Approve MVP scenarios and measurable pilot outcomes.

**Exit:** signed-off PRD decisions and acceptance scenarios.

## M0.5 — Multi-industry foundation

- [x] Confirm the product direction: one shared platform for multiple industries.
- [x] Define industry profiles, capability packs, business profiles and the separation from role, entitlement and jurisdiction.
- [x] Add the first extensible industry catalogue and selection preview to the web shell.
- [ ] Define tenant-scoped business-profile and location schema.
- [ ] Define server-side capability activation, dependencies, entitlements and permission checks.
- [ ] Define dashboard composition contracts for module-owned cards, routes, actions and empty states.
- [ ] Select the first two production vertical packs using pilot evidence.
- [ ] Add business-profile isolation, profile-version and capability authorization tests.
- **Exit:** an owner can create a business profile, select a supported industry, see only permitted capabilities, and use a dashboard that does not force retail workflows.

## M1 — Repository and engineering foundation

- [x] Create pnpm workspace and pin Node/pnpm/dependency versions.
- [x] Add strict TypeScript baseline and lint configuration.
- [x] Add NestJS API shell and React/Vite web shell.
- [x] Add PostgreSQL Docker Compose service and health check.
- [x] Add API liveness and database-readiness endpoints.
- [x] Add first domain money primitive and Rial/Toman unit tests.
- [x] Add GitHub Actions CI workflow.
- [x] Generate and commit pnpm-lock.yaml.
- [x] Pass frozen-lockfile install, format, lint, typecheck, tests, and production builds.
- [x] Pass API/PostgreSQL/web runtime smoke checks from a clean CI checkout.
- [x] Human review and merge PR #4 (merged to `main` on 2026-10-30).
- [ ] Add Prisma only after M2 tenant/store contracts are approved; document migration workflow then.

**Exit:** engineering scaffold verified by frozen-lockfile CI and merged to `main` through PR #4. M1 is complete.

## M2 — Identity and tenancy

- [x] Provider-neutral opaque session storage, resolution, rotation and revocation core.
- [x] Server-side request actor resolution and CSRF enforcement primitives.
- [ ] Authentication provider, login/recovery endpoints, session-cookie issuance/clearing and complete browser integration (login method remains a product decision).
- [ ] Invitation delivery provider and endpoint abuse controls (delivery and rate limits remain product/security follow-up).
- [x] Initial tenant, store, terminal, membership and session schema.
- [x] Fixed role/permission map and tenant transaction boundary.
- [x] Exhaustive unit-test matrix for every defined role and permission.
- [x] End-to-end HTTP authorization matrix for every role and implemented endpoint (merged in PR #20; future business endpoints require their own coverage).
- [x] PostgreSQL RLS, privilege, composite-FK and pooled-connection integration checks for the current identity/tenancy schema.
- [ ] Extend isolation verification to each business endpoint and background job as those modules are implemented.
- [x] Atomic tenant bootstrap: tenant + first store + OWNER membership + audit event.
- [x] Invitation create/revoke/accept commands and API: hashed token, expiry, verified identity binding, replay/concurrency protection, and atomic audit.
- [x] Membership role change, suspension and removal; protect the last active OWNER (merged in PR #18).
- [x] Terminal listing, registration, credential rotation, suspension/reactivation and revocation (merged in PR #19; device-auth/sync enforcement remains future work).
- [x] Audit tenant bootstrap, invitation, membership, and terminal lifecycle security changes atomically (merged in PRs #18 and #19).

**Implementation order:** tenant bootstrap → invitation lifecycle → membership lifecycle → terminal lifecycle → current HTTP authorization matrix → authentication provider and browser login integration. PR #16's remaining diff appears to be present in `main`; verify and close it as superseded. The login method must be selected from pilot evidence; do not implement SMS OTP or password by assumption.

**Exit:** cross-tenant access tests fail closed; membership changes take effect on the next request; terminal state and assignment revocation are atomic; device-auth/sync endpoints reject suspended or revoked terminals when implemented; invitation acceptance is atomic; the API authorization matrix passes.

## M3 — Accounting kernel

- [x] Define immutable double-entry domain specification.
- [x] Define logical PostgreSQL accounting data model and constraints.
- [x] Define accounting golden, property, concurrency, and reconciliation test plan.
- [x] Record ADR-0007 for immutable double-entry posting.
- [x] Align schema with M2 tenant/store/membership contracts (implemented in open PR #21; pending CI/review/merge).
- [ ] Approve chart-of-accounts starter template and fiscal-period policy with Iran accountant.
- [ ] Approve inventory costing and COGS timing.
- [ ] Implement journal/account/period schema and migrations (implemented in open PR #21; pending CI/review/merge).
- [ ] Implement posting, idempotency, reversal, and period locking.
- [ ] Implement general ledger and trial balance.
- [ ] Pass PostgreSQL integration, property, tenant-isolation, and golden tests.

**Exit:** independent ledger fixtures reconcile exactly; no unapproved tax or account-code assumptions.

## M4 — Retail vertical pack: catalog and inventory

- [ ] Product, barcode, units and conversion.
- [ ] Supplier and purchase receipt.
- [ ] Batch, expiry and stock movement ledger.
- [ ] FEFO allocation.
- [ ] Concurrency tests for allocation and adjustments.

**Exit:** stock ledger and valuation reconcile for defined scenarios.

## M5 — Retail vertical pack: POS and operations

- [ ] Shift lifecycle and cash counts.
- [ ] Sale command and tender records.
- [ ] Atomic inventory/accounting posting.
- [ ] Discounts and permissions.
- [ ] Full/partial returns and refund.
- [ ] Receipt and terminal workflow.

**Exit:** sale-to-ledger and return-to-ledger end-to-end tests pass.

## M6 — Bounded offline and sync (capability-specific policies)

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

See [evidence-based completion plan](COMPLETION_PLAN.md) for the full dependency order, architecture risks, and exit criteria.
