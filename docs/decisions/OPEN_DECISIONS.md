# Open Product and Architecture Decisions

This document prevents unverified assumptions from silently becoming implementation rules.

| ID | Decision | Why it matters | Owner / evidence needed | Status |
|---|---|---|---|---|
| OD-001 | First launch jurisdiction | Tax, invoices, accounting, privacy, data residency | Product owner + local accountant/legal review | Open |
| OD-002 | Currency and display units | Rial/Toman handling, minor units, rounding | Product owner + golden examples | Open |
| OD-003 | Tax model | Inclusive/exclusive tax, exemptions, rates, rounding | Accountant + sample invoices | Open |
| OD-004 | Fiscal calendar and period locks | Posting rules and statutory reporting | Accountant | Open |
| OD-005 | Initial customer profile | Retail vertical, SKU count, transaction volume | Operator interviews | Open |
| OD-006 | Single-store vs multi-store MVP | Tenant and store model scope | Pilot requirements | Open |
| OD-007 | Offline capability | Permitted operations, duration, number of terminals | Connectivity tests + operator interviews | Open |
| OD-008 | Hardware | Barcode scanner, scale, receipt printer, cash drawer | Pilot equipment inventory | Open |
| OD-009 | Supplier workflow | Purchase receipt, supplier invoice, payable, payment | Operator workflow mapping | Open |
| OD-010 | Customer accounts | Credit sale, balance, limits, settlements | Operator workflow mapping | Open |
| OD-011 | Data migration | Source export, data quality, reconciliation | Legacy data sample + mapping | Open |
| OD-012 | Hosting and data residency | Availability, backups, compliance, cost | Deployment constraints | Open |

A decision may move to accepted only when its evidence and consequences are recorded. Architecture choices that depend on an open product decision must be marked provisional.
