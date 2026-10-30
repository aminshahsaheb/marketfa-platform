# ADR 0001: Use a Modular Monolith

- **Status:** Accepted as initial direction
- **Date:** 2026-10-30

## Context

The product is early, domain rules are still being validated, and the team needs strong transactional consistency across sales, inventory, payments, and accounting. Distributed services would add deployment and consistency costs before independent scaling needs are known.

## Decision

Start with one deployable NestJS API organized into strict business modules. Keep domain logic framework-independent where practical. Modules own their data access and expose application-level interfaces.

## Consequences

- Atomic workflows can use one PostgreSQL transaction.
- Local development and deployment remain simpler.
- Module boundaries must be enforced to prevent a monolith from becoming tangled.
- Extract services only when measured scaling, team ownership, or isolation needs justify the cost.
