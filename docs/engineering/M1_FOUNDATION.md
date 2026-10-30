# M1 Engineering Foundation

**Status:** Acceptance gates passed on the M1 feature branch. PR #4 is awaiting review and merge.

## Runtime policy

- Node.js 22.21.1 is pinned in `.node-version`.
- pnpm 10.20.0 is pinned in the root `packageManager` field.
- Direct dependencies use exact versions.
- `pnpm-lock.yaml` is committed; CI uses `pnpm install --frozen-lockfile`.

## Workspace

- `apps/api`: NestJS modular-monolith API shell.
- `apps/web`: React + Vite web shell, Persian RTL first view.
- `packages/domain`: framework-independent money primitive and exact Rial/Toman conversion tests.
- `packages/contracts`: shared API contract types.
- `docker-compose.yml`: PostgreSQL 17 local service with health check.

## API health

- `GET /api/v1/health/live`: process liveness.
- `GET /api/v1/health/ready`: PostgreSQL readiness; returns 503 if DATABASE_URL is missing or PostgreSQL cannot answer SELECT 1.

## Commands

- `pnpm install --frozen-lockfile`
- `docker compose up -d postgres`
- `pnpm dev:api`
- `pnpm dev:web`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

## CI evidence

Run [40998926340](https://github.com/aminshahsaheb/marketfa-platform/actions/runs/40998926340) passed:

- Frozen dependency installation.
- Prettier, ESLint, and TypeScript checks.
- Unit tests.
- Production builds for API and web.
- API liveness and PostgreSQL readiness smoke checks.
- Web preview startup smoke check.

## Intentionally deferred

Prisma schema and first migration are aligned with M2 tenant/store design. Financial tables must not be created before tenant ownership and authorization contracts are approved. M1 does not make the product production-ready.
