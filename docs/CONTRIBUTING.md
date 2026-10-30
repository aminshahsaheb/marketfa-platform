# Contributing

## Workflow
- Use focused branches: `feat/<area>-<short-name>`, `fix/<area>-<short-name>`, `docs/<short-name>`.
- Keep pull requests small and explain the domain impact.
- Link each change to an issue and acceptance criteria.
- Do not commit generated secrets, production data, or unreviewed database dumps.
- Add or update tests with every domain behavior change.
- Update ADRs when architecture decisions change.

## Required checks
The exact CI checks will be enabled in M1. At minimum, every executable application change must pass formatting/lint, type checking, unit tests, and build. Financial and inventory changes also require integration tests against PostgreSQL.

## Domain change checklist
- [ ] Authorization and tenant scope reviewed.
- [ ] Transaction boundary identified.
- [ ] Idempotency and retry behavior defined.
- [ ] Audit event considered.
- [ ] Money/quantity precision reviewed.
- [ ] Failure and rollback behavior tested.
- [ ] Documentation updated.
