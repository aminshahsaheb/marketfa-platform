# Bilingual and Iran-Localization Test Plan

## Test matrix

| Area | Persian | English | Required invariant |
|---|---|---|---|
| Authentication | RTL, Persian labels/digits | LTR, English labels/digits | Same identity and permissions |
| POS | Jalali date display, Toman/Rial explicit | Gregorian display, same currency identity | Same sale totals and journal |
| Inventory | RTL product/quantity UI | LTR product/quantity UI | Same canonical quantity and valuation |
| Accounting | Persian reports and dates | English reports and dates | Identical ledger balances |
| Tax | Persian operator workflow | English operator workflow | Same jurisdiction rules and tax result |
| Receipts | RTL shaping and printer layout | LTR layout | Same legal/business payload |
| Exports | Persian PDF/CSV | English PDF/CSV | Same underlying records |
| Settings | Persian locale | English locale | Store jurisdiction is unchanged |

## Mandatory cases
- Switching language during an open shift.
- Switching language with a held sale.
- Persian and Latin digit entry for quantities, prices, and identifiers.
- Rial/Toman input/display conversion with exact expected values.
- Jalali leap-year dates and Gregorian round trips.
- Local midnight, UTC midnight, and timezone boundary behavior.
- Tax rule effective-date boundary (before/on/after effective date).
- Tax-exempt and mixed-tax basket.
- Electronic invoice rejected after local sale posting.
- Offline sale later submitted to Moadian.
- PDF export with Persian font shaping and mixed Latin identifiers.
- Barcode/SKU and serial identifiers remain stable regardless of digit presentation.

## Acceptance
- No missing translations.
- No change in stored values or accounting outcomes when locale changes.
- No unsupported legal-compliance claims in UI.
- All tax expected values are sourced, dated, and reviewed.
