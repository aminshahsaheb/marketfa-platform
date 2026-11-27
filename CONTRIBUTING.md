# Contributing

## Workflow

- **Trunk-based.** `main` is always green. Work happens on short-lived branches.
- **One topic per PR**, target ≤ 400 changed lines (excluding the lockfile and generated files). Split larger work into independently mergeable PRs.
- **Merge method: squash.** One commit per PR on `main`. Delete the branch after merging (enable _Automatically delete head branches_ in the repository settings).
- **Stacked PRs: maximum depth 2.** When the parent merges, rebase the child onto `main` immediately; never let a stack grow beyond that.
- **No diagnostic commits.** Reproduce CI failures locally instead of committing “print / inspect / remove diagnostic” steps:

  ```sh
  pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
  ```

  Database tests need PostgreSQL with the roles from `infra/postgres/init/` (see `docs/engineering/M1_FOUNDATION.md`). A PR whose history contains such commits must be squashed before merge.

- **Conventional Commits** (`feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `ci`).

## Documentation rules

- **One source of truth per fact.** Current status lives only in [`docs/STATUS.md`](docs/STATUS.md). Do not copy status, PR numbers or test counts into README, roadmap or ADRs — link instead.
- **An ADR records a real decision with options.** Number sequentially (`NNNN-title.md`), use the statuses _Proposed / Accepted / Superseded_, and supersede rather than duplicate. Two ADRs must never describe the same decision.
- **A PR that merges a milestone slice updates `docs/STATUS.md` in the same PR.**
- A docs-only PR should delete, merge or correct existing text, or add something executable (a check, a test vector). Avoid restating what another document already says.

## Definition of done

- Code, tests and (when the schema changes) a migration are in the same PR.
- CI is green; no secrets are committed.
- `docs/STATUS.md` is updated if the facts it records changed.

## Local setup

Node version: `.node-version`. Package manager: pnpm (version pinned in `package.json`). PostgreSQL 17 is what CI uses.
