# Architecture

This is the v1 architecture. Read this in 5 minutes before touching
any file. The architecture is enforced by `pnpm spec-check` —
changing it requires changing the package specs first.

## The loop

```
                              ┌────────────────────────────────┐
                              │                                │
                              ▼                                │
   scenario.md ──┐                                              │
                 ├──> PromptBuilder ──> AgentRunner ──> result  │
   skills/*.md ──┘            ▲              │           │     │
                              │              │           ▼     │
   MCP profile.json ──────────┘              │     Evaluator  │
                                 (MCP)       │           │     │
                                             │           ▼     │
                                             │       per-rule  │
                                             │       verdicts  │
                                             │           │     │
                                             │           ▼     │
                                             │       Report  ──┘
                                             │           │
                                             ▼           ▼
                                    results/<run-id>/  summary.json
                                    (per-run files)     (console)
```

Every box in the diagram is a TypeScript package with a `specs/SPEC.md`
that defines its contract. Boxes never depend on each other through
implementation details — only through the types in
`@adt-bench/agent-runner`.

## The packages

| Layer | Package | What it knows | What it MUST NOT know |
|---|---|---|---|
| Core types | `@adt-bench/agent-runner` | `AgentRunner` interface, Zod result schemas | Any specific agent, MCP, ABAP, LLM |
| Domain | `@adt-bench/scenarios` | How to parse scenario markdown | Any agent or runner |
| Domain | `@adt-bench/skills` | What the ABAP workflow looks like (markdown only) | Anything — it's a data package |
| Build | `@adt-bench/prompt-builder` | How to assemble a prompt from scenario + skills | Any agent, runner, or evaluator |
| Verify | `@adt-bench/evaluator` | How to score an agent's `final_text` against a scenario's rules | Any agent or runner |
| Report | `@adt-bench/report` | How to aggregate runs into a summary | Any agent or scenario |
| Substitute | `@adt-bench/mock-adt-server` | How to fake SAP ADT for deterministic runs | Any agent or scenario |
| Adapter | `@adt-bench/runner-mastracode` | How to run mastracode (currently: simulated) | Any other agent, any ABAP detail |
| Adapter | `@adt-bench/bench-cli` | The end-to-end pipeline (entry point) | All of the above — it orchestrates them |

The rows in the table describe a **dependency graph** that the
imports in `src/` MUST respect. The agent-runner spec
(`packages/agent-runner/specs/SPEC.md` §4.3) explicitly forbids
ABAP / MCP / agent knowledge in that package. The other specs
have similar "no domain leakage" rules in their `## 7. Non-goals`.

## The data flow per run

1. **Load** (`packages/scenarios/src/loader.ts`): the harness reads
   `scenarios/<id>.md`, parses the YAML frontmatter, validates it
   with Zod, returns a `ParsedScenario`.

2. **Build prompt** (`packages/prompt-builder/src/builder.ts`):
   the harness reads `packages/skills/.agents/skills/*/SKILL.md`,
   assembles a 7-section prompt (Role / Available context / Tool
   policy / Validation policy / Result policy / Skills / Scenario /
   Result schema), returns the prompt string.

3. **Prepare workspace** (`packages/runner-mastracode/src/runner.ts`):
   the runner creates a per-run workspace under
   `results/<run-id>/agent-workspace/.mastracode/`, copies the
   skills, copies the MCP profile (from
   `agents/mastracode/profiles/<name>.mcp.json`), writes an
   `AGENTS.md`.

4. **Run** (same): the runner spawns the agent. v1 uses a
   deterministic simulated agent; v1.1+ spawns a real
   `mastracode` subprocess or replays a recorded fixture.

5. **Persist** (`packages/bench-cli/src/cli.ts`): the harness
   writes `result.json`, `prompt.txt`, `transcript.jsonl`,
   `evaluation.json` to `results/<run-id>/`.

6. **Evaluate** (`packages/evaluator/src/evaluator.ts`): the
   evaluator parses the agent's `final_text` as a `ScenarioResult`
   and applies the scenario's `evaluator.rules`. The result is an
   `Evaluation` with per-rule verdicts and an overall verdict.

7. **Report** (`packages/report/src/report.ts`): the harness (or
   the user, via `pnpm bench:report`) reads all `results/<id>/`
   dirs, builds a `Summary`, writes `results/summary.json`, prints
   a console table.

## The contract that holds it all together

```ts
// From @adt-bench/agent-runner
export interface AgentRunner {
  readonly id: string;
  prepare(input: AgentPrepareInput): Promise<void>;
  run(input: AgentRunInput): Promise<AgentRunResult>;
}
```

Every concrete runner implements this interface. The harness calls
`prepare` to set up the workspace, then `run` to execute, then
hands the result to the evaluator. The runner does not know about
scenarios, evaluators, or reports; the harness does not know about
mastracode, claude, or any specific agent.

## The mock ADT server

`packages/mock-adt-server` is a **substitute** for the real SAP
ADT REST API. It listens on `127.0.0.1:<random>`, responds to a
small set of ADT endpoints, and tracks state in-memory. v1
implements the 16 endpoints needed by the v1 scenarios. v1.1+
adds the endpoints needed for the v1.1 scenarios (transportchecks,
AUnit, BDEF).

The mock is the only way the smoke run is deterministic. Real
BTP-backed runs (v1.1+) require an explicit `--allow-live-system`
flag and a service key.

## Where to start reading

1. `packages/agent-runner/specs/SPEC.md` — the data model.
2. `packages/bench-cli/specs/SPEC.md` — the end-to-end pipeline.
3. `packages/evaluator/specs/SPEC.md` — how scoring works.
4. `packages/runner-mastracode/specs/SPEC.md` — what a runner
   actually does.
5. `docs/spec-style.md` — the spec template and the three gates.

If you have an issue in hand (e.g. "implement runner-claude-code"),
read the issue body first, then the relevant package's `specs/SPEC.md`,
then start coding. The spec-check tool will tell you if you
forgot to update the spec.
