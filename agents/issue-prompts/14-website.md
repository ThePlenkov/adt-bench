# Issue #14 — Static results website (Astro)

## Task

Build a static website (Astro) under `packages/web/` that reads
`results/summary.json` and renders the per-scenario pass-rate view.
The site is a static export; no server runtime.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `packages/report/src/report.ts` (the `Summary` shape)
  - `docs/result-schema.md`
  - `docs/project-views.md` (the 6 planned project views)
  - `docs/backlog.md`
- Background: v1 prints a console report. v2 turns that into a
  browsable website so anyone (including non-CLI users) can compare
  runs.

## Out of scope

- Real-time updates. The site is a static export of the latest
  `summary.json`.
- Authentication or per-user views. Public read-only.

## Files to add or modify

- `packages/web/package.json` (new)
- `packages/web/astro.config.mjs` (new)
- `packages/web/src/pages/index.astro` (new) — pass-rate table.
- `packages/web/src/pages/trials.astro` (new) — trial statistics.
- `packages/web/src/pages/agents.astro` (new) — agent leaderboard.
- `packages/web/src/components/RunCard.astro` (new)
- `packages/web/public/summary.json` — copied from `results/summary.json`
  at build time.
- `packages/web/scripts/build-data.mjs` (new) — copies `results/summary.json`
  and any per-run files into `packages/web/public/`.
- Root `package.json` — add `web:dev` and `web:build` scripts.
- `docs/website.md` (new) — design notes.
- `README.md` — link to the website.

## Steps

1. `pnpm add -D astro` at the root.
2. Scaffold the `packages/web/` directory per the Astro "Hello World"
   template; keep the structure minimal.
3. Write `scripts/build-data.mjs`:
   - Read `results/summary.json`.
   - For each `runs[]`, copy `result.json` to
     `packages/web/public/runs/<run_id>/result.json` and
     `transcript.jsonl` similarly.
   - Write `packages/web/public/summary.json`.
4. Author the 3 Astro pages (Table layout, no interactivity needed for
   v1).
5. Add `pnpm web:dev` and `pnpm web:build` scripts.
6. Add `docs/website.md` describing the planned views (mirroring
   `docs/project-views.md`).
7. Update the README with a "Website" section.

## Deliverables

- `pnpm web:dev` starts a local dev server with the latest `summary.json`.
- `pnpm web:build` produces a static `dist/` in `packages/web/dist/`.
- 3 pages: index, trials, agents.
- `docs/website.md` design notes.

## Test plan

- Manual: `pnpm web:dev` and visit `http://localhost:4321`.
- Visual check: the per-scenario pass-rate table matches the console
  output from `bench:report`.

## Acceptance gate

- `pnpm web:dev` starts without errors.
- The 3 pages render with sample data (commit a sample `summary.json`).
- `pnpm verify` still exits 0 (the web build is not part of verify in
  v1.1).

## Definition of done

- [ ] Astro project scaffolded.
- [ ] 3 pages implemented.
- [ ] `pnpm web:dev` and `pnpm web:build` work.
- [ ] `docs/website.md` written.
- [ ] README updated.
- [ ] Conventional commit: `feat(web): static Astro results website`.
- [ ] PR opened; this issue closed.

## Dependencies

Blocked by #7 (multi-trial reporting — the website needs aggregates to
be interesting).

Blocks #15 (the connector-comparison dashboard is a superset of this).
