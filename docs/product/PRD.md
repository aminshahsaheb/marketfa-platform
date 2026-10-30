# Product Requirements Document

**Status:** Draft for discovery (M0)
**Product:** MarketFa Platform
**Audience:** product, engineering, pilot operators

## 1. Product intent
Build a dependable retail operations system for small and medium retailers. Connect point of sale, inventory movements, cash control, and double-entry accounting with transparent financial state. MVP target: one store per tenant with multiple named users and terminals. Multi-store groups remain deferred unless discovery proves they are essential.

## 2. Users and permissions
- **Owner:** tenant settings, users, financial reports, period close.
- **Manager:** products, purchasing, stock operations, refunds, shift oversight.
- **Cashier:** assigned terminal, sales, permitted refunds, shift operations.
- **Accountant:** chart of accounts, journals, reconciliation, reports.
- **Viewer:** read-only access to explicitly granted views.
Every API request derives tenant membership and role from authenticated server-side identity. A client-supplied tenant ID is a selector, never authorization proof.

## 3. Core workflows
1. Create tenant, owner, store, and first terminal.
2. Configure currency, timezone, fiscal calendar, tax profile, and chart of accounts.
3. Create products, barcodes, units, conversion rules, and tracked batches.
4. Receive supplier goods and record purchase cost and payable/cash settlement.
5. Open cashier shift with opening float.
6. Sell items with server validation of price, tax, discounts, and stock allocation.
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
- Batch/expiry tracking and deterministic FEFO where enabled.
- POS cart, price validation, permission-controlled discounts.
- Cash/card tender recording; payment-provider integration is not assumed.
- Shift open/close and cash reconciliation.
- Returns/refunds linked to original sale lines.
- Double-entry journal posting for supported events.
- General ledger and trial balance.
- Audit trail, backup/restore plan, operational health checks.
- Online-first synchronization with bounded offline capture and idempotent replay.

### Explicitly deferred
- Payroll, manufacturing, advanced CRM/loyalty, ecommerce marketplace.
- Multiple legal entities and consolidated accounting.
- Unrestricted offline stock allocation across multiple terminals.
- Automated bank feeds and payment-gateway settlement.
- Tax filing and electronic invoice certification until legal and technical requirements are verified.

## 5. Non-functional requirements
- **Correctness:** no posted journal without exactly balanced debits and credits.
- **Atomicity:** sale, tender, stock movements, and journal posting succeed or fail as one local transaction.
- **Idempotency:** retries do not duplicate sale, refund, payment, or journal effects.
- **Isolation:** cross-tenant access fails closed.
- **Auditability:** sensitive changes record actor, time, reason, entity, and correlation ID.
- **Resilience:** offline state is visible; queued commands have explicit states and retry rules.
- **Performance:** targets are set after pilot workload measurement.
- **Accessibility:** keyboard operation and accessible labels for core POS tasks.
- **Localization:** complete Persian RTL and English LTR support, with tested Jalali/Gregorian presentation.

## 6. Confirmed launch profile — Iran, bilingual from day one
The first commercial launch targets Iran. Persian (fa-IR) and English (en) are first-release locales. Locale is independent from store jurisdiction, functional currency, tax profile, timezone, and fiscal calendar.
- Persian defaults to RTL, Jalali date presentation, and configurable Persian digits.
- English defaults to LTR and Gregorian date presentation.
- Users may change locale independently from store legal settings.
- Store timestamps are UTC instants with an IANA timezone; accounting dates are canonical date-only values. Jalali strings are never canonical timestamps.
- All UI strings use translation keys. Use logical CSS properties and locale-aware formatters.

## 7. Confirmed Iran money profile
- Canonical Iran accounting ledger: integer Rial (IRR), currency explicitly identified.
- Toman is an explicit input/display unit only; 1 Toman = 10 Rial.
- No authoritative monetary calculation uses binary floating point. JSON APIs serialize integer amounts as decimal strings.
- Fractional quantity × unit-price, tax rounding, and deterministic remainder allocation remain gated on specialist-approved rules.
- UI locale must never alter canonical amounts or accounting postings.

## 8. Iran tax and electronic invoices
- Tax rules, taxpayer applicability, exemptions, invoice types, and rates are versioned and effective-dated.
- Do not hard-code a universal VAT rate or universal e-invoice obligation.
- Internal POS receipts, accounting vouchers, and legally compliant electronic tax invoices are distinct documents.
- Moadian integration is an isolated adapter. Its current official schema, field units, precision, signing/key lifecycle, test path, and status handling must be verified before live integration or compliance claims.
- Offline capture is not proof of Moadian acceptance.

## 9. Product decisions still requiring discovery
- First retail vertical and representative SKU/transaction volume.
- Pilot store/operator and measurable success criteria.
- Fiscal-year start, period-close procedure, and statutory reporting requirements.
- Fractional quantity, line rounding, tax rounding, and remainder policy.
- Chart-of-accounts template and inventory costing/COGS timing.
- Receipt/printer, barcode scanner, scale, and cash-drawer hardware.
- Offline duration, number of terminals, and permitted offline commands.
- Supplier/customer account workflows and legacy data migration mapping.
- Hosting, privacy, and data-residency requirements.

## 10. Acceptance principles
A feature is not complete because its screen works. It requires domain rules, authorization, persistence, audit events, failure behavior, automated tests, and operator documentation. Financial workflows require ledger-level assertions and retry/concurrency tests. A test is PASS only after execution with retained evidence.
