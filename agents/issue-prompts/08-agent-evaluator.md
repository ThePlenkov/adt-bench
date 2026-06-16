# Issue #8 — Agent-based + hybrid evaluators

## Task

Add a second evaluator mode: a second LLM reads the run transcript and
grades qualitatively. The rule-based evaluator remains the gate; the
agent evaluator runs second (hybrid mode). Persist the agent rationale
to `evaluation.json` and surface it in the console report.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `packages/evaluator/src/evaluator.ts`
  - `packages/evaluator/specs/SPEC.md`
  - `packages/agent-runner/src/result.ts`
  - `docs/evaluator.md`
- Background: rule-based evaluation is deterministic but shallow — it
  can't judge code quality. An LLM-based evaluator complements it.

## Out of scope

- A new runner for the evaluator agent. Reuse `runner-mastracode` (or
  the `runner-claude-code` from #2). Add an `evaluator` field to the
  MCP profile; no new package.
- Streaming partial grades. The evaluator runs once at end-of-run.

## Files to add or modify

- `packages/evaluator/src/evaluator.ts` — add `evaluateHybrid` and
  `evaluateAgent` functions. New `AgentEvaluation` type.
- `packages/evaluator/src/evaluator.spec.ts` — new tests (with a
  recorded agent response fixture).
- `packages/evaluator/fixtures/agent-grade-pass.json` (new)
- `packages/evaluator/fixtures/agent-grade-partial.json` (new)
- `packages/evaluator/fixtures/agent-grade-fail.json` (new)
- `packages/evaluator/specs/SPEC.md` — update.
- `packages/bench-cli/src/cli.ts` — wire `evaluator.type: agent | hybrid`
  from scenario frontmatter.

## Steps

1. Define the `AgentGrade` schema:
   ```ts
   {
     verdict: 'pass' | 'partial' | 'fail';
     rationale: string;          // 2-5 sentences, plain text
     confidence: number;         // 0..1
     evidence_refs: string[];   // keys into the run transcript
   }
   ```
2. Implement `evaluateAgent({ run, scenario, llmClient })`:
   - Build a prompt: scenario goal + criteria + run transcript (last 50
     messages) + "Grade this run as pass/partial/fail and explain."
   - Call an LLM (use the same LLM client abstraction as the runner).
   - Parse the JSON response into `AgentGrade`.
3. Implement `evaluateHybrid`:
   - Run the rule-based evaluator first.
   - If rule verdict is `fail`, return immediately.
   - Otherwise, call `evaluateAgent`.
   - Combine: hybrid overall = rule verdict (unless agent says
     `fail` with confidence > 0.8, in which case downgrade).
4. Update `Evaluation` type to include an optional `agent_evaluation`
   field.
5. Add a fixture-driven test that replays a recorded LLM response.
6. Add CLI flag `--evaluator agent|hybrid|rule` (default `rule`).

## Deliverables

- `evaluateAgent` and `evaluateHybrid` implemented.
- 3 recorded agent-response fixtures.
- Console report includes the agent rationale when present.

## Test plan

- Unit: 3 fixture-driven tests (one per verdict).
- Integration: `pnpm bench:run --scenario create-class-hello --evaluator
  hybrid` produces an `evaluation.json` with both `perRule` and
  `agent_evaluation`.

## Acceptance gate

- `pnpm verify` exits 0.
- A hybrid run produces a populated `agent_evaluation` block.

## Definition of done

- [ ] `evaluateAgent` and `evaluateHybrid` implemented.
- [ ] 3 fixtures committed.
- [ ] `--evaluator` flag works.
- [ ] `pnpm verify` exits 0.
- [ ] Conventional commit: `feat(evaluator): agent-based + hybrid evaluators`.
- [ ] PR opened; this issue closed.

## Dependencies

Blocked by #1 (real runner with full transcripts needed for the agent
to grade from).
