# M1 Engineering Foundation

**Status:** Initial workspace scaffold on the M1 feature branch. CI and clean-clone verification remain pending.

## Runtime policy
- Node.js 22.21.1 is pinned in `.node-version`.
- pnpm 10.20.0 is pinned in the root `packageManager` field.
- Direct dependencies use exact versions.
- A committed `pnpm-lock.yaml` is a required release gate. Until it exists, dependency resolution is not fully reproducible and M1 is not complete.

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
- `pnpm install`
- `docker compose up -d postgres`
- `pnpm dev:api`
- `pnpm dev:web`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

## Intentionally deferred
Prisma schema and first migration are aligned with M2 tenant/store design. Financial tables must not be created before tenant ownership and authorization contracts are approved. Do not mark M1 complete until a lockfile is committed, CI passes, and clean-clone local setup is verified.
