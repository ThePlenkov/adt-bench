# Spec: @adt-bench/runner-mastracode

## 1. Purpose

The first concrete implementation of `AgentRunner`. Treats Mastra Code
as an agent process and configures its workspace (skills, MCP
profile, AGENTS.md) accordingly. v1 ships two modes: `simulated` (a
deterministic stub that returns a fixed `ScenarioResult` for
end-to-end testing) and a placeholder for `live` mode (v1.1).

## 2. Public surface

The package exports exactly the following symbols from `src/index.ts`:

```ts
export interface MastraCodeRunnerOptions {
  skillsSourceDir: string;          // absolute path; the dir whose children are skill folders
  mcpProfilePath: string;           // absolute path to the .mcp.json
  simulated?: boolean;              // default true in v1
}

export class MastraCodeRunner implements AgentRunner {
  readonly id: string;              // 'mastracode'
  constructor(opts: MastraCodeRunnerOptions);
  prepare(input: AgentPrepareInput): Promise<void>;
  run(input: AgentRunInput): Promise<AgentRunResult>;
}

export function simulatedAgentRun(input: AgentRunInput): string;
```

**Total exports: 3** (1 interface + 1 class + 1 function).

## 3. Behaviour contracts

### 3.1 `MastraCodeRunner` constructor

- `opts.skillsSourceDir` MUST be an absolute path. The constructor
  does NOT validate this; `prepare` will throw if it does not exist.
- `opts.mcpProfilePath` MUST be an absolute path. The constructor
  does NOT validate.
- `opts.simulated` defaults to `true`.

### 3.2 `MastraCodeRunner.prepare(input)`

- MUST validate `input` with `AgentPrepareInputSchema` and throw
  `ZodError` if invalid.
- MUST create the directories `input.agentConfigDir` and
  `input.skillsDir` (recursive mkdir).
- MUST copy the contents of `opts.skillsSourceDir` (one level of
  children) into `input.skillsDir`. Files in skill subdirectories
  are copied as-is.
- MUST copy `opts.mcpProfilePath` to `input.mcpConfigPath`.
- If `input.instructionsPath` is provided, MUST write a generated
  `AGENTS.md` (see §3.5) to it. If not provided, no instructions file
  is written.
- MUST be idempotent. Calling twice overwrites the previous result.
- MUST NOT spawn any process. (The `live` mode in v1.1 will.)
- MUST NOT throw for any reason other than the input validation
  failure or a filesystem error (e.g. `EACCES` on the source paths).

### 3.3 `MastraCodeRunner.run(input)`

- MUST validate `input` with `AgentRunInputSchema` and throw
  `ZodError` if invalid.
- If `opts.simulated !== false` (i.e. the default), calls
  `simulatedAgentRun(input)`, parses the result, and returns an
  `AgentRunResult` per §3.6.
- If `opts.simulated === false`, returns an `AgentRunResult` with
  `status: 'error'` and `errors: ['real-mastracode-spawning-not-implemented-in-v1']`.
  (The v1.1 fixture-replay path is tracked in #1.)
- MUST NOT throw under any circumstance.

### 3.4 `simulatedAgentRun(input)`

- Returns a JSON string that, when parsed, is a valid
  `ScenarioResult` (verified by `ScenarioResultSchema.parse` before
  the function returns).
- The result is scenario-aware:
  - For `input.scenarioId === 'create-class-hello'`: `status: 'pass'`,
    `summary` mentions `ZCL_BENCH_HELLO` and `SAY_HELLO`, evidence
    includes `kind: 'activation'`, `changed_objects: ['ZCL_BENCH_HELLO']`.
  - For `input.scenarioId === 'read-class-source'`: `status: 'pass'`,
    `summary` mentions `ZCL_BENCH_FIXTURE_OK`, evidence includes
    `kind: 'object'`, `changed_objects: ['ZCL_BENCH_FIXTURE_OK']`.
  - For any other `scenarioId`: `status: 'pass'`, generic
    `ZCL_BENCH_HELLO` evidence. (Future versions should return
    `status: 'partial'` for unknown scenarios.)
- The JSON is pretty-printed (2-space indent) for human readability.

### 3.5 `AGENTS.md` template (v1)

```
# ADT-Bench agent instructions

You are running inside the adt-bench harness.

1. Read the scenario prompt carefully.
2. Use the configured MCP tools to accomplish the task.
3. Run any available validation (activation, syntax check, unit tests).
4. Return ONLY a single JSON object matching the scenario result schema.

Do not include prose, code fences, or extra commentary in your final answer.
```

This template is private to the package. The runner is the only
thing that writes it. Future versions may add a `instructions`
option to `MastraCodeRunnerOptions` to override the template.

### 3.6 `AgentRunResult` shape (simulated mode)

The `run` method MUST return a result that satisfies:

- `run_id === input.runId`
- `agent_id === 'mastracode'`
- `scenario_id === input.scenarioId`
- `started_at` and `finished_at` are ISO 8601 strings captured
  before and after `simulatedAgentRun`.
- `duration_ms` is `Math.round(performance.now() - t0)`. In simulated
  mode, this is typically 0-5 ms.
- `final_text` is the JSON string from `simulatedAgentRun`.
- `parsed_result` is `ScenarioResultSchema.parse(JSON.parse(final_text))`.
- `status` is `'pass'` if `parsed_result.errors.length === 0`,
  `'partial'` otherwise.
- `errors` is `[]`.
- `metrics` is omitted (the simulated agent has no telemetry).
- `transcript_path` is omitted (the harness writes the transcript
  in `bench-cli`, not here).

## 4. Invariants

1. **Idempotent prepare:** `prepare` produces the same workspace
   structure on repeated calls.
2. **No throws from `run`:** the runner MUST always return a
   well-formed `AgentRunResult`. All failures are encoded in
   `status` and `errors`.
3. **Simulated determinism:** `simulatedAgentRun` returns the same
   string for the same `input.scenarioId` (no randomness, no time
   dependencies).
4. **The runner id is `'mastracode'`** — never anything else.
5. **No process spawn in v1** — the `live` mode is a placeholder.
6. **No LLM API calls** — the package MUST NOT import `@anthropic-ai/sdk`,
   `openai`, `@google/generative-ai`, or any other LLM SDK.

## 5. Error model

- **Input validation:** throws `ZodError` (from the agent-runner
  schemas) for malformed input. This is a programmer error, not a
  runtime condition; the harness should never trigger it.
- **Filesystem errors during prepare:** the underlying Node error
  (`EACCES`, `ENOENT`, `ENOTDIR`, ...) propagates.
- **Live mode (v1.1+):** the placeholder returns
  `status: 'error', errors: ['real-mastracode-spawning-not-implemented-in-v1']`.
  The real spawn + fixture-replay path is in #1.

## 6. Test matrix

| Test name | Covers contract |
|---|---|
| `MastraCodeRunner.prepare > copies skills and MCP profile into the workspace` | §3.2 |
| `MastraCodeRunner.run (simulated) > returns a valid AgentRunResult` | §3.3, §3.6 |
| `MastraCodeRunner.run (simulated) > produces JSON that round-trips through parseFinalText` | §3.3, §3.4 |
| `MastraCodeRunner.run (simulated) > simulated read-class-source run references the fixture class` | §3.4 |

## 7. Non-goals

- The package does NOT support live LLM calls in v1.
- The package does NOT record or replay fixtures in v1.
- The package does NOT spawn any subprocess in v1.
- The package does NOT support agents other than Mastra Code (issue
  #2 adds Claude Code, #3 adds Codex + Gemini).

## 8. Dependencies

- `@adt-bench/agent-runner` (for `AgentRunner` interface and the
  Zod schemas).
- `@adt-bench/evaluator` (for `parseFinalText`).
- Node `fs/promises` and `path` (built-in).
- No other runtime dependencies.

