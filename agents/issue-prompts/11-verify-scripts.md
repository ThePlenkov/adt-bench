# Issue #11 — Verify all pnpm scripts work end-to-end

## Task

Audit every script in the root `package.json` `scripts` block. Run each
in a clean clone. Fix any path mismatches, missing entry points, or
broken dependencies. The goal is that `pnpm verify` (the umbrella
script) works the same on a fresh checkout as it does on the dev
machine.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `package.json` — the `scripts` block
  - `packages/bench-cli/src/` — current entry points
  - `docs/reproducing.md` — documented commands
- Background: in the rush of the v1 bootstrap, some `pnpm bench:*`
  scripts may reference paths that drift. This is a hygiene pass.

## Out of scope

- Adding new features. This is a correctness pass.
- Performance tuning.

## Files to add or modify

- `package.json` (the `scripts` block)
- Possibly new entries under `packages/bench-cli/src/` (e.g. an explicit
  `verify.ts` if it doesn't exist).
- `docs/reproducing.md` — update any examples that don't match the
  final scripts.

## Steps

1. Open `package.json`. List every entry in `scripts`.
2. For each script:
   - Run it: `pnpm <script>`.
   - Verify the entry point exists at the referenced path.
   - If it doesn't, fix the path or create the entry.
3. Specifically verify:
   - `pnpm spec-check` → `node tools/spec-check.mjs`
   - `pnpm typecheck` → runs across all packages
   - `pnpm lint` → eslint
   - `pnpm test` → vitest run across all packages
   - `pnpm bench:smoke` → `tsx packages/bench-cli/src/smoke.ts`
   - `pnpm bench:run` → `tsx packages/bench-cli/src/run.ts`
   - `pnpm bench:report` → `tsx packages/bench-cli/src/report.ts`
   - `pnpm verify` → runs all of the above in order
4. Add any missing entries under `packages/bench-cli/src/`.
5. Time the full verify run. Target: < 60 seconds on a clean clone
   (the smoke run is the bottleneck; everything else is < 10s).

## Deliverables

- All `pnpm` scripts work on a clean clone.
- `pnpm verify` exits 0 in < 60 seconds.
- `docs/reproducing.md` matches the actual scripts.

## Test plan

- The verify run itself is the test. Run it; expect 0 and < 60s.

## Acceptance gate

- `pnpm verify` exits 0 in < 60 seconds on a clean clone.
- All `pnpm bench:*` subcommands work.

## Definition of done

- [ ] All scripts verified.
- [ ] Total `pnpm verify` time < 60s.
- [ ] Docs updated.
- [ ] Conventional commit: `chore: verify all pnpm scripts work end-to-end`.
- [ ] PR opened; this issue closed.

## Dependencies

Blocked by none.

Blocks #6 (the CI workflow runs `pnpm verify`; if it doesn't work, CI is
red).
