# Legacy Migration Policy

## Objective
Transfer valid business records without carrying forward unsafe implementation assumptions or silently changing financial meaning.

## Rules
1. Preserve the original legacy source archive and original backups as read-only evidence.
2. Record a SHA-256 inventory for the exact source snapshot used for migration.
3. Never connect migration tooling directly to production for the first test.
4. Build a versioned import format with explicit schema version.
5. Validate source structure, identifiers, referential integrity, dates, quantities, currencies, and balanced vouchers before import.
6. Map every legacy field to a target field or an explicit exclusion reason.
7. Keep source identifiers as external references for traceability.
8. Import into a staging tenant/database first.
9. Reconcile record counts, opening stock, stock value, cash/bank balances, receivables/payables if present, and trial balance.
10. Require human approval of reconciliation before cutover.
11. Keep a tested rollback path and preserve the pre-import snapshot.
12. Do not migrate authentication credentials. Users must establish new accounts.

## Required migration artifacts
- Source manifest and hashes.
- Mapping specification.
- Validation report.
- Import log with rejected-row reasons.
- Reconciliation report.
- Rollback and cutover runbook.

## Acceptance
A migration is accepted only when all required reconciliation differences are zero or explicitly explained and signed off. A successful database import alone is not success.
