# Spec: @adt-bench/report

## Purpose
Load run records from `results/`, aggregate them into a `Summary`, optionally persist to `summary.json`, and print a human-readable console report.

## Scope
- `loadRunDir(runDir)` — reads `result.json` + `evaluation.json` from one run dir; returns null if either file is missing.
- `loadResultsDir(dir)` — loads all run dirs (any subdirectory of `dir/`).
- `summarize(records)` — aggregates per-scenario and overall counts.
- `writeSummary(dir, summary)` — writes `summary.json` to `dir`.
- `printConsoleReport(summary)` — prints a tabular console report.

## Out of scope
- Visualization beyond the console (static site is v2).
- Filtering, sorting, or grouping beyond what's in `summarize`.

## Summary shape

```ts
interface Summary {
  generated_at: string;
  total_runs: number;
  pass: number;
  fail: number;
  partial: number;
  by_scenario: Array<{
    scenario_id: string;
    runs: number;
    pass: number;
    fail: number;
    partial: number;
  }>;
  runs: RunRecord[];
}
```

## Test coverage

- `summarize` correctly aggregates counts across runs and per-scenario.
- Empty input handled.
