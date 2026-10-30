# Monetary Model and Precision Standard

**Status:** Accepted engineering decision for the Iran-first release  
**Canonical accounting currency:** IRR (Iranian Rial)  
**Default Persian display unit:** Toman, with explicit label and exact conversion  
**Money representation:** signed integer minor units + ISO currency code

## 1. Decision

Use a currency-aware integer money type:

```ts
type CurrencyCode = "IRR"; // extend from a controlled ISO 4217 registry
type Money = {
  amountMinor: bigint;
  currency: CurrencyCode;
};
```

For the Iran launch, the canonical accounting quantum is one Rial (IRR has zero ISO minor-unit decimal places). Therefore all posted accounting amounts are integer Rials. Toman is a presentation/input unit only: **1 Toman = 10 Rial**. It is not stored as a second accounting currency and must never be inferred from the language.

The database stores the currency code with each monetary amount or enforces it through an explicitly scoped ledger/accounting-currency relation. Do not store a bare integer whose currency cannot be determined.

This preserves the user's requested integer representation while keeping the model extensible to other currencies with their own ISO minor-unit exponents.

## 2. Why this is the selected model

- Exact integer arithmetic for posted balances; no binary floating-point money.
- No hidden precision loss when amounts are summed, posted, reversed, or reconciled.
- Explicit currency identity prevents mixing Rial, Toman display values, and future foreign currencies.
- Toman display is a deterministic conversion, not a second source of truth.
- API and tax adapters can map internal amounts to external schemas without contaminating the accounting kernel.
- A controlled currency registry supports later international expansion.

## 3. Rial/Toman boundary

- Canonical storage and accounting: integer IRR.
- Persian UI default: Toman display, clearly labeled.
- English UI default: IRR/Rial display unless the user explicitly selects Toman.
- Store display preference is independent from UI language; users may change it.
- Input must state or unambiguously inherit its unit from a labeled field. Never guess.
- Toman integer input is multiplied by exactly 10 to produce IRR.
- Rial input is accepted as integer Rial.
- If an IRR amount is not divisible by 10, a Toman display must preserve the remainder (for example, show a decimal Toman representation) or show Rial. Never round away Rials for convenience.
- Persist the original entered amount/unit as audit metadata where commercially or legally useful; canonical postings remain IRR.
- A Toman value must never be sent into a tax payload without an explicit, tested conversion to the unit required by the currently approved tax schema.

## 4. Arithmetic rules

- No JavaScript `number` for authoritative monetary calculations.
- Use TypeScript `bigint` for integer money. Since JSON has no BigInt type, serialize integer amounts as base-10 strings at API boundaries.
- Validate strings strictly: no exponent notation, no locale separators in canonical API payloads, no fractional IRR.
- Database: PostgreSQL `BIGINT` for bounded integer IRR amounts, with range checks; use Prisma `BigInt`. Reassess capacity before multi-currency/high-volume use. Never use PostgreSQL `REAL` or `DOUBLE PRECISION` for money.
- Quantity and unit price are not necessarily integers. Store quantity in an explicit unit and precision using PostgreSQL `NUMERIC`, not floating point.
- Calculate extended line amounts and tax bases with exact decimal/rational intermediates. Round only at explicit, versioned business-rule boundaries.
- Posted journal lines are integer IRR and must balance exactly: sum(debits) = sum(credits).
- Discount allocation, tax allocation, COGS, returns, and proportional payments must use deterministic allocation with a documented remainder rule. Remainders must be assigned deterministically; no value may disappear.
- Store the rounding policy/rule version used for each posted document.

## 5. Database shape (illustrative, not final Prisma schema)

```sql
CREATE TABLE money_amounts (
  id UUID PRIMARY KEY,
  amount_minor BIGINT NOT NULL,
  currency_code CHAR(3) NOT NULL,
  CHECK (currency_code = 'IRR')
);
```

In high-volume domain tables, prefer typed columns instead of a generic money table, for example:
- `amount_irr BIGINT NOT NULL`
- `unit_price_irr BIGINT NOT NULL`
- `currency_code CHAR(3) NOT NULL DEFAULT 'IRR'` where the schema supports multiple currencies.

For a general multi-currency ledger, use `amount_minor BIGINT` plus `currency_code CHAR(3)`, and maintain separate functional-currency amounts and explicit exchange-rate snapshots where required. Do not sum different currencies without a conversion event and recorded rate.

Quantities:
- `quantity NUMERIC(p,s)` with unit code and explicit precision.
- `unit_price` and derived line totals must use exact decimal arithmetic.
- Never encode quantity scale in an undocumented integer convention.

## 6. API contract

Example request:

```json
{
  "amountMinor": "12500000",
  "currency": "IRR",
  "enteredAmount": "1250000",
  "enteredUnit": "TOMAN"
}
```

- Monetary integers cross JSON as decimal strings.
- The server parses to BigInt, validates currency and unit, performs the exact conversion, and recalculates totals.
- The server does not trust browser-computed totals.
- API responses return canonical amount strings and separately formatted display values only when a presentation endpoint explicitly requests them.

## 7. Tax/Moadian compatibility

The accounting core stores exact IRR amounts. The Iran tax adapter is responsible for mapping each internal field to the exact amount unit, precision, permitted range, and rounding rule required by the **currently approved version** of the official invoice schema.

Important:
- The law identifies the Moadian system as the final authority for registration, issuance, and inquiry of electronic invoices; local POS receipts are not automatically proof of tax-system acceptance.
- Publicly accessible older technical documents (including the 1401 technical connection document) show numeric invoice amount fields and describe asynchronous submission and status inquiry. These are historical references, not proof of the current 1405 schema or its exact unit/precision.
- Do not assume that every amount field is Rial or Toman based on a field name or a third-party implementation.
- Before enabling live submission, archive the current official schema/instructions, record version/effective date, confirm the unit for every amount field, and create golden payload tests against official examples or an approved test environment.
- The adapter must reject out-of-range or inexact conversions rather than silently round.
- Tax invoice status must reflect authoritative Moadian responses, not merely successful local submission.

## 8. Required tests

1. Toman-to-Rial conversion: 1, 10, 100, and large boundary values.
2. Rial-to-Toman exact display including non-multiples of 10.
3. Round-trip conversion with no loss.
4. Negative amounts for refunds/reversals and zero handling.
5. BigInt values above JavaScript MAX_SAFE_INTEGER.
6. API JSON string parse/serialize and malformed input rejection.
7. Database min/max range constraints.
8. Quantity × unit-price calculations at fractional quantities.
9. Discount allocation and deterministic remainder distribution.
10. Tax calculation and rounding at every approved legal boundary.
11. Balanced journal invariants after sales, returns, and reversals.
12. Locale switch invariance: identical canonical IRR postings in Persian and English.
13. Moadian adapter mapping and rejection for precision/range mismatches.

## 9. Decisions still requiring external approval

This engineering choice does not determine:
- statutory tax rates, exemptions, or taxpayer eligibility;
- the exact current Moadian field units and precision;
- legal rounding/truncation for each invoice field;
- whether a particular taxpayer/workflow must issue a specific invoice type;
- treatment of FX gains/losses and foreign-currency subledgers.

These require current official technical documents and review by an Iran tax/accounting specialist.
