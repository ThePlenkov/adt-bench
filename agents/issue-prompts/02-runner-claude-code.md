# Issue #2 — runner-claude-code package

## Task

Add a new package `@adt-bench/runner-claude-code` that implements the
`AgentRunner` interface by shelling out to the `claude code` CLI.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `docs/design.md`
  - `packages/agent-runner/src/runner.ts` (the `AgentRunner` interface)
  - `packages/runner-mastracode/src/runner.ts` (the pattern to follow)
  - `packages/runner-mastracode/specs/SPEC.md`
- Background: the v1 design mandates that all runners implement the same
  `AgentRunner` interface so the harness stays surface-agnostic. This issue
  adds the second runner. It must follow the pattern in
  `runner-mastracode`: same `simulated | replay | live` modes, same
  fixture-replay path, same metrics rollup.

## Out of scope

- Supporting the Claude Code API directly (SDK-based). The runner uses the
  CLI process only.
- Any non-Claude agent CLIs. Those are issues #3.

## Files to add or modify

- `packages/runner-claude-code/package.json` (new)
- `packages/runner-claude-code/tsconfig.json` (new)
- `packages/runner-claude-code/vitest.config.ts` (new)
- `packages/runner-claude-code/src/runner.ts` (new)
- `packages/runner-claude-code/src/runner.spec.ts` (new)
- `packages/runner-claude-code/src/index.ts` (new)
- `packages/runner-claude-code/fixtures/create-class-hello.jsonl` (new, recorded)
- `packages/runner-claude-code/specs/SPEC.md` (new)
- `packages/bench-cli/src/run.ts` — add `--agent claude-code` flag handling
- `nx.json` — if needed for project recognition

## Steps

1. Copy the directory layout from `packages/runner-mastracode`. Rename
   internal identifiers; the public class becomes `ClaudeCodeRunner`.
2. The runner ID is `'claude-code'`.
3. Implement `spawnClaudeCode(input)`: `execa` the `claude` binary with
   `--print` (or whatever the documented non-interactive flag is; check
   the Claude Code docs as of the implementation date) and pass the prompt.
   Capture the final assistant message and any JSONL telemetry.
4. Implement `replayFixture(input, fixturePath)` identical to the
   mastracode one — read JSONL, rebuild `AgentRunResult`.
5. Add a `tools/capture-claude-code-fixture.mjs` that records a fixture
   (used like: `CLAUDE_CODE_LIVE=1 pnpm tsx tools/capture-claude-code-fixture.mjs create-class-hello`).
6. Write a unit test in `runner.spec.ts` that loads the fixture and
   asserts the rollup.
7. Add a smoke path: `pnpm bench:run --agent claude-code --scenario
   create-class-hello` works.
8. Update `docs/result-schema.md` if Claude Code emits a different
   telemetry shape; otherwise link from there.

## Deliverables

- New `packages/runner-claude-code/` mirroring `runner-mastracode` structure.
- Recorded fixture `create-class-hello.jsonl`.
- `pnpm bench:run --agent claude-code --scenario <id>` works in fixture mode.

## Test plan

- Unit: `runner.spec.ts > replays a fixture and extracts metrics` (1 test).
- Smoke: `pnpm bench:smoke` still passes (uses mastracode by default).
- Manual: `CLAUDE_CODE_LIVE=1 pnpm bench:run --agent claude-code --scenario
  create-class-hello` against a real `claude` install.

## Acceptance gate

- `pnpm verify` exits 0.
- `pnpm bench:run --agent claude-code` runs end-to-end in fixture mode.
- `pnpm bench:smoke` (default agent) still passes.

## Definition of done

- [ ] Package scaffolded with `package.json`, `tsconfig.json`,
  `vitest.config.ts`, `src/`, `specs/`.
- [ ] `ClaudeCodeRunner` implements `AgentRunner`.
- [ ] Fixture recorded and committed.
- [ ] Unit test passes.
- [ ] `pnpm verify` exits 0.
- [ ] Conventional commit: `feat(runner-claude-code): add claude-code CLI runner`.
- [ ] PR opened; this issue closed.

## Dependencies

Blocked by #1 (the runner contract and workspace-prep patterns must be
validated against a real LLM-capable agent first).

Blocks #3.
