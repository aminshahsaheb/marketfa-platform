# Accounting Kernel — Verification Plan

**Status:** Required test specification; tests are not yet implemented or executed.

## 1. Unit tests

- Account type and normal-balance validation.
- Draft journal construction and line validation.
- Exactly-one-side debit/credit validation.
- Zero, negative, overflow, and invalid currency rejection.
- Exact BigInt sum and balance.
- Reversal line generation.
- Posting-rule version selection by effective date.
- Period date inclusion and timezone-independent accounting date.
- Account hierarchy cycle detection and non-postable parent rejection.

## 2. Property and invariant tests

Generate valid and invalid journals with varied line counts and large amounts:
- Any accepted posted journal balances exactly.
- Swapping every debit/credit produces an exact full reversal.
- Reversal of a reversal is rejected unless a separate correction workflow is explicitly designed.
- Replaying the same command ID never creates a second posted journal.
- Changing UI locale or display unit does not change canonical journal values.
- Account rename does not change historical account identity or totals.
- Posted journal data cannot be mutated through supported application paths.

## 3. PostgreSQL integration tests

Must run against real PostgreSQL, not SQLite or mocks:
- Concurrent posting with same idempotency key returns one result and one journal.
- Concurrent distinct postings allocate unique store sequence numbers.
- Cross-store account, period, source, and reversal references fail.
- Posting to CLOSED or CLOSING period fails.
- Race between posting and period close has one serialized outcome; no late posting enters a closed period.
- Trigger rejects UPDATE/DELETE of posted journal header and lines.
- Deferred balance enforcement rejects an unbalanced posted journal.
- Unique source event + posting purpose prevents duplicate financial effects.
- Transaction rollback leaves no partial journal, source status, audit event, or outbox event.
- Tenant RLS (if enabled) blocks cross-tenant access even under accidental unscoped query.

## 4. Accounting scenario golden tests

Each scenario must assert source document, journal lines, trial balance, and relevant control-account balance:
1. Opening balances with equal debits/credits.
2. Cash sale with cost recognition.
3. Card sale through clearing account.
4. Mixed cash/card tender.
5. Full return of sellable goods.
6. Return of damaged/non-restocked goods.
7. Partial return with remaining refundable quantity.
8. Purchase receipt paid immediately.
9. Purchase receipt on supplier credit (when AP module enabled).
10. Supplier payment.
11. Cash deposit/withdrawal.
12. Cash overage and shortage.
13. Manual adjustment with reason and approval.
14. Full journal reversal.
15. Posting rejected in closed period.
16. Tax-exempt and taxable cases only after approved tax rule fixtures exist.

## 5. Reconciliation tests

- Trial balance total debits = total credits.
- General ledger account movement sums to trial balance.
- Opening + debit/credit movement = closing per account.
- Balance sheet balances.
- P&L period result reconciles to retained earnings/closing policy when period-close functionality is implemented.
- Inventory valuation subledger reconciles to inventory control account.
- Cash/bank subledger reconciles to control accounts.
- Supplier/customer subledgers reconcile when enabled.

## 6. Release gates

- All unit and property tests pass.
- PostgreSQL integration tests pass under concurrency.
- Golden scenarios reviewed by an Iran accountant.
- No unexplained trial-balance or subledger difference.
- Security tests prove tenant isolation and authorization.
- Restore rehearsal preserves journals, reversals, sequence references, and audit history.

A test file existing is not a pass. Record command, environment, database version, run date, and test report.
