# Spec: @adt-bench/bench-cli

## Purpose
The CLI entry point that ties the packages together. Exposes `bench:smoke`, `bench:run`, and `bench:report` commands.

## Scope

- `runSmoke({ workspaceRoot, scenarioId? })` — boot the mock ADT server, run one scenario end-to-end, write a summary, return a verdict.
- `executeRun(opts)` — run a single scenario with the simulated agent, persist `result.json` / `evaluation.json` / `prompt.txt` / `transcript.jsonl` into `results/<run-id>/`.
- `writeAndPrintSummary(workspaceRoot)` — load all results, summarize, write `summary.json`, print to console.
- `loadSkillFragments(skillsSourceDir)` — read all `SKILL.md` files for prompt injection.
- `cleanResultsDir(resultsDir)` — wipe stale run dirs.

## Out of scope

- Multi-trial statistical reporting (v1.1).
- Multi-agent matrix runs (v1.1).

## Entry commands

- `pnpm bench:smoke` — runs `runSmoke('create-class-hello')` and exits 0/1.
- `pnpm bench:run --scenario <id> [--mock 0|1]` — runs a single scenario.
- `pnpm bench:report` — regenerates `results/summary.json` and prints the console report.

## Test coverage

- The smoke run is the v1 success criterion; it is exercised by `pnpm verify`.
- Unit tests cover `loadSkillFragments` and helpers.
