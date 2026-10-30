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
