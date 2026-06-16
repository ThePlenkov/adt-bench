# Issue #15 — Connector comparison dashboards

## Task

Extend the v2 static website (issue #14) with a **connector comparison
view**: a side-by-side table of the configured agents/mcps/CLIs with
per-scenario pass-rate, mean tokens, mean cost, mean wall time. Visual
charts (histograms, scatter) are out of scope for v2.1; the v2.2+ work
adds them.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `docs/website.md` (from #14)
  - `docs/project-views.md`
  - `packages/report/src/report.ts` — the multi-trial aggregate
  - `docs/result-schema.md`
- Background: this is the dashboard that justifies the entire
  benchmark. The data must be honest: same scenario, same LLM, only
  the tool surface changes.

## Out of scope

- Live-updating dashboards. Static export only.
- Connector-internals metrics (e.g. raw REST call counts vs. agent-level
  tool calls) — that's a research question for v3.

## Files to add or modify

- `packages/web/src/pages/connectors.astro` (new) — the comparison
  table.
- `packages/web/src/components/ConnectorRow.astro` (new)
- `packages/web/scripts/build-data.mjs` (from #14) — also compute per-agent
  aggregates.
- `packages/report/src/report.ts` — add a per-agent aggregate helper.
- `docs/website.md` — document the connector view.

## Steps

1. Extend `Summary` with a `by_agent` block: per `agent_id`:
   `{ runs: number, pass: number, fail: number, partial: number, by_scenario: { ... } }`.
2. Update `summarize()` in `report.ts` to compute this from `runs[]`.
3. Add `pnpm bench:report` to print a short agent-leaderboard table to
   the console too.
4. Add the `/connectors` page in the Astro site: a table with one row
   per agent, columns for pass-rate / mean cost / mean wall-time.
5. Add a small "trust" section: "Pass-rates below are based on N runs;
   see `trials.astro` for confidence."

## Deliverables

- Per-agent aggregate in `Summary` and `console report`.
- `/connectors` page in the website.
- 2 new unit tests for the per-agent aggregation.

## Test plan

- Unit: `report.spec.ts > summarize aggregates per agent`.
- Manual: visit `/connectors` after a multi-agent run.

## Acceptance gate

- `pnpm verify` exits 0.
- A multi-agent run produces a populated `by_agent` block in
  `summary.json`.

## Definition of done

- [ ] Per-agent aggregation in `Summary`.
- [ ] Console report shows the leaderboard.
- [ ] Astro `/connectors` page renders.
- [ ] `pnpm verify` exits 0.
- [ ] Conventional commit: `feat(web): connector comparison dashboard`.
- [ ] PR opened; this issue closed.

## Dependencies

Blocked by #14 (the static website) and #7 (multi-trial reporting).
