# Spec: @adt-bench/bench-cli

## 1. Purpose

The CLI entry point that ties the packages together. Exposes
`pnpm bench:smoke`, `pnpm bench:run`, and `pnpm bench:report`
commands, and the `runSmoke` / `executeRun` / `writeAndPrintSummary`
programmatic API. The package is the only place that knows the
end-to-end flow: load scenario → build prompt → run agent → persist
result → evaluate → aggregate → report.

## 2. Public surface

The package exports exactly the following symbols from `src/index.ts`:

```ts
export interface RunOptions {
  scenarioId: string;
  workspaceRoot: string;             // absolute path; contains scenarios/, packages/, results/, agents/
  resultsDir: string;                // absolute path; typically workspaceRoot/results
  skillsSourceDir: string;           // absolute path; typically workspaceRoot/packages/skills/.agents/skills
  mcpProfilePath: string;            // absolute path; typically workspaceRoot/agents/mastracode/profiles/<profile>.mcp.json
  extraSkillFragments?: string[];    // default: load from skillsSourceDir
  mockAdtUrl?: string;               // if set, included in the prompt as "# Mock ADT server"
  trials?: number;                   // v1.1; default 1
}

export interface RunOutcome {
  runId: string;
  scenario: ParsedScenario;
  result: AgentRunResult;
  evaluation: Evaluation;
  transcript: string;                // JSONL
}

export async function loadSkillFragments(skillsSourceDir: string): Promise<string[]>;
export async function executeRun(opts: RunOptions): Promise<RunOutcome>;
export async function runSmoke(opts: { workspaceRoot: string; scenarioId?: string })
  : Promise<{ overall: 'pass' | 'fail' | 'partial'; runId: string; runDir: string }>;
export async function writeAndPrintSummary(workspaceRoot: string): Promise<Summary>;
export async function cleanResultsDir(resultsDir: string): Promise<void>;
```

Entry-point scripts (not exported, but part of the contract):
- `src/smoke.ts` — `pnpm bench:smoke`
- `src/run.ts` — `pnpm bench:run`
- `src/report.ts` — `pnpm bench:report`

**Total exports: 7** (1 interface + 1 outcome interface + 5 functions).

## 3. Behaviour contracts

### 3.1 `loadSkillFragments(skillsSourceDir)`

- Reads `skillsSourceDir` non-recursively.
- For each child directory, attempts to read `<child>/SKILL.md`.
- Returns the array of file contents. Empty array if no SKILL.md
  files are found.
- Skips files that fail to read (e.g. permission errors). Does NOT
  throw.

### 3.2 `executeRun(opts)` — the end-to-end pipeline

The function is the canonical run pipeline. It MUST execute these
steps in order:

1. **Load scenarios** from `<opts.workspaceRoot>/scenarios`.
2. **Find the scenario** with `frontmatter.id === opts.scenarioId`.
   Throws if not found.
3. **Load skill fragments** from `opts.skillsSourceDir` (or use
   `opts.extraSkillFragments` if provided).
4. **Generate `runId`** via `ulid()`.
5. **Create the run dir** at `<opts.resultsDir>/<runId>/`.
6. **Create the agent workspace** at `<runId>/agent-workspace/`.
   The agent config dir is `<workspace>/.mastracode/`.
7. **Build the prompt** via `buildPrompt` with the scenario + skill
   fragments. If `opts.mockAdtUrl` is set, prepend a `# Mock ADT
   server` section.
8. **Run the agent** via `MastraCodeRunner.run({ runId, scenarioId,
   prompt, timeoutMs })`.
9. **Persist** the run artifacts:
   - `result.json` — the `AgentRunResult` (via `JSON.stringify(...,null,2)`).
   - `prompt.txt` — the exact prompt string.
   - `evaluation.json` — the `Evaluation` from `@adt-bench/evaluator`.
   - `transcript.jsonl` — NDJSON of `user` and `assistant` messages.
10. **Return** the `RunOutcome`.

Failure semantics:
- If the scenario is not found, throws `Error('scenario not found: <id>')`.
- If the run is killed or the runner throws, the result is
  captured in `run.result.errors` and the pipeline continues to
  evaluate (returning `overall: 'error'` or `'fail'`).
- Filesystem errors during `mkdir` or `writeFile` propagate.

### 3.3 `runSmoke({ workspaceRoot, scenarioId })`

- Default `scenarioId` is `'create-class-hello'`.
- Boots the mock ADT server via `startMockAdt({ initialClasses: [ZCL_BENCH_FIXTURE_OK] })`.
- Calls `executeRun` with the mock URL injected.
- Calls `writeAndPrintSummary(workspaceRoot)`.
- Closes the mock.
- Returns the overall verdict of the run that matches the
  scenarioId. If no run matches, returns `overall: 'fail'`.

The `src/smoke.ts` entry-point:
- Calls `runSmoke({ workspaceRoot })`.
- Exits with `0` on `overall === 'pass'`, `1` on `fail`/`partial`,
  `2` on uncaught error.

### 3.4 `writeAndPrintSummary(workspaceRoot)`

- Calls `loadResultsDir(workspaceRoot/results)`.
- Calls `summarize(records)`.
- Calls `writeSummary` to persist to `summary.json`.
- Calls `printConsoleReport` to render to stdout.
- Returns the `Summary`.

### 3.5 `cleanResultsDir(resultsDir)`

- Reads `resultsDir` non-recursively.
- For each entry that is a directory, calls
  `rm(entry, { recursive: true, force: true })`.
- Does NOT remove `resultsDir` itself.
- Does NOT remove `results/.gitkeep` (because `.gitkeep` is a file
  inside `resultsDir`, not a directory).
- Idempotent.

### 3.6 `src/run.ts` entry-point

- Accepts `--scenario <id>` (default `create-class-hello`).
- Accepts `--mock 0|1` (default `1`). When `0`, no mock ADT is
  started.
- Boots the mock (if requested), calls `executeRun`, then
  `writeAndPrintSummary`. Exits `0` on success, `1` on error.

### 3.7 `src/report.ts` entry-point

- Calls `writeAndPrintSummary(workspaceRoot)`. Exits `0`.

## 4. Invariants

1. **The pipeline is deterministic per (scenario, agent) pair** for
   the simulated agent. Two runs with the same inputs produce
   identical `result.json`, `evaluation.json`, and `summary.json`
   (modulo `run_id` and timestamps).
2. **The run id is a ULID** generated via `ulid()`. Timestamps in
   the ULID encode the creation time.
3. **The agent workspace is created inside the run dir** at
   `<resultsDir>/<runId>/agent-workspace/`. The run dir is
   self-contained — everything needed to debug a run is in there.
4. **Skill fragments come from the on-disk SKILL.md files by
   default**; the in-process `extraSkillFragments` option is an
   override for tests.
5. **The harness is the only place that knows the full pipeline**;
   no other package imports from `@adt-bench/bench-cli`.

## 5. Error model

- **Scenario not found:** throws `Error('scenario not found: <id>')`.
  This is a programmer error (the CLI should validate the id
  earlier) but is surfaced for safety.
- **Filesystem errors:** propagate (no swallowing).
- **Runner errors:** captured in `run.result.errors`; pipeline
  continues to evaluation.

## 6. Test matrix

The harness is exercised end-to-end by `pnpm bench:smoke`. The
package itself has no unit tests in v1.1 (covered by the smoke
run + the per-package tests in `@adt-bench/report` and
`@adt-bench/evaluator`).

## 7. Non-goals

- The package does NOT implement the `MastraCodeRunner` itself. That
  is `@adt-bench/runner-mastracode`.
- The package does NOT implement the mock ADT server. That is
  `@adt-bench/mock-adt-server`.
- The package does NOT implement the evaluator or report. They are
  imported and orchestrated.
- The package does NOT provide multi-trial or matrix runs in v1
  (tracked in #7).

## 8. Dependencies

- `@adt-bench/scenarios`
- `@adt-bench/prompt-builder`
- `@adt-bench/evaluator`
- `@adt-bench/report`
- `@adt-bench/runner-mastracode`
- `@adt-bench/mock-adt-server` (imported in `runSmoke` only)
- `@adt-bench/agent-runner` (type-only)
- `ulid` 2.3.x (production).
- Node `fs/promises`, `path` (built-in).
- No other runtime dependencies.
