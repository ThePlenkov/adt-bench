# Spec: @adt-bench/agent-runner

## 1. Purpose

The runtime-agnostic contract every concrete agent runner must satisfy.
Defines the `AgentRunner` interface, the `AgentRunResult` envelope, and
the `ScenarioResult` schema the agent must return. Knows nothing about
ABAP, ADT, MCP, or any specific LLM provider. This package is the
single source of truth for the harness's data model.

## 2. Public surface

The package exports exactly the following TypeScript symbols from
`src/index.ts`. **No other exports are permitted** — the spec-coverage
tool fails the build if `src/` exports anything not declared here.

```ts
// Schemas (Zod)
export const EvidenceSchema: z.ZodObject<{
  kind: z.ZodEnum<
    | 'object' | 'source' | 'activation' | 'syntax_check'
    | 'test' | 'diagnostic' | 'tool_result' | 'other'
  >;
  value: z.ZodString;  // min(1)
}>;
export const ScenarioResultSchema: z.ZodObject<{
  scenario_id: z.ZodString;          // min(1)
  status: z.ZodEnum<['pass','fail','partial']>;
  summary: z.ZodString;              // min(1)
  evidence: z.ZodArray<typeof EvidenceSchema>;     // default []
  changed_objects: z.ZodArray<z.ZodString>;        // default []
  errors: z.ZodArray<z.ZodString>;                // default []
}>;
export const OptionalRunMetricsSchema: z.ZodObject<{
  tool_calls: z.ZodOptional<z.ZodObject<{
    total: z.ZodOptional<z.ZodNumber>;             // int >= 0
    by_tool: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
  }>>;
  tokens: z.ZodOptional<z.ZodObject<{
    input: z.ZodOptional<z.ZodNumber>;             // int >= 0
    output: z.ZodOptional<z.ZodNumber>;            // int >= 0
    cache_read: z.ZodOptional<z.ZodNumber>;        // int >= 0
    cache_write: z.ZodOptional<z.ZodNumber>;       // int >= 0
  }>>;
  cost_usd: z.ZodOptional<z.ZodNumber>;            // >= 0
  steps: z.ZodOptional<z.ZodNumber>;               // int >= 0
  mcp_servers: z.ZodOptional<z.ZodArray<z.ZodString>>;
  adt_http_calls: z.ZodOptional<z.ZodObject<{
    total: z.ZodOptional<z.ZodNumber>;
    by_endpoint: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
  }>>;
}>;  // .strict() — unknown keys rejected
export const AgentRunResultSchema: z.ZodObject<{
  run_id: z.ZodString;               // min(1)
  agent_id: z.ZodString;             // min(1)
  scenario_id: z.ZodString;          // min(1)
  status: z.ZodEnum<['pass','fail','partial','timeout','error']>;
  started_at: z.ZodString;           // ISO 8601 datetime
  finished_at: z.ZodString;          // ISO 8601 datetime
  duration_ms: z.ZodNumber;          // int >= 0
  final_text: z.ZodString;
  parsed_result: z.ZodNullable<typeof ScenarioResultSchema>;
  transcript_path: z.ZodOptional<z.ZodString>;
  metrics: z.ZodOptional<typeof OptionalRunMetricsSchema>;
  errors: z.ZodArray<z.ZodString>;   // default []
}>;  // .strict()

// Input schemas
export const AgentPrepareInputSchema: z.ZodObject<{
  workspaceDir: z.ZodString;         // min(1)
  agentConfigDir: z.ZodString;       // min(1)
  skillsDir: z.ZodString;            // min(1)
  mcpConfigPath: z.ZodString;         // min(1)
  instructionsPath: z.ZodOptional<z.ZodString>;
}>;  // .strict()
export const AgentRunInputSchema: z.ZodObject<{
  runId: z.ZodString;                // min(1)
  scenarioId: z.ZodString;           // min(1)
  prompt: z.ZodString;               // min(1)
  timeoutMs: z.ZodNumber;            // int > 0
  env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}>;  // .strict()

// Interface
export interface AgentRunner {
  readonly id: string;
  prepare(input: AgentPrepareInput): Promise<void>;
  run(input: AgentRunInput): Promise<AgentRunResult>;
}

// Type aliases
export type Evidence = z.infer<typeof EvidenceSchema>;
export type ScenarioResult = z.infer<typeof ScenarioResultSchema>;
export type OptionalRunMetrics = z.infer<typeof OptionalRunMetricsSchema>;
export type AgentRunResult = z.infer<typeof AgentRunResultSchema>;
export type AgentPrepareInput = z.infer<typeof AgentPrepareInputSchema>;
export type AgentRunInput = z.infer<typeof AgentRunInputSchema>;
```

**Total exports: 13** (6 const Zod schemas + 2 input Zod schemas +
1 interface + 4 type aliases). The spec-coverage tool greps the
`src/index.ts` `export` statements and asserts this exact set.

## 3. Behaviour contracts

### 3.1 `AgentRunner.prepare(input)`

- MUST be idempotent: calling it twice on the same `input.workspaceDir`
  is safe. The second call overwrites the first.
- MUST validate `input` with `AgentPrepareInputSchema` and throw a
  `ZodError` if invalid.
- MUST NOT throw for any other reason in the happy path.
- MUST NOT spawn any process or make any network call.
- MUST be `await`-able: returns `Promise<void>`.

### 3.2 `AgentRunner.run(input)`

- MUST validate `input` with `AgentRunInputSchema` and throw a
  `ZodError` if invalid.
- MUST return a `Promise<AgentRunResult>` that resolves to a value
  that passes `AgentRunResultSchema.parse(...)`.
- MUST always populate `run_id` with `input.runId` (verbatim).
- MUST always populate `agent_id` with `this.id` (verbatim).
- MUST always populate `scenario_id` with `input.scenarioId`
  (verbatim).
- MUST set `started_at` to an ISO 8601 string captured before any work
  begins.
- MUST set `finished_at` to an ISO 8601 string captured after all work
  completes.
- MUST set `duration_ms` to `Math.round(finished_at_ms - started_at_ms)`.
- MUST set `final_text` to the agent's raw final response (any string,
  even empty).
- MUST set `parsed_result` to the result of
  `ScenarioResultSchema.safeParse(JSON.parse(final_text))` when the
  final text is valid JSON and matches the schema; otherwise `null`.
- MUST set `status` to:
  - `'pass'` if `parsed_result?.status === 'pass'`.
  - `'partial'` if `parsed_result?.status === 'partial'`.
  - `'fail'` if `parsed_result?.status === 'fail'`.
  - `'error'` if `run` raised an exception.
  - `'timeout'` if `run` exceeded `input.timeoutMs`.
- MUST set `transcript_path` to the on-disk path of the transcript
  file, if one was written.
- MUST set `metrics` to the collected metrics, or omit it.
- MUST set `errors` to an array of error messages (empty if none).
- MUST NOT throw. All failures are encoded in the result.

### 3.3 Schema strictness

- `OptionalRunMetricsSchema` and `AgentRunResultSchema` use
  `.strict()`. **Unknown keys are rejected** at parse time. The test
  `OptionalRunMetricsSchema > rejects unknown keys` enforces this.
- `ScenarioResultSchema` is **not** `.strict()` (extra fields from the
  agent are tolerated but ignored). The test
  `ScenarioResultSchema > accepts a valid scenario result` and
  `> defaults arrays to empty` enforce the defaults.

### 3.4 `Evidence.value`

- MUST be a non-empty string.
- MAY be multi-line (e.g. a JUnit XML body, a multi-line error
  message). The schema does not constrain line count.

### 3.5 `metrics.tool_calls.by_tool`

- Keys are tool names (any non-empty string). The convention is
  `mcp-server.tool-name` (e.g. `arc-1.SAPRead`), but plain
  `tool-name` is accepted.

## 4. Invariants

1. **Type strictness:** the TypeScript types and the Zod schemas MUST
   stay in sync. Any change to a Zod field's type (e.g.
   `z.ZodString` → `z.ZodNumber`) requires a corresponding change to
   the type alias. The test `runner.spec.ts` includes a
   compile-time check that the Zod-inferred type is assignable to the
   declared type alias.
2. **No runtime side effects at import time:** importing this
   package MUST NOT call any agent, open any file, or start any
   process. (Static side effects are forbidden in `result.ts`,
   `runner.ts`, and `index.ts`.)
3. **No ABAP knowledge:** the package source code MUST NOT contain
   any of the strings `'ABAP'`, `'ADT'`, `'SAP'`, `'MCP'`, `'claude'`,
   `'mastracode'`, `'openai'`, `'gpt'`, `'gemini'`, or any model name.
   This is checked by `tools/spec-coverage.mjs` (the "no-domain-leak"
   check).
4. **All schemas are exported:** every `const` Zod schema defined in
   `src/` MUST be re-exported from `src/index.ts`. The
   `spec-coverage` tool enforces this.
5. **All schemas are documented:** every exported schema MUST have a
   section in this spec.

## 5. Error model

- **Schema validation:** the schemas themselves throw `ZodError` when
  `.parse(input)` is called with invalid data.
- **Runtime errors:** `AgentRunner.run` MUST NOT throw. The result's
  `status: 'error'` and `errors: string[]` carry the failure
  information. The harness depends on this guarantee.
- **Timeout:** the runner is responsible for enforcing `input.timeoutMs`.
  When the timeout fires, the result MUST have `status: 'timeout'` and
  `errors` MUST contain a string starting with `'timeout after <N>ms'`.

## 6. Test matrix

Each test in `result.spec.ts` and `runner.spec.ts` MUST map to a
contract above. A test whose name does not appear in the table below
fails the spec-coverage check.

| Test name | Covers contract |
|---|---|
| `ScenarioResultSchema > accepts a valid scenario result` | §3.3, §2 |
| `ScenarioResultSchema > rejects unknown status` | §2 |
| `ScenarioResultSchema > rejects unknown evidence kind` | §2 |
| `ScenarioResultSchema > defaults arrays to empty when omitted` | §2 |
| `OptionalRunMetricsSchema > accepts an empty object` | §2, §3.3 |
| `OptionalRunMetricsSchema > accepts all optional fields` | §2 |
| `OptionalRunMetricsSchema > rejects unknown keys (strict mode)` | §3.3, §4.3 |
| `AgentRunResultSchema > accepts a valid run result` | §2, §3.2 |
| `AgentRunResultSchema > accepts a minimal run result with null parsed_result` | §3.2 |
| `AgentRunResultSchema > rejects invalid status` | §2 |
| `AgentRunResultSchema > rejects missing required datetime fields` | §3.2 |
| `AgentPrepareInputSchema > accepts required fields` | §2, §3.1 |
| `AgentPrepareInputSchema > rejects missing workspaceDir` | §2 |
| `AgentRunInputSchema > accepts required fields` | §2 |
| `AgentRunInputSchema > rejects non-positive timeout` | §2 |
| `AgentRunner contract (compile-time) > can be implemented with the required shape` | §2, §3.1, §3.2 |

## 7. Non-goals

- This package does NOT spawn any process. That is the runner's job.
- This package does NOT parse agent output. The runner decides
  whether to populate `parsed_result` based on its own knowledge of
  the agent's output format.
- This package does NOT know about specific LLM providers, MCP
  servers, or ABAP.

## 8. Dependencies

- **Zod 3.23.x** (production dependency, not dev). Pin via
  `package.json`.
- **TypeScript 5.6.x** (dev).
- **Vitest 2.1.x** (dev, for `result.spec.ts` and `runner.spec.ts`).

No other runtime or dev dependencies. The package MUST NOT import
`execa`, `fs`, `path`, or any agent library.

