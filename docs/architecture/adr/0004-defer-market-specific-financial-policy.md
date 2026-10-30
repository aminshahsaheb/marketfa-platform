# ADR 0004: Defer Market-Specific Financial Policy Until Discovery

- **Status:** Accepted
- **Date:** 2026-10-30

## Context
The legacy application uses integer Toman amounts and Jalali display dates. The target jurisdiction, statutory invoice requirements, tax rules, fiscal calendar, and currency policy have not yet been confirmed for the new platform. Hardcoding legacy assumptions into a new data model would create expensive migration and correctness risks.

## Decision
Do not encode jurisdiction-specific tax, invoice, currency, or fiscal-period behavior in the new domain model until M0 discovery records the target market and obtains appropriate accounting/legal review. The domain must represent currency and precision explicitly rather than assume one global currency.

## Consequences
- M0 must resolve the financial policy before the accounting kernel is implemented.
- Legacy behavior is preserved as reference evidence, not automatically adopted.
- Database and API contracts must make currency and timezone explicit.
- No tax-compliance claim is permitted without jurisdiction-specific validation.
