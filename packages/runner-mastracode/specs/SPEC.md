# Spec: @adt-bench/runner-mastracode

## Purpose
The first concrete implementation of `AgentRunner`. Treats Mastra Code as an agent process and configures its workspace (skills, MCP profile, AGENTS.md) accordingly.

## Scope

- `MastraCodeRunner` implements `AgentRunner`.
- `prepare(input)` creates a workspace and copies in:
  - skills from a source directory
  - the MCP profile JSON
  - a generated `AGENTS.md` with benchmark instructions
- `run(input)` returns an `AgentRunResult`.
- v1 always runs in `simulated: true` mode — produces a deterministic
  `ScenarioResult` derived from the input. No external process is spawned.
- `simulated: false` is reserved for v1.1+ and currently returns `status: 'error'`.

## Out of scope

- Spawning a real `mastracode` process and parsing its output.
- Capturing per-step telemetry (tool calls, tokens, costs) — the simulated
  agent has none.
- Streaming / live progress.

## Invariants

1. The `simulatedAgentRun` output is a `ScenarioResultSchema`-valid JSON object
   (validated before return).
2. `prepare` is idempotent: calling it twice on the same workspace is safe.
3. `run` never throws; failures are encoded in `status: 'error'` + `errors[]`.

## Test coverage

- `prepare` copies skills, MCP profile, and AGENTS.md into the workspace.
- `run` returns a valid `AgentRunResult` with `parsed_result` populated.
- `simulatedAgentRun` output round-trips through `parseFinalText`.
