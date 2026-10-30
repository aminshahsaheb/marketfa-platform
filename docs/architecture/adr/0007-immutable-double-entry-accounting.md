# ADR 0007: Immutable Double-Entry Accounting Kernel

- **Status:** Accepted design baseline; implementation pending M2 schema alignment and accountant review
- **Date:** 2026-10-30

## Context
MarketFa must keep POS, payments, inventory, tax subledgers, and financial reports consistent. Financial events need atomic posting, auditability, exact balancing, and safe correction.

## Decision
- Use an accrual-capable double-entry journal as the authoritative financial ledger.
- Use integer IRR amounts for the initial Iran ledger, with exact arithmetic and explicit rounding boundaries.
- Separate chart of accounts, fiscal periods, journal headers, journal lines, posting-rule versions, and accounting audit events.
- Automated source events create journals through module-owned application ports and versioned posting rules.
- Post a source event and its journal in one PostgreSQL transaction.
- A posted journal and its lines are immutable. Corrections use a separate full reversal and a new corrected entry.
- Enforce exact balance, store scope, open-period checks, durable idempotency, and unique source posting purpose.
- Use database constraints, deferred validation/triggers, and restricted write paths as defense in depth.
- Reports read posted ledger facts and reconcile to operational subledgers.

## Consequences
- No module may write accounting tables directly.
- No browser-generated journal is trusted for automated posting.
- Drafts do not affect financial reports.
- Period closing must serialize against posting.
- Partial reversal, statutory chart-of-accounts templates, tax mapping, and final fiscal calendar remain deferred until evidence/review.
- M3 implementation begins only after M2 store/tenant identity contracts are stable.
