# Spec: @adt-bench/report

## 1. Purpose

Loads run records from `results/`, aggregates them into a `Summary`,
optionally persists to `summary.json`, and prints a human-readable
console report. The package is the boundary between the harness's
per-run files and the human-facing summary.

## 2. Public surface

The package exports exactly the following symbols from `src/index.ts`:

```ts
export interface RunRecord {
  run: AgentRunResult;          // from @adt-bench/agent-runner
  evaluation: Evaluation;        // from @adt-bench/evaluator
  runDir: string;                // absolute path to results/<run_id>/
}

export interface ScenarioAggregate {
  scenario_id: string;
  runs: number;
  pass: number;
  fail: number;
  partial: number;
}

export interface Summary {
  generated_at: string;          // ISO 8601
  total_runs: number;
  pass: number;
  fail: number;
  partial: number;
  by_scenario: ScenarioAggregate[];
  runs: RunRecord[];
}

export async function loadRunDir(runDir: string): Promise<RunRecord | null>;
export async function loadResultsDir(dir: string): Promise<RunRecord[]>;
export function summarize(records: RunRecord[]): Summary;
export async function writeSummary(dir: string, summary: Summary): Promise<string>;
export function printConsoleReport(summary: Summary): void;
```

**Total exports: 9** (3 interfaces + 6 functions).

## 3. Behaviour contracts

### 3.1 `loadRunDir(runDir)`

- Reads `<runDir>/result.json` and `<runDir>/evaluation.json` as
  UTF-8.
- Parses each with `JSON.parse`. Does NOT validate against the
  AgentRunResult / Evaluation Zod schemas (tolerant: corrupt files
  are reported as `null`, not thrown).
- Returns `null` if either file is missing or unparseable.
- Returns `{ run, evaluation, runDir }` on success.
- The returned `run` and `evaluation` are raw objects, not
  Zod-validated. Downstream code that needs validation should call
  the schema's `.parse()` itself.

### 3.2 `loadResultsDir(dir)`

- Reads `dir` non-recursively.
- For each entry that is a directory, calls `loadRunDir(join(dir, name))`.
- Returns the array of `RunRecord`s, in the order returned by
  `readdir` (filesystem-defined order, usually alphabetical but
  platform-dependent).
- Skips entries where `loadRunDir` returned `null`. Does NOT throw.

### 3.3 `summarize(records)`

- Counts `pass` / `fail` / `partial` across all records.
- Groups by `record.run.scenario_id`:
  - For each unique `scenario_id`, computes `runs`, `pass`, `fail`,
    `partial`.
- Returns the `Summary` object. `generated_at` is the current time
  (`new Date().toISOString()`).
- The `runs` field is the input array verbatim.
- `total_runs` is `records.length`.

### 3.4 `writeSummary(dir, summary)`

- Creates `dir` if it does not exist (`mkdir { recursive: true }`).
- Writes `<dir>/summary.json` with `JSON.stringify(summary, null, 2)`.
- Returns the absolute path of the written file.
- Throws if the file system operation fails.

### 3.5 `printConsoleReport(summary)`

- Writes the report to `console.log`. MUST NOT use any other
  destination (no file output, no stderr, no logger).
- Output format:
  ```
  === ADT-Bench summary ===
  Generated: <generated_at>
  Total runs: <n>  (pass=<p>, partial=<pp>, fail=<f>)

  By scenario:
    - <id>: <runs> runs  (pass=<p>, partial=<pp>, fail=<f>)
    ...

  Per run:
    [<OVERALL>] <scenario>  agent=<agent>  duration=<s>s  run_id=<id>
          <VERDICT> <rule>: <detail>
          ...

  ```
- `OVERALL` and `VERDICT` are uppercased, padded to 7 and 4
  characters respectively.
- An empty `by_scenario` list prints `No scenarios recorded.`
- Per-run output is always present (even if `runs` is empty: prints
  only the header).

## 4. Invariants

1. **Tolerant loading:** `loadRunDir` and `loadResultsDir` MUST NOT
   throw on missing or corrupt files. They return `null` or skip
   them.
2. **Deterministic summarize:** given the same input array, the
   `Summary` is identical except for `generated_at`. Aggregation
   does not depend on filesystem order (the input array is the
   source of truth).
3. **No mutation of inputs:** `summarize` and `printConsoleReport`
   MUST NOT modify the input `records` or `summary` objects.
4. **Console output is plain text:** `printConsoleReport` does not
   use ANSI color codes or write to files.
5. **No external I/O except filesystem:** the only I/O is
   `readFile` (load) and `writeFile` (writeSummary).

## 5. Error model

- **Filesystem errors during write:** `writeSummary` throws the
  underlying Node `Error` (e.g. `EACCES`, `ENOSPC`).
- **JSON parse errors during load:** returned as `null` (silent
  skip). The error is not logged; the caller's console report will
  show fewer runs than expected.

## 6. Test matrix

| Test name | Covers contract |
|---|---|
| `summarize > aggregates counts across runs and scenarios` | §3.3 |
| `summarize > handles empty input` | §3.3 |

(`loadRunDir`, `loadResultsDir`, `writeSummary`, and
`printConsoleReport` are not unit-tested in v1.1 — they are exercised
end-to-end by the smoke run. A test is added in the matrix testing
PR.)

## 7. Non-goals

- HTML / JSON-LD / multi-format output. Console + JSON only.
- Statistical analysis (mean / median / stdev). Tracked in #7.
- Filtering, sorting, or grouping beyond the §3.3 logic.

## 8. Dependencies

- `@adt-bench/agent-runner` (for `AgentRunResult` type).
- `@adt-bench/evaluator` (for `Evaluation` type).
- Node `fs/promises` and `path` (built-in).
- No other runtime dependencies.

