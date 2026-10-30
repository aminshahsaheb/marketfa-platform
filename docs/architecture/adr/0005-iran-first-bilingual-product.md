# ADR 0005: Iran-First, Bilingual Product with Separate Locale and Compliance

- **Status:** Accepted
- **Date:** 2026-10-30

## Context
MarketFa will first launch in Iran. The product must support Persian and English from the first release. UI language, calendar presentation, store jurisdiction, currency, and tax compliance are related but not identical concepts.

## Decision
- Launch jurisdiction: Iran.
- First-release locales: Persian (`fa-IR`) and English (`en`).
- Persian defaults to RTL and Jalali presentation.
- English defaults to LTR and Gregorian presentation.
- Locale preference belongs to the user; jurisdiction, currency, tax profile, fiscal settings, and timezone belong to the store/legal entity.
- The generic accounting kernel is jurisdiction-neutral. Iran tax and Moadian behavior live in a versioned country-compliance module and adapter.
- Do not hard-code current tax rates, taxpayer eligibility, or invoice schema until verified against current official material and reviewed by an Iran tax/accounting specialist.

## Consequences
- Every released workflow needs full Persian and English translation and RTL/LTR tests.
- Changing language cannot alter canonical financial values or legal treatment.
- Jalali is a presentation/input calendar adapter; canonical dates and instants use typed machine-readable representations.
- Iran-specific invoice payloads must conform to the currently approved official schema version.
- Legal changes require effective-dated rule updates, tests, and migration notes.
