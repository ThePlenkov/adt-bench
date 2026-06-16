# Issue #3 — runner-codex and runner-gemini-cli packages

## Task

Add two new packages that implement `AgentRunner` by shelling out to the
`codex` and `gemini` CLIs respectively. Each is a near-clone of
`runner-claude-code` with the binary path and telemetry shape adjusted.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `packages/agent-runner/src/runner.ts`
  - `packages/runner-mastracode/src/runner.ts`
  - `packages/runner-claude-code/src/runner.ts` (must read once it exists — see #2)
  - `docs/design.md` — the "agent-first, runtime-agnostic" principle
- Background: this issue is intentionally low-context. The pattern is
  established by #2 (claude-code); this issue is two parallel copies.

## Out of scope

- Any non-CLI agent surface. SDK agents are a future concern.
- Adding MCP profiles. Reuse the existing ones.

## Files to add or modify

- `packages/runner-codex/package.json`, `tsconfig.json`, `vitest.config.ts`,
  `src/`, `src/runner.ts`, `src/runner.spec.ts`, `src/index.ts`,
  `fixtures/create-class-hello.jsonl`, `specs/SPEC.md`
- Same set under `packages/runner-gemini-cli/`
- `tools/capture-codex-fixture.mjs`
- `tools/capture-gemini-fixture.mjs`
- `packages/bench-cli/src/run.ts` — extend `--agent` to accept `codex` and
  `gemini-cli`

## Steps

1. Wait for #2 to be merged (or copy the claude-code skeleton if working
   in parallel — your call).
2. Scaffold `runner-codex`:
   - Runner ID `'codex'`.
   - Spawn `npx -y @openai/codex@latest` (or `codex` if installed globally)
     with the prompt.
   - Parse stdout (likely JSONL or plain text; verify against the
     current codex CLI documentation).
   - Roll up metrics.
   - Record a fixture.
3. Scaffold `runner-gemini-cli` the same way against
   `npx -y @google/gemini-cli@latest` (or `gemini`).
4. Write unit tests mirroring the claude-code one.
5. Update `bench-cli` to dispatch on `--agent`.

## Deliverables

- Two new packages, each with the same shape as `runner-claude-code`.
- Two recorded fixtures.
- `pnpm bench:run --agent codex` and `--agent gemini-cli` work in fixture mode.

## Test plan

- Unit: 1 test per runner (fixture replay + metrics rollup).
- Smoke: `pnpm bench:smoke` (default agent) still passes.

## Acceptance gate

- `pnpm verify` exits 0.
- Both new agents run end-to-end in fixture mode.
- Document any quirks in the per-package SPEC.md (e.g. codex uses
  `--prompt` flag; gemini expects prompt on stdin).

## Definition of done

- [ ] Both packages scaffolded and unit-tested.
- [ ] Both fixtures recorded and committed.
- [ ] `pnpm bench:run --agent codex` and `--agent gemini-cli` both work.
- [ ] `pnpm verify` exits 0.
- [ ] Conventional commits: `feat(runner-codex): add codex CLI runner`
  and `feat(runner-gemini-cli): add gemini CLI runner`.
- [ ] PRs opened; this issue closed.

## Dependencies

Blocked by #2.
