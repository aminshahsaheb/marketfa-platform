# Accounting Kernel — Domain Specification

**Status:** Design baseline for M3; implementation not yet complete  
**Initial jurisdiction:** Iran  
**Functional currency for the initial Iran ledger:** IRR  
**Accounting model:** double-entry, accrual-capable, immutable posted journal

## 1. Purpose and boundaries

The accounting kernel is the authoritative record of financial effects. Sales, returns, purchases, supplier/customer settlements, cash movements, inventory valuation, and tax subledgers create accounting events through controlled application use cases.

The kernel owns:
- Chart of accounts and account lifecycle.
- Fiscal periods and posting-date validation.
- Journal drafts, validation, posting, and reversal.
- General ledger, trial balance, and financial statement read models.
- Source-document traceability and reconciliation.
- Accounting audit history.

The kernel does not own:
- POS pricing/cart behavior.
- Stock allocation and batch/expiry rules.
- Tax law interpretation or Moadian transport.
- UI locale, Jalali formatting, or receipt layout.
- Payment-provider network calls.

Other modules request accounting through an application port such as `AccountingPostingPort`. They must not write journal tables directly.

## 2. Core invariants

1. Every posted journal has at least two lines.
2. Every line has exactly one positive side: debit or credit; never both and never neither.
3. Sum(debit_irr) equals sum(credit_irr) exactly for every posted journal.
4. All amounts are non-negative integer Rials at the journal-line level. Direction is represented by debit/credit, not signed amounts.
5. A posted journal is immutable. No update/delete of its header or lines.
6. A correction is a separately posted reversal linked to the original, followed by a corrected new journal if needed.
7. Every posted journal belongs to exactly one store, one fiscal period, one currency, one source event (or an explicitly classified manual journal), and one idempotent command.
8. The source event and its journal are committed atomically for internal operations.
9. A source event cannot produce duplicate posted journals for the same posting purpose.
10. Every journal line references an active, postable account in the same store's chart.
11. No ordinary posting is permitted into a closed period.
12. All reads and writes are tenant/store scoped and authorization checked server-side.
13. Audit metadata records actor, command ID, request/correlation ID, timestamps, and rule/version context.
14. The ledger never derives its posted truth from UI state or a client-calculated report.

## 3. Account model

Each store has a chart of accounts (CoA), normally initialized from a reviewed template and then versioned.

Account fields:
- Stable UUID.
- Store ID.
- Code (unique within store and chart version policy).
- Name key / localized display names (fa and en).
- Account type: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE.
- Optional parent account.
- Normal balance: DEBIT or CREDIT.
- Posting allowed flag.
- Active/inactive lifecycle.
- Optional control-account classification and reconciliation policy.

Rules:
- Parent/group accounts are non-postable.
- A used account is never hard-deleted.
- Deactivation is blocked while active workflows still reference it; historical journals remain readable.
- Account code changes must not rewrite historical journal identity.
- Account type and normal balance changes require controlled migration/reclassification, not casual editing.
- Tax and statutory account mappings belong to versioned compliance/configuration, not hard-coded UI assumptions.

Do not publish a universal Iran account-code template until reviewed by an Iran accountant. The system may ship a configurable starter template, clearly marked as a template.

## 4. Journal lifecycle

### Draft
- Editable only by authorized roles.
- Not included in posted ledger balances or financial statements.
- Must reference a valid open period and store.
- Drafts may be abandoned with an audit event; they are not deleted silently.

### Posted
- Created only through the posting use case.
- All invariants validated in one database transaction.
- Gets a store-scoped sequence number and immutable posted timestamp.
- Included in ledger and reports.
- Header and lines cannot be changed or deleted.

### Reversed
A posted journal is never mutated to become reversed. The original remains POSTED in history and a separate reversal journal is posted with opposite debit/credit lines and a link to the original. A derived display status may show that it has been reversed, but the original posted facts remain unchanged.

A unique constraint prevents more than one full reversal of the same journal unless a reviewed partial-reversal model is explicitly introduced. Partial reversal is deferred; do not implement it by weakening the full-reversal invariant.

## 5. Fiscal periods and dates

- Store event instants in UTC and retain the store's IANA timezone.
- Accounting posting date is a canonical date-only value (Gregorian/ISO date in storage), not a localized Jalali string.
- Persian UI may display the same date in Jalali; English UI may display Gregorian.
- A period has start_date, end_date, status (OPEN, CLOSING, CLOSED), and close metadata.
- Period boundaries are defined as date-only values in the store's accounting calendar. The fiscal-year start and period length are configuration approved by the accountant.
- Closing is a controlled workflow: pre-close checks, lock new postings, reconcile control accounts, approve close, then mark CLOSED.
- Reopening a closed period requires a privileged, reasoned, audited operation. Prefer a current-period adjustment when legally/accountingly appropriate.
- No assumption is made here that the Iranian fiscal year always matches the Jalali calendar year. This must be confirmed for the target business and statutory reporting.

## 6. Posting workflow

1. Authenticate actor and resolve tenant/store membership.
2. Authorize the exact command (e.g. post sale, post manual journal, reverse journal).
3. Validate command schema and durable idempotency key.
4. Begin PostgreSQL transaction.
5. Lock/check store period and source document in deterministic order.
6. Validate period open, account postability, currency, and source state.
7. Generate journal lines from a versioned posting rule; do not accept arbitrary client-supplied accounting lines for automated events.
8. Validate each amount and exact balance using integer arithmetic.
9. Insert journal header and lines; allocate sequence safely.
10. Mark source event posted and persist its journal reference.
11. Write audit event and transactional outbox event.
12. Commit. On any failure, roll back all local database effects.

No external network request is made inside this transaction. Moadian submission, payment provider calls, and notification delivery happen through durable outbox workers after commit and have independent state machines.

## 7. Source-event posting rules

Each automated journal is generated by a versioned posting rule. Example conceptual mappings (not final account codes or tax advice):

| Source event | Typical debit side | Typical credit side |
|---|---|---|
| Cash sale | Cash / card clearing / receivable | Sales revenue + applicable tax liability |
| Cost recognition | Cost of goods sold | Inventory |
| Customer refund | Sales returns / tax adjustment as applicable | Cash / card clearing / customer payable |
| Return to sellable stock | Inventory | Cost of goods sold |
| Purchase received on credit | Inventory / applicable recoverable tax | Supplier payable |
| Supplier payment | Supplier payable | Cash / bank |
| Cash shortage/overage | Approved variance account | Cash / variance counterpart |

Actual tax, discount, inventory cost, and statutory treatment must be approved and represented in effective-dated posting rules. The examples above are structural illustrations only.

## 8. Reconciliation and read models

Required initial read models:
- General ledger by account and date range.
- Trial balance (opening, debit movement, credit movement, closing).
- Profit and loss for a period.
- Balance sheet as of a date.
- Cash and bank control-account reconciliation.
- Inventory control account vs inventory valuation subledger.
- Customer and supplier control accounts vs their subledgers when those modules are enabled.

All reports must state store, currency, period/date range, timezone/calendar presentation, and whether they include posted entries only. Draft journals are excluded from statutory/posted reports.

Reconciliation differences must be visible; never auto-plug unexplained differences to a suspense account.

## 9. Manual journals

Manual journal capability is privileged and controlled:
- Maker/checker approval may be required based on amount/risk.
- Reason and supporting-document reference are mandatory.
- No direct manual journal posting into closed periods.
- No posting to protected control accounts unless explicitly permitted.
- Manual journal cannot impersonate a sale, purchase, payment, or tax invoice source event.
- All changes to drafts and approval transitions are audited.

## 10. Security and tenant isolation

- Store scope is derived from authenticated membership, never trusted from request body alone.
- Every account, period, journal, line, and source reference is checked against the same store.
- Database foreign keys should include store scope where practical (composite uniqueness/FKs).
- PostgreSQL row-level security may be used as defense in depth; it does not replace application authorization.
- The API database role should not have unrestricted ability to rewrite posted rows. Use restricted repositories/permissions and/or triggers to reject mutation of posted records.
- Audit log access is separately permissioned.

## 11. Deferred decisions

Do not encode these without evidence:
- Final chart-of-accounts template and account codes.
- Fiscal-year start and exact statutory closing procedure.
- Tax account mapping, VAT rates, exemptions, and invoice posting rules.
- Inventory costing method (FIFO/weighted average/etc.) and COGS timing.
- Treatment of discounts, deposits, gift cards, credit notes, bad debt, and FX.
- Maker/checker thresholds and role matrix.
- Partial journal reversal.
- Multi-currency functional ledger and FX revaluation.

## 12. Definition of done for the kernel

- Schema and migrations reviewed.
- Posting API is idempotent under concurrent retries.
- Database prevents cross-store references and posted-row mutation.
- Balanced-journal invariant is enforced at the posting boundary and independently verified in the database.
- Full reversal is exact and linked.
- Closed-period posting is rejected under concurrency.
- General ledger and trial balance reconcile exactly.
- Golden and property-based tests pass on PostgreSQL.
- Tenant and role matrix tests pass.
- Backup/restore preserves immutable journal history and sequence references.
