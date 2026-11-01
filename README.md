# MarketFa Platform

**A multi-industry business operations platform with a shared core and industry-specific workspaces.**

MarketFa is an Iran-first platform. A business owner selects the type of work they do and receives a workspace built from supported capabilities. Retail POS and inventory are one vertical, not the universal data model. Service, repair, project, food-service, wholesale, manufacturing and other businesses must not be forced into fake retail workflows.

> **Repository status (2026-11-02):** M1, the M2 tenant/identity administration slices, the M3 accounting schema foundation (PR #21), and the multi-industry architecture baseline (PR #27) are merged to `main`. Provider-neutral sessions, actor/CSRF guards, tenant bootstrap, invitations, membership lifecycle, terminal lifecycle, the HTTP authorization matrix, and the accounting-book schema are present. Authentication-provider integration and browser login/recovery are not complete. Multi-industry onboarding implementation is in draft PR #28; its exact head has green CI, but it still needs final architecture review. No accounting posting service, inventory/POS vertical, industry-specific workflow, or offline sync product is complete. **This repository is not production-ready and must not be used for live financial records.**

## Product principles

- One identity and platform core; separate business profiles and domain capabilities.
- Support many kinds of work without claiming every profession-specific workflow is already implemented.
- Server-authoritative permissions, entitlements, capability activation, prices, tax, stock and accounting.
- PostgreSQL is the source of truth; browser storage is a bounded cache/outbox, never financial authority.
- Tenant and business-profile boundaries are explicit and tested.
- Immutable posted financial facts; corrections use linked reversals or compensating records.
- Exact money and quantity arithmetic, explicit rounding and auditable policy versions.
- Iran compliance is versioned and evidence-based; no unsupported legal or tax claims.
- Small, reviewable changes with CI evidence from the exact commit.

## Architecture

- **Web:** React, TypeScript, Vite; Persian RTL and English LTR.
- **API:** NestJS and TypeScript in a modular monolith.
- **Database:** PostgreSQL, SQL-first versioned migrations, RLS and composite constraints.
- **Domain:** framework-independent types and exact money rules.
- **Offline:** future bounded IndexedDB outbox with durable command IDs and server replay validation.
- **Quality:** frozen pnpm lockfile, formatting, lint, type checks, unit and PostgreSQL integration tests, builds and smoke tests.
- **Deployment:** Docker Compose for local development; production topology remains a release decision.

## Core model

The target model separates:

- **User:** a human identity.
- **Tenant:** workspace/security and customer boundary.
- **Membership:** actor's role and permissions within a tenant.
- **Business profile:** a versioned business operation and its industry template.
- **Business location:** a physical, virtual or service location.
- **Store / terminal:** retail-specific operational concepts; they are not required for every profession.
- **Accounting book:** the financial ledger boundary, associated with the relevant legal/accounting entity; it is not automatically one book per POS store.
- **Capability:** an independently owned module with server-enforced dependencies, entitlement and permission checks.
- **Jurisdiction profile:** legal/tax settings, separate from industry and UI language.

See [master architecture review](docs/architecture/MASTER_ARCHITECTURE_REVIEW.md), [architecture overview](docs/architecture/overview.md), [PRD](docs/product/PRD.md), [ADRs](docs/architecture/adr/), [open decisions](docs/decisions/OPEN_DECISIONS.md), and [roadmap](docs/roadmap/ROADMAP.md).

## Iran launch baseline

- First jurisdiction: Iran.
- First locales: Persian `fa-IR` and English `en`.
- Persian defaults to RTL/Jalali presentation; English defaults to LTR/Gregorian.
- UI locale does not select tax jurisdiction, currency, accounting rules or timezone.
- Canonical launch ledger unit: integer IRR. Toman is an explicit input/display unit; 1 Toman = 10 Rial.
- Fractional quantity, tax rounding, fiscal calendar, chart of accounts and inventory costing remain approval gates.

## Local setup

1. Install Node.js 22.21.1 and pnpm 10.20.0.
2. Run `pnpm install --frozen-lockfile`.
3. Copy `.env.example` to `.env`. Example credentials are local-only.
4. Run `docker compose up -d postgres`.
5. Apply migrations with `pnpm --filter @marketfa/api db:migrate`.
6. Start API and web with `pnpm dev:api` and `pnpm dev:web`.

Normal application traffic must use the restricted runtime roles. Migration-owner credentials must never be used for application traffic. Never expose database credentials to browsers, terminals or customer devices.

## Non-goals

- Microservices before measured need.
- Unrestricted multi-device offline stock selling.
- Client-side authority over price, tax, stock, permissions or journals.
- Direct mutation of posted journals.
- A claim that a selectable industry profile means its specialist workflow or regulatory approval is production-ready.

## Security

Report suspected vulnerabilities privately to the repository owner. Do not commit secrets, access tokens, real customer data or production backups.

## License

All rights reserved unless and until a license is explicitly added.
