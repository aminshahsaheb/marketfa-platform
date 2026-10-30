# Product Requirements Document

**Status:** Draft for discovery (M0)  
**Product:** MarketFa Platform  
**Audience:** product, engineering, pilot operators

## 1. Product intent

Build a dependable retail operations system for small and medium retailers. It must connect point of sale, inventory movements, cash control, and double-entry accounting without hiding financial state behind opaque calculations.

The first release targets one store per tenant with multiple named users and terminals. Multi-store groups are a later capability unless discovery proves they are essential to the first pilot.

## 2. Users and permissions

- **Owner:** tenant settings, users, financial reports, close periods.
- **Manager:** products, purchasing, stock operations, refunds, shift oversight.
- **Cashier:** assigned terminal, sales, permitted refunds, shift operations.
- **Accountant:** chart of accounts, journals, reconciliation, reports.
- **Viewer:** read-only access to explicitly granted views.

Every API request must derive tenant membership and role from authenticated server-side identity. Client-supplied tenant IDs are selectors, never proof of authorization.

## 3. Core workflows

1. Create tenant, owner, store, and first terminal.
2. Configure currency, timezone, fiscal calendar, tax policy, and chart of accounts.
3. Create products, barcodes, units, conversion rules, and tracked batches.
4. Receive supplier goods and record purchase cost and payable/cash settlement.
5. Open a cashier shift with an opening float.
6. Sell items; validate price, tax, discount authority, and stock allocation.
7. Post payment and inventory/accounting effects atomically.
8. Return all or part of a sale with traceable refund and stock disposition.
9. Close shift and reconcile expected versus counted tender.
10. Review ledger, trial balance, income statement, balance sheet, and stock valuation.
11. Back up, restore, and audit data.

## 4. MVP scope

### Required
- Tenant membership and role-based authorization.
- Product catalogue, barcode, unit conversions.
- Purchase receipt and stock ledger.
- Batch/expiry tracking and deterministic FEFO allocation where enabled.
- POS cart, price validation, discounts with permission limits.
- Cash/card tender recording (payment provider integration is not assumed).
- Shift open/close and cash reconciliation.
- Returns and refunds linked to original sale lines.
- Double-entry journal posting for supported events.
- General ledger and trial balance.
- Audit trail, backup/restore plan, operational health checks.
- Online-first synchronization with bounded offline capture and idempotent replay.

### Explicitly deferred
- Payroll, manufacturing, advanced CRM/loyalty, ecommerce marketplace.
- Multiple legal entities and consolidated accounting.
- Unrestricted offline stock allocation across multiple terminals.
- Automated bank feeds and payment-gateway settlement.
- Jurisdictional tax filing and electronic invoice certification until requirements are verified.

## 5. Non-functional requirements

- **Correctness:** no posted journal without balanced debits and credits.
- **Atomicity:** sale, tender, stock movements, and journal posting succeed or fail as one business transaction.
- **Idempotency:** retrying a command must not duplicate a sale, refund, payment, or journal.
- **Isolation:** cross-tenant access must fail closed.
- **Auditability:** sensitive changes record actor, time, reason, entity, and correlation ID.
- **Resilience:** offline state is visible; queued commands have explicit states and retry rules.
- **Performance:** define measurable latency targets after pilot workload measurement.
- **Accessibility:** keyboard operation and accessible labels for core POS tasks.
- **Localization:** Persian RTL and Gregorian/Jalali display needs must be confirmed in discovery; store timestamps persist in UTC with explicit timezone.

## 6. Product decisions requiring discovery

- First retail vertical and representative SKU/transaction volume.
- Country of operation and legal entity requirements.
- Currency precision and rounding policy.
- Tax inclusive/exclusive pricing and tax categories.
- Receipt and printer hardware.
- Barcode scanner and scale integration.
- Required offline duration and terminal count.
- Supplier/customer account workflows.
- Data import format from legacy MarketFa.
- Pilot success measures and support expectations.

## 7. Acceptance principles

A feature is not complete because its screen works. It must include domain rules, authorization, persistence, audit events, failure behavior, automated tests, and operator documentation. Financial workflows require ledger-level assertions and retry/concurrency tests.


## 8. Confirmed launch profile — Iran first, bilingual from day one

**Product decision:** The first commercial launch targets Iran. Persian (fa-IR) is the default product language. English (en) is a first-class supported language from the first release, not a later translation project. The architecture must allow additional locales and country-specific compliance packs without rewriting the accounting core.

### Locale and presentation
- Persian UI: RTL layout, Persian translations, Persian calendar display, Persian digit preference, and Iran-local formatting.
- English UI: LTR layout, English translations, Gregorian calendar display by default, and locale-aware number/date formatting.
- Users may change interface language independently of store legal jurisdiction and accounting settings.
- A store's legal jurisdiction, functional currency, tax profile, timezone, and fiscal calendar are store-level configuration. They are not inferred from the current UI language.
- Persist timestamps as UTC instants and store the applicable IANA timezone. Convert for display; do not store Jalali date strings as the canonical timestamp.
- Persist canonical dates as date-only values where appropriate. Provide tested Gregorian/Jalali conversion and round-trip behavior.
- All user-facing text must use translation keys. No UI string concatenation as a substitute for translation. Format money, quantities, dates, and percentages through locale-aware formatters.
- Support RTL/LTR at the component/layout level. Avoid hard-coded left/right assumptions; use logical CSS properties.

### Iran financial profile
- Iran is the initial jurisdiction. The Iran compliance profile must model Iranian tax identifiers, invoice types, applicable exemptions, tax categories/rates, and Moadian submission/response states as versioned, effective-dated configuration.
- Do not hard-code a single VAT rate or a single universal e-invoice obligation. Applicability depends on current law, taxpayer class, transaction type, thresholds, exemptions, and effective dates.
- Distinguish accounting currency and display unit. Rial (IRR) and Toman are not interchangeable labels. The exact canonical storage unit, conversion boundary, and rounding policy must be approved before accounting implementation and validated against official interface specifications.
- Sales receipts, internal POS receipts, accounting vouchers, and legally compliant electronic tax invoices are distinct document types. Never label a local receipt as a tax-compliant electronic invoice unless the applicable workflow has been accepted by the tax system or a legally valid alternative applies.
- Moadian integration must be an isolated adapter with credential protection, signing/key lifecycle, submission queue, idempotency, retry policy, status polling, error mapping, and immutable request/response audit metadata. Do not store private signing keys in the browser.
- Offline sales must clearly distinguish local provisional capture from legally submitted/accepted tax invoices. Offline capture is not proof of tax-system acceptance.

### Acceptance criteria
- [ ] Full Persian and English coverage for all released workflows, validation messages, errors, receipts, and accessibility labels.
- [ ] RTL and LTR browser tests cover POS, inventory, accounting, reports, settings, and authentication.
- [ ] Locale switching does not change stored amounts, posted journals, tax calculations, or legal jurisdiction.
- [ ] Jalali/Gregorian conversions pass leap-year, month-boundary, timezone, and round-trip tests.
- [ ] Rial/Toman examples are reviewed and pass exact arithmetic/rounding tests.
- [ ] Tax rules are effective-dated, traceable to an official source, and approved by an Iran tax/accounting reviewer.
- [ ] Moadian sandbox/official test workflow is verified before any claim of integration or compliance.
