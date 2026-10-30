# Localization and Internationalization Standard

**Status:** Accepted baseline for the Iran-first bilingual release  
**Default locales:** Persian `fa-IR`, English `en`

## 1. Non-negotiable separation

These are separate concepts and must never be inferred from one another:
- UI locale: language and presentation direction.
- Store jurisdiction: legal country and applicable compliance profile.
- Functional currency: currency used by the store's books.
- Display currency/unit: how an amount is shown to a user.
- Calendar system: presentation calendar; canonical dates remain machine-readable.
- Timezone: IANA timezone used to interpret local business time.

Changing UI language must never alter stored values, tax rules, posted journals, or legal documents.

## 2. Locale behavior

| Concern | Persian (`fa-IR`) | English (`en`) |
|---|---|---|
| Direction | RTL | LTR |
| Default calendar display | Jalali | Gregorian |
| Digits | Persian digits by default; configurable | Latin digits by default |
| Translation | Persian catalogue | English catalogue |
| Currency labels | Explicit IRR/Rial or Toman label | Explicit IRR/Rial or Toman label |
| Date/time | Locale-aware, store timezone | Locale-aware, store timezone |

English is not synonymous with a foreign jurisdiction. An English-speaking user operating an Iranian store still uses the Iran tax profile and the store's configured currency.

## 3. Implementation rules

- Use translation keys for every visible string, including errors, empty states, receipts, exports, accessibility labels, and notifications.
- No string concatenation for translated sentences. Use named interpolation parameters and plural rules.
- Use locale-aware number/date/percent formatting; never hand-build separators.
- Use logical CSS properties (`margin-inline-start`, `padding-inline-end`, `text-align: start`) rather than hard-coded left/right layout.
- Components must declare direction at the application/route boundary and support nested direction only when explicitly required.
- Store locale preference per user; store legal and financial settings per store.
- Persist instants in UTC; persist business dates as date-only values where appropriate; store IANA timezone.
- Jalali is a display/input calendar adapter. Test conversion at leap years, year boundaries, month boundaries, DST transitions, and timezone boundaries.
- Never persist localized date or digit strings as canonical identifiers or timestamps.
- Exports must state their locale, calendar, timezone, currency, and unit in metadata or headers.

## 4. Money display

- Never display an unlabeled number as a currency amount.
- Make the unit explicit: IRR (Rial) or Toman. Do not silently divide/multiply by ten.
- Keep exact canonical amount and display formatting separate.
- Rounding occurs only at documented domain boundaries; formatting must not change the amount.
- Legal invoice payloads use the exact units, precision, and truncation/rounding rules of the currently approved official schema, not the UI locale formatter.

## 5. Required automated tests

- Full key coverage: no missing English or Persian translation key.
- RTL/LTR visual and interaction tests for POS, inventory, accounting, reports, settings, authentication.
- Locale switch invariance: same canonical money, quantities, tax result, and journal before/after language switch.
- Jalali/Gregorian round trips, leap-year cases, month/year boundaries, timezone edge cases.
- Persian/Latin digits input parsing and normalized canonical values.
- Currency labels and Rial/Toman conversion golden vectors.
- PDF/CSV exports in both locales, including Persian font and text shaping checks.
- Receipt printer layout for RTL and LTR.
- No layout assumptions based on physical left/right direction.

## 6. Release gate

A feature is not bilingual until its entire workflow is translated and tested in both directions. A Persian-only screen with an English navigation shell does not meet this standard.
