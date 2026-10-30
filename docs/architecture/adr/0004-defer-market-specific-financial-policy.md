# ADR 0004: Defer Unverified Market-Specific Financial Rules

- **Status:** Superseded in part by ADR-0005 and ADR-0006; tax and statutory policy deferral remains active
- **Date:** 2026-10-30

## Context

The legacy application uses Toman amounts and Jalali date presentation. The new product later confirmed Iran as its first launch jurisdiction, Persian and English as first-release locales, and integer IRR as the canonical accounting unit. Current tax obligations, invoice rules, fiscal-period details, and field-level Moadian schema requirements still require authoritative evidence and specialist review.

## Decision

- ADR-0005 supersedes the earlier uncertainty about initial jurisdiction and language.
- ADR-0006 supersedes the earlier uncertainty about the canonical Iran ledger unit and Rial/Toman display conversion.
- Do not hard-code tax rates, taxpayer applicability, invoice schema fields, statutory rounding, fiscal-period rules, or account templates without current official evidence and appropriate Iran accounting/tax review.
- Legacy behavior remains evidence, not an automatic specification.

## Consequences

- M0 discovery and professional review remain mandatory for statutory behavior.
- Database and API contracts retain explicit currency and timezone semantics.
- No tax-compliance claim is permitted until the actual workflow and current technical specification have been verified.
