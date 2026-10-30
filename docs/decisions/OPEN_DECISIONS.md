# Open Product and Architecture Decisions

This document prevents unverified assumptions from silently becoming implementation rules.

## Decision register

- **OD-001 — First launch jurisdiction:** Decided: Iran first. Tax and legal details still require local review.
- **OD-002 — Currency and display units:** Partially decided. Integer IRR ledger; explicit Toman input/display. Fractional and rounding policy pending.
- **OD-003 — Tax model:** Architecture decided: versioned Iran rules. Exact rule pack requires current official sources and Iran tax review.
- **OD-004 — Fiscal calendar and period locks:** Open. Iran accountant must confirm fiscal-year and period-close rules.
- **OD-005 — Initial customer profile:** Open. Requires retail segment, SKU count, and transaction-volume interviews.
- **OD-006 — Single-store vs multi-store MVP:** MVP currently scoped as one store per tenant. Validate with pilot requirements.
- **OD-007 — Offline capability:** Open. Define permitted operations, duration, and number of terminals.
- **OD-008 — Hardware:** Open. Inventory barcode scanner, scale, receipt printer, and cash drawer requirements.
- **OD-009 — Supplier workflow:** Open. Map purchase receipt, supplier invoice, payable, and payment.
- **OD-010 — Customer accounts:** Open. Validate credit sale, balance, limits, and settlements.
- **OD-011 — Data migration:** Open. Requires source export, data-quality review, and reconciliation mapping.
- **OD-012 — Hosting and data residency:** Open. Decide after deployment constraints and legal review.

## Confirmed cross-cutting decisions

- **OD-013:** First launch market is Iran.
- **OD-014:** Persian (fa-IR) and English (en) are first-release languages.
- **OD-015:** Persian defaults to RTL/Jalali presentation; English defaults to LTR/Gregorian presentation. User/store overrides are supported.
- **OD-016:** UI locale is independent from store jurisdiction, currency, and tax profile.
- **OD-017:** Iran tax/Moadian requirements use versioned, effective-dated rules and a dedicated adapter. Detailed compliance rules await specialist review.
- **OD-018:** Iran accounting ledger uses integer IRR; Toman is explicit input/display only. Rounding policy remains open.
- **OD-019:** M1 uses pnpm workspace, NestJS API, React/Vite web, and PostgreSQL. Frozen-lockfile CI and runtime smoke tests passed on the feature branch.

## Financial implementation blockers

- Fractional quantity × unit-price policy, statutory tax rounding, and deterministic remainder allocation.
- Current official tax rates, categories, exemptions, thresholds, invoice types, and taxpayer applicability.
- Current official Moadian API/schema version, signing/key management, and test/certification path.
- Fiscal year/period policy, chart-of-accounts template, inventory costing, and legally required reports.
- Target retail segment, pilot store, hardware, and offline workflow.

Do not close these items using assumptions from legacy code or a secondary summary. Record source, publication/effective date, reviewer, scope, and test vectors for each accepted rule.
