# ADR 0006: Currency-Aware Integer Money with IRR Accounting Base

- **Status:** Accepted engineering decision; tax-adapter field mapping remains gated
- **Date:** 2026-10-30

## Context

MarketFa launches in Iran and must support Persian/Toman display and English/IRR display. Storing floating-point monetary values risks rounding errors. Storing bare integers without currency identity is ambiguous. Toman is a common presentation unit but the accounting currency must be explicit.

## Decision

- Use a currency-aware integer money type: `Money { amountMinor: bigint, currency: CurrencyCode }`.
- For the Iran launch, post and reconcile all accounting amounts as integer Rial (IRR), with one canonical quantum equal to one Rial.
- Treat Toman as an explicit presentation/input unit only: 1 Toman = 10 Rial.
- Do not store Toman as a separate accounting currency or infer the display unit from UI language.
- Persist money in PostgreSQL BIGINT/Prisma BigInt with range checks. Serialize BigInt values as decimal strings in JSON.
- Use NUMERIC/exact decimal or rational intermediates for fractional quantities and unit-price calculations. Posted ledger amounts remain integer IRR.
- Define and version all rounding/allocation policies; exact journal balance is mandatory.
- Isolate Moadian payload mapping in the Iran compliance adapter. Confirm field units, precision, and rounding against the current official schema before live submission.

## Consequences

- The UI can display Toman or Rial without changing stored accounting data.
- English and Persian interfaces share identical canonical amounts and ledger outcomes.
- Foreign currencies can be added through an explicit currency registry and FX model, not by changing the meaning of the IRR integer.
- API clients must treat money strings as integer values, not JavaScript floating-point numbers.
- Tax compliance is not implied by this storage decision; official schema validation and specialist approval remain required.
