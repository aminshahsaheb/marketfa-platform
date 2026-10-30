# Data Integrity Rules

These rules are acceptance criteria, not optional implementation suggestions.

## Money and quantities

- Never use JavaScript Number arithmetic as the authoritative money calculation.
- Define currency, minor-unit precision, rounding mode, and rounding stage.
- Use database NUMERIC for money when minor units are not sufficient.
- Quantity precision is product/unit specific and explicit.
- Unit conversion is versioned or snapshotted on transaction lines so later edits do not rewrite history.

## Journal invariants

- Each posted journal belongs to one tenant and accounting period.
- Total debits equal total credits in the journal currency/base-currency policy.
- A posted journal cannot be edited or deleted.
- Correction creates a linked reversal and, where needed, a replacement journal.
- Journal lines reference valid accounts and carry immutable account-code/name snapshots where reporting history requires them.
- Draft journals are distinct from posted journals.
- Closed periods reject ordinary posting; reopening requires privileged, audited action.

## Inventory invariants

- Stock on hand is derived from stock movements or a controlled projection of them.
- Every movement has a source reason and reference.
- No stock movement is silently deleted.
- Batch-tracked products retain batch and expiry identity.
- FEFO allocation is deterministic and skips expired or blocked stock.
- Negative stock policy is explicit per tenant/product and must not be bypassed by offline replay.
- Concurrent allocation uses row locks or atomic conditional updates.

## Sales and returns

- Sale posting is idempotent.
- Sale lines preserve product description, SKU, unit, quantity, unit price, discount, tax, and cost snapshots.
- Tender totals reconcile to amount due under an explicit rounding policy.
- Returns reference original sale lines and cannot exceed the remaining returnable quantity/value.
- Refund and returned-stock disposition are separate decisions.
- Damaged goods do not return to sellable stock.
- A return creates the required stock and accounting compensation entries.

## Audit

- Record actor, tenant, action, entity type/id, timestamp, reason where required, and correlation ID.
- Audit records are append-only to application roles.
- Privileged changes, permission changes, period close/reopen, stock adjustments, refunds, and backup restores are audited.
