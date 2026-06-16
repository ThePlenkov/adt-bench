# Issue #1 — Real mastracode runner with telemetry

## Task

Replace the simulated agent in `@adt-bench/runner-mastracode` with a real
subprocess spawn of the `mastracode` binary. Parse its JSONL event stream
and populate `AgentRunResult.metrics` with `tool_calls`, `tokens`, `cost_usd`,
`steps`. Ship a recorded-fixture harness so CI can run without an LLM.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `docs/design.md`
  - `docs/result-schema.md`
  - `packages/agent-runner/src/result.ts` (the `AgentRunResult` shape)
  - `packages/runner-mastracode/src/runner.ts` (current simulated impl)
  - `packages/runner-mastracode/specs/SPEC.md`
- Background: the simulated agent returns a deterministic `ScenarioResult` so
  we could prove the loop in v1. v1.1 must drive a real `mastracode` process
  but still pass `pnpm verify` in CI without an LLM. Solution: a fixture
  harness that captures a `mastracode` run once and replays it from disk.

## Out of scope

- Adding new MCP servers. The runner consumes whichever `.mcp.json` is
  passed in.
- Implementing the agent loop itself. `mastracode` is a separate project.
- Spawning other agent CLIs. That is issues #2 and #3.

## Files to add or modify

- `packages/runner-mastracode/src/runner.ts` — replace `simulatedAgentRun`
  with `spawnMastracode` + `replayFixture`.
- `packages/runner-mastracode/src/runner.spec.ts` — add fixture-replay test.
- `packages/runner-mastracode/specs/SPEC.md` — update acceptance criteria.
- `packages/runner-mastracode/fixtures/create-class-hello.jsonl` — recorded
  mastracode output (commit the fixture).
- `tools/capture-mastracode-fixture.mjs` — one-off capture script (gitignored
  output, committed input).

## Steps

1. Add a `MastraCodeRunnerOptions.spawn` field that takes `{ mode: 'simulated' | 'replay' | 'live', fixturePath? }`. Default to `simulated` for backward compat.
2. Implement `replayFixture(input, fixturePath)`: read the JSONL fixture,
   reconstruct the message stream, build the `AgentRunResult` from the
   final assistant message + recorded metrics, return.
3. Implement `spawnMastracode(input)`: `execa` `npx -y mastracode@latest` with
   the prompt on stdin (or as a `--prompt` flag if mastracode supports it;
   check the mastracode docs). Pipe stdout JSONL. Each line is one of:
   `{ type: "message" | "tool_call" | "tool_result" | "usage" | "done", ... }`.
   On `done`, build the `AgentRunResult` and return.
4. Add a `metrics` extractor: roll up `tool_calls.by_tool`, sum `tokens`, etc.
5. Add the test in `runner.spec.ts` that loads
   `fixtures/create-class-hello.jsonl` and asserts the rolled-up
   `metrics.tool_calls.total > 0` and `status` is `pass` or `partial`.
6. Add a `pnpm bench:smoke` path: if no `MASTRACODE_LIVE=1`, fall back to
   fixture replay so CI stays deterministic.

## Deliverables

- `packages/runner-mastracode/src/runner.ts` — both `replayFixture` and
  `spawnMastracode` implemented; `simulated` mode still works.
- `packages/runner-mastracode/fixtures/create-class-hello.jsonl` — a real
  recorded run (use any free-tier LLM once; commit the JSONL).
- `tools/capture-mastracode-fixture.mjs` — captures a fresh fixture
  (`MASTRACODE_LIVE=1 pnpm tsx tools/capture-mastracode-fixture.mjs <scenario>`).
- All existing tests pass; one new test added.

## Test plan

- Unit: `runner.spec.ts > replays a fixture and extracts metrics`.
- Smoke: `pnpm bench:smoke` exits 0 against the fixture.
- Manual: `MASTRACODE_LIVE=1 pnpm bench:run --scenario create-class-hello`
  works against a real `mastracode` install.

## Acceptance gate

- `pnpm verify` exits 0 in CI (no live LLM).
- `pnpm bench:smoke` produces a `results/summary.json` with
  `metrics.tool_calls.total > 0`.
- Manual run with `MASTRACODE_LIVE=1` produces a run with non-empty
  `metrics.tokens` and a `cost_usd > 0`.

## Definition of done

- [ ] `spawnMastracode` and `replayFixture` implemented and unit-tested.
- [ ] Fixture `create-class-hello.jsonl` committed.
- [ ] `packages/runner-mastracode/specs/SPEC.md` updated; `pnpm spec-check` passes.
- [ ] `pnpm verify` exits 0.
- [ ] Conventional commit message: `feat(runner-mastracode): live subprocess + telemetry`.
- [ ] PR opened against main, this issue linked.
- [ ] This issue closed.

## Dependencies

Blocked by none.

Blocks #2, #3, #7, #8, #9.
