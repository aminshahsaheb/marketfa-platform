# MarketFa Platform

**A configurable business operations platform for multiple industries, with shared finance and industry-specific workspaces.**

MarketFa is being built as a secure, testable, multi-industry platform. Each business selects its industry and receives a workspace based on enabled capabilities. Retail POS and inventory are one vertical pack, not the universal product model. The legacy application is a domain reference, not a production dependency. The new platform uses a modular monolith, PostgreSQL as the authoritative data store, and an explicit offline command queue.

> Status: M1 and the M2 tenant-administration foundation are merged (PRs #4, #8–#15, #17–#20). Authentication provider, login/recovery and browser cookie flows are not complete. M3 accounting schema foundation is under review in PR #21; posting commands and business modules are not complete. This repository is not production-ready and must not be used for live financial records.

## Product principles

- One shared core; industry-specific capability packs.
- Industry, user role, commercial entitlement, jurisdiction and UI locale are separate concepts.
- A business profile selects workflows; it does not grant permissions or claim legal compliance.
- Do not force service businesses into retail stock or POS workflows.

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
- **Database:** PostgreSQL; versioned SQL migrations and explicit repositories for RLS-sensitive operations.
- **Quality:** Node test runner, Vitest/Playwright as later test layers, ESLint, TypeScript, Prettier, GitHub Actions.
- **Deployment:** Docker Compose for local development.

**Launch profile:** Iran-first; Persian (fa-IR) and English (en). Persian defaults to RTL/Jalali presentation; English defaults to LTR/Gregorian. UI locale is independent from store jurisdiction, currency, timezone and tax profile. See [localization](docs/architecture/LOCALIZATION.md) and [Iran compliance architecture](docs/compliance/IRAN_COMPLIANCE.md).

See [architecture overview](docs/architecture/overview.md), [PRD](docs/product/PRD.md), [ADRs](docs/architecture/adr/), [roadmap](docs/roadmap/ROADMAP.md), and [completion plan](docs/roadmap/COMPLETION_PLAN.md).

## Repository layout

```text
apps/api       NestJS API and SQL migrations
apps/web       React web shell
packages/domain      framework-independent domain rules
packages/contracts   shared API contracts
docs           product, architecture, security, operations
.github        CI and contribution templates
infra          PostgreSQL local role bootstrap
docker-compose.yml   local PostgreSQL
```

## Local setup

1. Install Node.js 22.21.1 and pnpm 10.20.0.
2. Run `pnpm install --frozen-lockfile`.
3. Copy `.env.example` to `.env`. The example credentials are local-only.
4. Run `docker compose up -d postgres`.
5. Apply database migrations with `pnpm --filter @marketfa/api db:migrate`.
6. Start API and web with `pnpm dev:api` and `pnpm dev:web`.

Normal tenant-scoped API operations use `marketfa_runtime`, a non-inheriting non-superuser role without RLS bypass. Session resolution/rotation/revocation use that role; session creation uses a separate `marketfa_auth_runtime` login with execute-only access to the session-creation function. Both roles have no direct session-table access. Migrations use the separate `marketfa_owner` connection. Never use migration-owner credentials for application traffic.

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
