# MarketFa — Master Architecture and Engineering Review

**Review date:** 2026-11-02  
**Repository:** `aminshahsaheb/marketfa-platform`  
**Main snapshot:** `ed0e37c44b7358d2e77e7f62978bfce43966594c`  
**Review method:** ten specialist engineering perspectives, repository evidence, open-PR/CI inspection and explicit decision gates.

> This is a structured architecture review performed by one assistant using ten specialist viewpoints. It is not a real ten-person peer review, legal opinion, accountant approval, penetration test or production-readiness certification.

## 1. Executive assessment

MarketFa has a sound early foundation: a TypeScript modular monolith, PostgreSQL, SQL-first migrations, server-side session primitives, tenant membership and role controls, RLS/composite-key tests, tenant bootstrap, invitation/membership/terminal lifecycle commands, exact integer IRR money and a CI workflow.

The product direction is now broader than the original retail scope. MarketFa must let a business owner select the kind of work they do and receive a suitable workspace. This is a platform architecture problem, not a screen-design problem. The data model must distinguish tenant, business profile, location, store/POS, accounting book, capability, entitlement, role permission, jurisdiction and locale.

**The repository is not a usable multi-industry product yet.** The main branch is a foundation. It does not contain completed authentication-provider integration, business-profile implementation, accounting posting services, inventory, POS, service workflows, offline sync, tax adapters or production operations.

The safest next step is to agree the business-profile/location/accounting-book boundaries, correct the two open PRs and then implement vertical workflows in evidence-based order. Do not merge the current PRs merely to make the roadmap look complete.

## 2. Evidence snapshot

### Main branch

- `main` is `ed0e37c44b7358d2e77e7f62978bfce43966594c` as of 2026-11-02.
- M1 and the M2 tenant/identity administration slices through PR #20 are merged.
- PR #21 accounting schema foundation is merged.
- PR #27 multi-industry architecture baseline is merged.
- Main does not yet contain the PR #28 profile/onboarding implementation.

### Merged PR #21 — accounting schema

- Merged to `main`; the schema scopes accounts, periods, journals and sequences by `accounting_book_id`, not by `store_id`.
- It adds database invariants and PostgreSQL integration coverage for accounting schema behavior.
- It does not add posting application services, durable command-result idempotency, sequence allocation commands, period close/reopen commands, general-ledger/trial-balance read models or source-module integration.
- Approved chart of accounts, fiscal calendar, rounding/tax and inventory costing policies remain open.

### Open PR #28 — multi-industry profile/onboarding

- PR: https://github.com/aminshahsaheb/marketfa-platform/pull/28
- Branch: `feat/multi-industry-foundation`.
- Base: current `main` at `ed0e37c44b7358d2e77e7f62978bfce43966594c`.
- The live PR page is the source of truth for the current head SHA and ahead/behind count.
- The branch is cleanly based on current main. The PR is open and ready for review, not merged.
- Earlier exact-head CI passed. CI for the latest head is queued/running; do not reuse an earlier green result as proof for this head.
- It adds versioned industry/capability catalogues, business profiles, accounting-book links, generic business locations, optional stores, legacy backfill, public catalogue API and bilingual selection/preview UI.
- Regulated profiles start with `PENDING_APPROVAL` capability states. There is no specialist approval workflow or capability activation command.
- Store creation is now rejected unless the selected profile has an active `point_of_sale` default. This safeguard has an integration test.
- The frontend now rejects unsupported profile versions and duplicate active industry IDs. It supports only presentation version 1 at this stage.
- The picker is still a selection/preview screen. It does not create a complete workspace dashboard or implement any profession-specific end-to-end workflow.
- Authentication-provider/login/recovery, statutory tax workflows, posting services, module-owned dashboard routes/actions and offline sync remain incomplete.
- CodeRabbit produced a summary but did not complete a full review because of its review quota. Its path filter excluded `pnpm-lock.yaml`. A completed human architecture review remains required.

### Duplicate PR cleanup

PRs #22, #24, #25 and #26 are closed as superseded/duplicates. PR #26's obsolete/divergent branch was replaced by PR #28. PR #21 and PR #27 are merged. PR #28 is the only current multi-industry implementation PR described here.


## 3. Ten specialist perspectives

### 1) Product and domain architecture

**Finding:** “Every occupation” cannot be delivered by a long static list of job titles. A stable platform needs broad business models, optional subtypes and an Other-business path. Each selected profile is a template, not a promise that its workflows are live.

**Decision:** pilot one or two verticals first. Keep the taxonomy extensible. Make each vertical own its workflow and data. Do not turn the shared dashboard into a universal retail dashboard.

**Acceptance:** an owner can select a pilot profile, see available vs planned modules, complete setup, and use at least one end-to-end workflow without irrelevant retail records.

### 2) Data and domain modeling

**Finding:** tenant, business profile and location are distinct. A service business may have an office, a project site or a service area but no POS store. A store is not a generic location.

**Decision:** target `Tenant → BusinessProfile → BusinessLocation`. Store/POS is optional. Membership is tenant-scoped initially; finer profile/location grants can be added when the permission model requires them. Preserve historical references and versioned profiles.

**Acceptance:** cross-tenant/profile/location foreign keys and authorization tests; no fake store required for service onboarding; profile changes never rewrite historical documents.

### 3) Finance and accounting

**Finding:** integer IRR and immutable double-entry journals are appropriate foundations. However, the proposed accounting schema is store-scoped. That risks one ledger per retail location and does not fit non-retail businesses or multiple locations under one legal entity.

**Decision:** define an AccountingBook for the legal/accounting entity or approved business-profile scope. Locations are dimensions unless the accountant requires separate books. Keep currency, fiscal calendar, chart of accounts, inventory costing and rounding as explicit policy.

**Acceptance:** exact balance, one idempotent posting result under concurrent retries, unique sequence allocation, close/post serialization, linked reversal, general ledger/trial balance reconciliation and accountant-reviewed golden cases.

### 4) Security and privacy

**Finding:** tenant RLS, role maps and server-side sessions are good controls. They do not replace API authorization. Multi-industry adds sensitive domains and additional scope boundaries. The current profile migration does not gate regulated defaults.

**Decision:** apply least privilege at tenant, profile, location, module and record level as needed. Use data minimization, purpose limitation, retention and audited privileged actions. Regulated capabilities remain blocked until review.

**Acceptance:** threat model covers each trust boundary; cross-tenant/profile/location negative tests; session and recovery tests; no raw secrets in logs; security verification mapped to OWASP ASVS 5.0.0 as a test catalogue, not a certification claim.

### 5) Backend and transaction architecture

**Finding:** the modular monolith is the right starting point. Financial and operational workflows need typed commands, explicit transaction boundaries, durable idempotency, deterministic locks, audit and outbox. External network calls must not run inside database transactions.

**Decision:** each module owns its writes and exposes application interfaces. Cross-module commands coordinate one PostgreSQL transaction only when the business invariant requires atomicity. External effects are asynchronous and reconciled.

**Acceptance:** failure injection proves rollback; retries return stored outcomes; lock ordering is documented; no partial source/stock/journal/audit state.

### 6) Frontend, product UX and accessibility

**Finding:** a profile picker is not a complete workspace. Navigation and dashboard content must reflect server-authorized capabilities. Unknown server capabilities must not silently disappear. Persian/English support must cover whole workflows, not just headings.

**Decision:** module-owned navigation, dashboard cards, actions, empty states and permission metadata. Use accessible keyboard/focus behavior and WCAG 2.2 AA as the target baseline. Show planned/unavailable/approval-required states explicitly.

**Acceptance:** browser E2E for each pilot journey, keyboard-only operation, screen-reader labels, RTL/LTR layout tests and locale-switch invariance.

### 7) Offline, terminals and distributed consistency

**Finding:** offline stock, shift and return operations can conflict across devices. Device registration alone is not device authentication. Local storage can fail, be cleared or be unavailable.

**Decision:** online-first, bounded offline capture. Persist command IDs before send. Revalidate actor, terminal, price, tax, stock, shift, permissions and policy on replay. Revoked terminals fail closed. Unsafe commands enter needs_review or reject.

**Acceptance:** duplicate/out-of-order delivery, reload/crash, storage quota, clock drift, revocation while offline, stale stock and competing return tests.

### 8) Localization, legal rules and regulated industries

**Finding:** UI language, calendar, currency, jurisdiction and industry are independent. Iran tax/Moadian rules change and cannot be inferred from a profile name or an old technical document.

**Decision:** canonical IRR ledger; explicit Toman conversion; canonical dates; versioned jurisdiction and tax adapters. Every legal rule has an official source, effective date, taxpayer/transaction scope, reviewer and golden vectors. No compliance claim without approval.

**Acceptance:** Persian/Jalali and English/Gregorian produce identical canonical postings; official current tax sources are archived; specialist review approves field units, rounding, invoice types and outage behavior.

### 9) Data engineering, analytics and migration

**Finding:** operational transactions, audit events and product analytics serve different purposes. Mixing them risks leaking PII and turning telemetry into an unreliable financial source. The legacy Firebase system has useful behavior but unsafe trust and offline assumptions.

**Decision:** PostgreSQL is operational truth. Use versioned event contracts and analytical read models only where needed. Minimize PII in telemetry. Import legacy data through a versioned staging pipeline with hashes, rejected-row logs and reconciliation. Never migrate credentials.

**Acceptance:** source manifest and hashes; field mapping; validation report; zero or explained reconciliation differences; retention and access policy; no analytics event used to post accounting facts.

### 10) Platform, reliability, testing and operations

**Finding:** CI and PostgreSQL tests are a useful base. Production readiness still needs restore drills, observability, capacity evidence, security review, deployment controls and incident/rollback procedures. A green CI run is not a release certificate.

**Decision:** use exact-commit CI evidence, immutable migrations, dependency/security scans, backup/restore rehearsals, structured logs/metrics/traces and measured load tests. Set SLO, RPO and RTO from pilot workload and business impact rather than inventing numbers now.

**Acceptance:** clean migration run, tested restore with ledger/audit verification, actionable alerts, documented incident process, supported-browser matrix, pilot load profile and no unresolved critical defect.

## 4. Critical architecture corrections and remaining gates

| ID   | Finding                                                  | Current evidence / required action                                                                                                                                                                         | Gate                                     |
| ---- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| A-01 | Earlier multi-industry PR ancestry was divergent         | Resolved by closing PR #26 and rebuilding the implementation in PR #28 directly on current main.                                                                                                           | Resolved for PR #28 branch hygiene       |
| A-02 | Regulated defaults must not activate during onboarding   | PR #28 sets regulated profile capabilities to `PENDING_APPROVAL`. Specialist evidence/reviewer workflow and server activation gates are still absent.                                                      | Before any regulated workflow is enabled |
| A-03 | Every business must not require a retail store           | PR #28 adds generic locations and optional stores. Latest head rejects Store creation when the profile lacks active `point_of_sale`. Verify latest-head CI and retain integration coverage.                | Before non-retail onboarding merge       |
| A-04 | Accounting must not be scoped by POS store               | PR #21's merged schema uses `accounting_book_id`. PR #28 links profiles to books and creates one book per profile at bootstrap. Legal-entity mapping and shared-book policy remain open.                   | Before accounting posting services       |
| A-05 | Capability activation gates are incomplete               | Implement release support, profile eligibility, dependencies, entitlement, permission, setup, jurisdiction, location scope and specialist approval.                                                        | Before module APIs are exposed           |
| A-06 | Profile versions must be explicit                        | PR #28 has one ACTIVE version per industry in the database and rejects frontend versions other than the supported presentation version. Add migration and historical-record tests before version upgrades. | Before profile-version rollout           |
| A-07 | Unknown capability contracts must not disappear silently | PR #28 rejects unknown capability keys and unsupported profile versions. Add observability and browser tests for contract mismatch and localized failure states.                                           | Before catalogue release                 |
| A-08 | Documentation must report real repository state          | README, roadmap and this review are updated on the PR branch. Keep the main snapshot separate from unmerged PR state.                                                                                      | Before merge                             |



## 5. Target data boundaries

A practical target is:

`User → Membership → Tenant → BusinessProfile → BusinessLocation`

Optional branches:

- `BusinessLocation → Store/POS → Terminal`
- `LegalEntity/BusinessProfile → AccountingBook`
- Operational document → explicit profile, location and source scope.
- Journal → accounting book, source reference and optional location dimension.

Do not over-normalize before pilot evidence. Do not collapse distinct concepts just to reduce table count. Use stable IDs, composite foreign keys, explicit lifecycle states, immutable historical snapshots and versioned policy references.

## 6. Delivery sequence

1. **Product gate:** select pilot verticals, legal entity model, location model, book scope and acceptance scenarios.
2. **Branch hygiene:** keep PR #28 based on current main; verify latest-head CI, resolve actionable review findings, and retain accurate PR/roadmap evidence.
3. **Identity completion:** authentication provider, login/recovery/cookies, rate limits, invitation delivery and support controls.
4. **Profile foundation:** profile version, location, capability lifecycle and regulated approval gate.
5. **Accounting kernel:** book-scoped schema, command owner boundary, idempotency, sequences, period locks, reversals, audit/outbox and read models.
6. **Pilot verticals:** complete one or two workflows end to end; do not build many empty menus.
7. **Offline:** implement only after online workflows and terminal authentication are safe.
8. **Pilot readiness:** security review, restore, monitoring, load, accessibility, training and support.
9. **Controlled rollout:** import only after reconciliation and rollback rehearsal.

## 7. Data and quality evidence required

For each pilot, record:

- number of users, roles, locations and terminals;
- average and peak daily commands/documents;
- concurrent writes and expected retry rate;
- item/service catalogue size and history retention;
- network outage duration and offline command mix;
- recovery objectives and legal record retention;
- representative financial and operational golden scenarios.

Do not set performance targets before these inputs exist. Run load tests against a documented workload model and retain raw results.

Required test layers:

- unit/property tests for exact domain rules;
- real PostgreSQL integration tests for constraints, RLS, locking and rollback;
- API authorization matrix for every endpoint;
- browser E2E for every pilot journey;
- RTL/LTR, calendar, digit, currency and accessibility tests;
- replay/concurrency/offline tests;
- backup/restore and migration tests;
- security verification mapped to a pinned standard version.

## 8. External engineering references

These references inform verification methods. They do not certify MarketFa and do not replace Iranian legal/accounting review.

- OWASP Application Security Verification Standard **5.0.0**: https://owasp.org/www-project-application-security-verification-standard/ — stable requirements for web/API security verification.
- NIST SP 800-218, Secure Software Development Framework **1.1**: https://csrc.nist.gov/pubs/sp/800/218/final — secure software development practices.
- W3C Web Content Accessibility Guidelines **2.2**: https://www.w3.org/TR/wcag/ — testable accessibility requirements.
- OpenTelemetry semantic conventions: https://opentelemetry.io/docs/concepts/semantic-conventions/ — consistent trace, metric and log attributes.

## 9. Completion rule

Do not mark a phase complete because a PR exists, a schema compiles, a screen renders or a unit test file was added. Close a gate only when the exact commit has passing CI, relevant PostgreSQL/browser/security evidence, reviewed domain policy and documented operational behavior.

The current correct status is **foundation established; architecture corrections and pilot decisions remain; not production-ready**.
