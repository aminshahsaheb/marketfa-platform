# Project status

> Single source of truth for “what is true right now”. Update it in the **same PR** that changes the facts below. Do not repeat these facts in README, roadmap or ADRs — link here instead.

Last verified: 2026-11-09 on `main` at `364546e` (merge of PR #28).

## Quality gates (verified locally on that commit)

| Gate                | Result                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check` | pass                                                                                                                                                                                                                                                                                                                                              |
| `pnpm lint`         | pass (0 warnings)                                                                                                                                                                                                                                                                                                                                 |
| `pnpm typecheck`    | pass (api, web, domain, contracts)                                                                                                                                                                                                                                                                                                                |
| `pnpm test`         | 45–46 / 46 pass (api 35, domain 10, web 1) on PostgreSQL 16.15. One API test is intermittent locally: `migration 0010 backfills a tenant and store created under the legacy schema` fails with “terminating connection due to administrator command” (its teardown runs `DROP DATABASE … WITH (FORCE)`). Check the teardown order; confirm in CI. |
| Migrations          | `0001`–`0010` apply cleanly on PostgreSQL 16                                                                                                                                                                                                                                                                                                      |
| CI image            | PostgreSQL 17 — not re-run locally                                                                                                                                                                                                                                                                                                                |

## What is in `main`

- M1 workspace foundation (monorepo, CI, PostgreSQL bootstrap, runtime roles).
- M2 tenancy and identity slices: provider-neutral sessions, actor/CSRF guards, tenant bootstrap, invitations, membership lifecycle, terminal lifecycle, HTTP authorization matrix, row-level-security coverage tests.
- M3 accounting **schema** (`0009_accounting_schema`). No posting service yet.
- Multi-industry foundation (PR #28): business-profile schema (`0010_multi_industry_business_profiles`, one dedicated accounting book per business profile), the industry catalog in `packages/domain`, and an industry-selection screen in `apps/web`.

## What is NOT in `main`

- Authentication-provider integration, browser login and recovery.
- Accounting posting service, inventory, POS, offline sync, Iranian tax-system integration, deployment topology.
- The working point-of-sale product: it lives outside this repository (a Firebase PWA), see `docs/legacy/`.

## Open decisions that still gate work

- **Accounting-book cardinality.** `0010` gives each business profile its own default book and states that mapping several profiles to one book needs a later reviewed command. ADR 0012 still lists the cardinality decision and the review of the `0009` schema as pending before any posting service is built (`docs/decisions/OPEN_DECISIONS.md`).
- **Merge method.** PR #28 was merged with a merge commit, so its 72 commits (including CI-diagnostic ones) are now part of `main` history. `CONTRIBUTING.md` sets squash merging from now on.

## Branches

21 remote branches existed on 2026-11-09, classified against the current `main` (tip is an ancestor, net diff already present, or files absent from `main`):

- **2 merged:** `feat/multi-industry-foundation` (#28) and `feat/m3-accounting-schema-foundation` (#21).
- **17 look merged and edited since:** every file they change already exists on `main`. Delete them after confirming their PRs are merged in GitHub.
- **2 need triage** (they hold files that are not on `main`): `docs/completion-roadmap-audit` (#22) and `feat/multi-industry-onboarding` (#26).

The per-branch table is in the review package that accompanied this change (`branches-inventory.csv`). The branch policy is in `CONTRIBUTING.md`.
