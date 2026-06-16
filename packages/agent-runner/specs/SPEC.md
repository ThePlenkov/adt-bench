# Spec: @adt-bench/agent-runner

## Purpose
Define the runtime-agnostic `AgentRunner` interface and the canonical result envelope (`AgentRunResult`, `ScenarioResult`, `OptionalRunMetrics`).

## Scope
- Exposes `AgentRunner` interface (`prepare`, `run`).
- Exposes Zod schemas for `AgentPrepareInput`, `AgentRunInput`, `AgentRunResult`, `ScenarioResult`, `OptionalRunMetrics`, `Evidence`.
- Knows nothing about ABAP, ADT, `adt-cli`, `arc-1`, or `vscode_abap_remote_fs`.
- Knows nothing about any specific LLM provider or agent process.

## Out of scope
- Process execution (lives in `runner-mastracode`).
- Scenario loading and frontmatter parsing (lives in `scenarios`).
- Prompt construction (lives in `prompt-builder`).
- Evaluation (lives in `evaluator`).
- Report generation (lives in `report`).

## Public API

```ts
export interface AgentRunner {
  readonly id: string;
  prepare(input: AgentPrepareInput): Promise<void>;
  run(input: AgentRunInput): Promise<AgentRunResult>;
}
```

## Invariants

1. `AgentRunResult.parsed_result` is `null` when the agent's final text could not be parsed as `ScenarioResult`; the raw `final_text` is always preserved.
2. `OptionalRunMetrics` uses Zod `.strict()` — unknown keys are rejected.
3. `errors` is always an array (empty array if no errors).
4. `started_at` and `finished_at` are ISO 8601 datetimes.
5. The `AgentRunner` interface is intentionally minimal so that `runner-mastracode`, `runner-claude-code`, `runner-codex`, and `runner-gemini-cli` can all implement it.

## Test coverage

- `result.spec.ts` covers valid + invalid `ScenarioResult`, `OptionalRunMetrics` (including `.strict()`), and `AgentRunResult` parsing.
- `runner.spec.ts` covers valid + invalid `AgentPrepareInput` and `AgentRunInput` parsing, plus a compile-time `AgentRunner` impl smoke test.
