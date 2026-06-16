# Issue #7 — Multi-trial reporting

## Task

Extend `bench:run` and `bench:report` to support multi-trial runs:
`pnpm bench:run --trials N` runs each (scenario, agent) cell N times and
emits per-cell mean / median / stdev for `duration_ms`, `metrics.tokens`,
`metrics.cost_usd`, and `metrics.tool_calls.total`. Add a new
`pnpm bench:matrix` command that runs the full (agents × scenarios × trials)
grid and writes a `matrix.json` summary.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `docs/result-schema.md`
  - `packages/report/src/report.ts` (current `Summary` shape)
  - `packages/bench-cli/src/cli.ts` and `run.ts`
  - `packages/agent-runner/src/result.ts`
- Background: v1 only records one trial per cell, so the data is noisy
  and can't drive statistical conclusions. v1.1 needs the option to
  repeat and aggregate.

## Out of scope

- Statistical tests (t-test, etc.). Just descriptive stats for now.
- Caching runs across invocations. Each `bench:run` invocation is
  independent; the directory is wiped if `--clean` is passed.

## Files to add or modify

- `packages/bench-cli/src/cli.ts` — add `--trials N` and `--parallel K`
  flags. New `bench:matrix` subcommand.
- `packages/bench-cli/src/run.ts` — accept the new flags.
- `packages/bench-cli/src/smoke.ts` — pass `--trials 1` by default.
- `packages/report/src/report.ts` — extend `Summary` with a `trials`
  block: per (scenario_id, agent_id) cell, an array of `RunResult`
  plus an `aggregate` object.
- `packages/report/src/report.spec.ts` — new tests for the aggregate.
- `packages/bench-cli/specs/SPEC.md` — document the new commands.
- `docs/result-schema.md` — document the new fields.
- `docs/reproducing.md` — update the `pnpm bench:run` examples.

## Steps

1. Add a `trials: number` option to `executeRun` (default 1).
2. Loop `trials` times, appending each `RunResult` to `results/<scenario>/trial-N/result.json`.
3. Add `parallel: number` (default 1) using `Promise.all` on chunks.
4. Extend `Summary` schema with a `trials` map keyed by
   `${scenario_id}::${agent_id}`. Each value: `{ runs: RunResult[]; aggregate: { mean, median, stdev, p95 } }`.
5. Implement `mean/median/stdev` for `duration_ms`, `tokens.input`,
   `tokens.output`, `cost_usd`, `tool_calls.total`.
6. Add `bench:matrix` that takes `--agents mastracode,claude-code` and
   `--scenarios all` and iterates.
7. Update `printConsoleReport` to show a separate "Trial statistics"
   table.

## Deliverables

- `pnpm bench:run --trials 3` runs 3 trials and reports aggregates.
- `pnpm bench:matrix --agents mastracode --scenarios all --trials 3`
  produces a `results/matrix.json`.
- `pnpm bench:report` prints the trial statistics.

## Test plan

- Unit: `report.spec.ts > summarize aggregates across trials`.
- Smoke: `pnpm bench:run --scenario create-class-hello --trials 3`
  produces 3 result files plus the trial statistics in the summary.

## Acceptance gate

- `pnpm verify` exits 0.
- A 3-trial run produces 3 result files and a populated `trials` block
  in the summary.

## Definition of done

- [ ] `--trials` and `--parallel` flags work.
- [ ] `bench:matrix` command implemented.
- [ ] Aggregates computed correctly (one unit test).
- [ ] `pnpm verify` exits 0.
- [ ] Conventional commit: `feat(report): multi-trial aggregates and bench:matrix`.
- [ ] PR opened; this issue closed.

## Dependencies

Blocked by #1 (real runner with telemetry is needed for meaningful
trial statistics — the simulated agent's `duration_ms` is 0).

Blocks #14 (the static website needs aggregates to be interesting).
