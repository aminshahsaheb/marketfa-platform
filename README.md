# MarketFa Platform

**An offline-capable retail operations platform with point of sale, inventory, and double-entry accounting.**

MarketFa is being rebuilt as a secure, testable, multi-store platform. The legacy application is a domain reference, not a production dependency. The new platform uses a modular monolith, PostgreSQL as the authoritative data store, and an explicit offline command queue.

> Status: **Foundation / M0-M1**. This repository is an engineering scaffold. It is not production-ready and must not be used for live financial records.

## Product principles

- Accounting correctness before convenience.
- Server-authoritative financial and inventory state.
- Offline operation with explicit limits and conflict handling.
- Tenant isolation at every data boundary.
- Immutable posted financial records; corrections use reversals.
- Auditable operations and reproducible tests.
- Small, reviewable changes with documented acceptance criteria.

## Architecture

- **Web:** React, TypeScript, Vite, PWA.
- **Local persistence:** IndexedDB via Dexie; transactional outbox.
- **API:** NestJS, TypeScript, validated DTOs.
- **Database:** PostgreSQL; Prisma migrations.
- **Quality:** Vitest, Playwright, ESLint, type checking, GitHub Actions.
- **Deployment:** Docker Compose for local development; production deployment is a later decision.

See [docs/architecture/overview.md](docs/architecture/overview.md), [docs/product/PRD.md](docs/product/PRD.md), [docs/architecture/adr/](docs/architecture/adr/), and [docs/roadmap/ROADMAP.md](docs/roadmap/ROADMAP.md).

## Repository layout

```text
apps/
  api/       NestJS application
  web/       React PWA
packages/
  contracts/ shared API contracts and schemas
  domain/    framework-independent business rules
  config/    shared tooling configuration
prisma/      database schema and migrations
docs/        product, architecture, security, operations
infra/       local development infrastructure
.github/     CI and contribution templates
```

## Local setup

The initial scaffold is being established. Runtime commands and environment requirements will be added with the first executable workspace milestone. Never commit real credentials or customer data. Copy `.env.example` to `.env` only after the relevant services are implemented.

## Non-goals for the first release

- Microservices.
- Unrestricted multi-device offline stock selling.
- Client-side authority over price, tax, stock, or accounting.
- Automatic edits to posted journal entries.
- Tax/legal compliance claims without jurisdiction-specific review.

## Security

Report suspected vulnerabilities privately to the repository owner. Do not publish secrets, access tokens, real customer data, or production backups in issues or commits.

## License

All rights reserved unless and until a license is explicitly added.
