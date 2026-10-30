# Quality Gates

## Change-level gates
- Formatting and lint pass.
- Type checking passes.
- Unit tests pass.
- Build succeeds.
- No secret scan finding.
- Documentation and ADR updated where behavior or architecture changes.

## Domain gates
For money, tax, discounts, returns, cost, and accounting:
- Golden examples approved by a domain reviewer.
- Boundary and invalid-input tests.
- Property-based/invariant tests where appropriate.
- Rounding behavior tested at every relevant boundary.
- No floating-point money arithmetic in authoritative code.

For inventory:
- Concurrency and negative-stock tests.
- Batch/expiry and unit-conversion tests.
- Movement ledger reconciliation.
- Return disposition tests.

For offline/sync:
- Duplicate delivery and retry tests.
- App reload/device restart tests.
- Expired/revoked device tests.
- Stale price, tax, unit, stock, and shift tests.
- Conflict and manual-review paths tested.
- Durable local persistence failure tested.

For tenancy/security:
- Cross-tenant read and write tests for every API family.
- Role matrix tests.
- Authentication/session expiry tests.
- Privileged action audit tests.

## Release gates
- PostgreSQL integration suite passes on a clean database.
- Browser E2E suite passes on supported browsers/devices.
- Backup restore rehearsal passes.
- Security review has no unresolved critical issue.
- Load tests reflect measured pilot traffic.
- Operational runbook and rollback plan are reviewed.

## Evidence discipline
A test is marked PASS only when it was executed in the stated environment and its output is retained. A test file existing is not evidence that it passes. A mocked Firebase test does not prove live Firebase behavior.
