# Open Product and Architecture Decisions

This document prevents unverified assumptions from silently becoming implementation rules.

| ID | Decision | Why it matters | Owner / evidence needed | Status |
|---|---|---|---|---|
| OD-001 | First launch jurisdiction | Tax, invoices, accounting, privacy, data residency | Product owner + Iran tax/accounting review | **Decided: Iran first** |
| OD-002 | Currency and display units | Rial/Toman handling, minor units, rounding | Product owner + Iran accountant + official schema | **Partially decided: integer IRR ledger and explicit Toman display; fractional/rounding policy pending** |
| OD-003 | Tax model | Inclusive/exclusive tax, exemptions, rates, rounding | Iran tax specialist + current official rules | **Partially decided: versioned Iran rules; exact rule pack pending review** |
| OD-004 | Fiscal calendar and period locks | Posting rules and statutory reporting | Iran accountant | **Partially decided: Jalali operational calendar; fiscal-period policy pending** |
| OD-005 | Initial customer profile | Retail vertical, SKU count, transaction volume | Operator interviews | Open |
| OD-006 | Single-store vs multi-store MVP | Tenant and store model scope | Pilot requirements | Open |
| OD-007 | Offline capability | Permitted operations, duration, number of terminals | Connectivity tests + operator interviews | Open |
| OD-008 | Hardware | Barcode scanner, scale, receipt printer, cash drawer | Pilot equipment inventory | Open |
| OD-009 | Supplier workflow | Purchase receipt, supplier invoice, payable, payment | Operator workflow mapping | Open |
| OD-010 | Customer accounts | Credit sale, balance, limits, settlements | Operator workflow mapping | Open |
| OD-011 | Data migration | Source export, data quality, reconciliation | Legacy data sample + mapping | Open |
| OD-012 | Hosting and data residency | Availability, backups, compliance, cost | Deployment constraints | Open |

A decision may move to accepted only when its evidence and consequences are recorded. Architecture choices that depend on an open product decision must be marked provisional.


## Confirmed cross-cutting decisions

| ID | Decision | Status |
|---|---|---|
| OD-013 | First launch market is Iran | Decided |
| OD-014 | Persian (fa-IR) and English (en) are first-release languages | Decided |
| OD-015 | Persian defaults to RTL/Jalali presentation; English defaults to LTR/Gregorian presentation | Decided as presentation defaults; user/store overrides must be supported |
| OD-016 | UI locale is independent from store jurisdiction, currency, and tax profile | Decided |
| OD-017 | Iran tax/Moadian requirements use versioned, effective-dated rules and a dedicated integration adapter | Decided as architecture; detailed compliance rules pending specialist review |

Open items still blocking financial implementation:
- Fractional quantity × unit-price policy, legal tax rounding, and deterministic remainder allocation.
- Applicable tax rates, categories, exemptions, thresholds, invoice types, and exact taxpayer applicability.
- Official Moadian API/schema version, signing and key management requirements, and certification/test path.
- Fiscal year/period policy, chart-of-accounts template, inventory costing, and legally required reports.
- Target retail segment, pilot store, hardware, and offline workflow.

Do not close these items using assumptions from old MarketFa code or a non-authoritative summary. Attach source document, publication/effective date, reviewer, and test cases to each accepted rule.
