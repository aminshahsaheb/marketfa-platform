# MarketFa Platform

**An offline-capable retail operations platform with point of sale, inventory, and double-entry accounting.**

MarketFa is being rebuilt as a secure, testable, multi-store platform. The legacy application is a domain reference, not a production dependency. The new platform uses a modular monolith, PostgreSQL as the authoritative data store, and an explicit offline command queue.

> Status: **Engineering scaffold (M0 discovery and M1 foundation in progress).** This repository is not production-ready and must not be used for live financial records.

## Product principles

- Accounting correctness before convenience.
- Server-authoritative financial and inventory state.
- Offline operation with explicit limits and conflict handling.
- Tenant isolation at every data boundary.
- Immutable posted financial records; corrections use reversals.
- Auditable operations and reproducible tests.
- Small, reviewable changes with documented acceptance criteria.

## Architecture

- **Web:** React, TypeScript, Vite; Persian and English from the first release.
- **Local persistence:** IndexedDB and transactional outbox (later milestone).
- **API:** NestJS, TypeScript, validated DTOs.
- **Database:** PostgreSQL; Prisma migrations after tenant model approval.
- **Quality:** Node test runner, Vitest/Playwright as later test layers, ESLint, TypeScript, GitHub Actions.
- **Deployment:** Docker Compose for local development.

**Launch profile:** Iran-first; Persian (fa-IR) and English (en). Persian defaults to RTL/Jalali presentation; English defaults to LTR/Gregorian. UI locale is independent from store jurisdiction, currency, timezone and tax profile. See [localization](docs/architecture/LOCALIZATION.md) and [Iran compliance architecture](docs/compliance/IRAN_COMPLIANCE.md).

See [architecture overview](docs/architecture/overview.md), [PRD](docs/product/PRD.md), [ADRs](docs/architecture/adr/), and [roadmap](docs/roadmap/ROADMAP.md).

## Repository layout

```text
apps/api       NestJS API
apps/web       React web shell
packages/domain      framework-independent domain rules
packages/contracts   shared API contracts
docs           product, architecture, security, operations
.github        CI and contribution templates
docker-compose.yml   local PostgreSQL
```

## Local setup

1. Install Node.js 22.21.1 and pnpm 10.20.0.
2. Run `pnpm install`.
3. Copy `.env.example` to `.env` and use local-only credentials.
4. Run `docker compose up -d postgres`.
5. Start API and web with `pnpm dev:api` and `pnpm dev:web`.

The initial branch is a scaffold. A committed lockfile and successful clean-clone CI are still required before calling setup reproducible. Never commit real credentials or customer data.

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
