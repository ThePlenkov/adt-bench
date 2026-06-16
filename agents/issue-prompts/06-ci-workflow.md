# Issue #6 — GitHub Actions CI workflow

## Task

Restore the GitHub Actions CI workflow file at
`.github/workflows/ci.yml` and add a CI status badge to the README. The
workflow must run the full `pnpm verify` gate (spec-check, typecheck,
lint, test, smoke) on every push to `main` and every PR.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `package.json` (the `verify` script)
  - `nx.json` (Nx config)
  - `docs/reproducing.md` (what `pnpm verify` does)
- Background: the workflow was written in the initial commit but had to
  be removed from the initial push because the GH_TOKEN used to push
  lacked the `workflow` scope. This issue re-adds it via a normal PR
  flow (or manual upload via the GitHub UI).

## Out of scope

- Adding release pipelines, code-coverage reporting, or any
  PR-bot integrations. v1.1 only ships the verify gate.
- Anything that requires GitHub Apps or custom actions beyond the
  official `actions/checkout`, `pnpm/action-setup`, and
  `actions/setup-node`.

## Files to add or modify

- `.github/workflows/ci.yml` (re-add)
- `README.md` — add a CI status badge at the top.

## Steps

1. **Get the workflow file content** from git history:
   - The original file is in the initial commit `d314e81` (before
     amend). Run:
       `git show d314e81:.github/workflows/ci.yml > .github/workflows/ci.yml`
     If you are working from a clean clone, the file is also documented
     in `docs/design.md` (or recreate from the steps below).
2. The workflow contents (Node 22 + pnpm 11.7.0 + 5-step verify):
   ```yaml
   name: CI
   on:
     push:
       branches: [main]
     pull_request:
       branches: [main]
   jobs:
     verify:
       runs-on: ubuntu-latest
       timeout-minutes: 10
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v4
           with:
             version: 11.7.0
         - uses: actions/setup-node@v4
           with:
             node-version: 22
             cache: pnpm
         - run: pnpm install --frozen-lockfile
         - run: pnpm spec-check
         - run: pnpm typecheck
         - run: pnpm lint
         - run: pnpm test
         - run: pnpm bench:smoke
         - if: always()
           uses: actions/upload-artifact@v4
           with:
             name: adt-bench-results
             path: results/
             retention-days: 14
   ```
3. Add a CI status badge to the top of `README.md`:
   `[![CI](https://github.com/abapify/adt-bench/actions/workflows/ci.yml/badge.svg)](https://github.com/abapify/adt-bench/actions/workflows/ci.yml)`
4. Open a PR titled `ci: restore GitHub Actions workflow`. The PR's
   base must be `main`. The PR description should reference this issue
   with `Closes #6`.
5. After approval, the PR is merged. The first run of the new workflow
   should be green.

## Deliverables

- `.github/workflows/ci.yml` matching the spec above.
- README badge.
- A green CI run on `main` (post-merge).

## Test plan

- After merging, navigate to
  https://github.com/abapify/adt-bench/actions and confirm a run
  completes with a green check.
- The CI run must include all 5 verify steps and the artifact upload.

## Acceptance gate

- `.github/workflows/ci.yml` exists on `main`.
- A run of the workflow is green.
- The README badge renders (visit the README on github.com).

## Definition of done

- [ ] Workflow file restored.
- [ ] README badge added.
- [ ] First CI run is green.
- [ ] `pnpm verify` exits 0 in the runner (this is the same gate the
  workflow runs).
- [ ] PR closed; this issue closed.

## Dependencies

Blocked by #11 (verify all pnpm scripts work end-to-end first, since
the workflow will fail on the first run if any script is broken).
