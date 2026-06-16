# adt-bench

Agent-first benchmark runner for ABAP development scenarios.
Configures skills and MCP servers, runs an agent, captures the
transcript, evaluates the result.

> v1 is a smoke path: the loop
> `agent + skills + MCP + scenario -> structured result -> evaluator -> report`
> is end-to-end against a deterministic mock ADT server. v1.1+
> adds real agent runtimes, live BTP, and a static results website.

## Quick start

```bash
pnpm install
pnpm verify          # spec-check, typecheck, lint, test, bench:smoke
pnpm bench:smoke     # just the smoke run
pnpm bench:run --scenario create-class-hello
pnpm bench:report    # regenerate results/summary.json + console report
```

The smoke run produces:

```
results/<run-id>/prompt.txt
results/<run-id>/result.json
results/<run-id>/evaluation.json
results/<run-id>/transcript.jsonl
results/summary.json
```

## What v1 does

1. **Loads a scenario** from `scenarios/<id>.md` (frontmatter + body).
2. **Builds a prompt** with role, available context, tool/validation/result policies, scenario body, and a result-schema sketch.
3. **Injects skills** from `packages/skills/.agents/skills/*/SKILL.md`.
4. **Prepares a per-run agent workspace** under `results/<run-id>/agent-workspace/.mastracode/` with skills, an MCP profile (`.mastracode/mcp.json`), and `AGENTS.md`.
5. **Runs the agent** (simulated in v1 — produces a deterministic `ScenarioResult`).
6. **Persists** `result.json`, `prompt.txt`, `transcript.jsonl`, `evaluation.json`.
7. **Evaluates** the result against the scenario's `evaluator.rules`.
8. **Aggregates** all runs into `results/summary.json` and prints a console report.

## What v1 does NOT do

- Build ABAP ADT connectors.
- Wrap `adt-cli`, `arc-1`, or `vscode_abap_remote_fs` as benchmark-owned tool packages.
- Normalize error envelopes across tool providers.
- Compare connector internals as the primary benchmark objective.
- Require `adt_http_calls` for every run.
- Require token/cost/step metrics from every agent runtime.
- Create upstream pull requests to external projects.
- Ship a static website.
- Run against live BTP as the default CI mode.

Some of these may become optional future work, but they do **not** shape the v1 architecture.

## Architecture

This is an Nx monorepo. Packages:

| Package | Purpose |
|---|---|
| `@adt-bench/agent-runner` | Runtime-agnostic `AgentRunner` interface + result schemas. |
| `@adt-bench/scenarios` | Markdown scenario loader + frontmatter validation. |
| `@adt-bench/skills` | Benchmark-owned `SKILL.md` files (agentskills.io format). |
| `@adt-bench/prompt-builder` | Layered prompt construction. |
| `@adt-bench/evaluator` | Deterministic rule-based evaluator. |
| `@adt-bench/report` | JSON aggregation + console report. |
| `@adt-bench/mock-adt-server` | Minimal in-process mock of SAP ADT REST API. |
| `@adt-bench/runner-mastracode` | First concrete `AgentRunner` (simulated mode in v1). |
| `@adt-bench/bench-cli` | `bench:smoke`, `bench:run`, `bench:report`. |

See `agents/architecture.md` for the system design, and each
package's `specs/SPEC.md` for its detailed contract.

## SDD (Spec-Driven Development)

Every package has a `specs/SPEC.md` that is the **source of truth**
for what the package does. The spec drives the code, not the other
way around. Three gates enforce the contract:

```
$ pnpm spec-check
=== spec-mtime ===   PASS    # SPEC.md is newer than src/
=== spec-coverage === PASS   # every export is in SPEC.md
=== spec-drift ===   PASS    # every test in spec exists in code and vice versa
```

See `docs/spec-style.md` for the spec template, the gates, and how
to fix common failures.

## Conventions

- **TypeScript strict** (`noUncheckedIndexedAccess`, `noImplicitOverride`).
- **Zod 3.23** for all schemas.
- **Vitest 2.1** for tests.
- **ESLint 9** flat config (warnings only, no errors).
- **Conventional commits** for commit messages.
- **Agent task prompts** in `agents/issue-prompts/<n>-<slug>.md` are mirrored to GitHub issues. Each issue is a self-contained prompt a coding agent can execute.

See `agents/conventions.md` for details.

## Documentation

### For humans
- `docs/design.md` — high-level design notes
- `docs/spec-style.md` — how to write a SPEC.md
- `docs/scenario-contract.md` — scenario format
- `docs/result-schema.md` — JSON shapes
- `docs/evaluator.md` — evaluator rules
- `docs/reproducing.md` — how to run the bench
- `docs/backlog.md` — current backlog (auto-generated, see #16)
- `docs/project-views.md` — recommended project board views
- `docs/agent-prompts.md` — how to use the issue-body task prompts
- `docs/agent-task.md` — the task prompt template (this is the convention)

### For agents
- `agents/README.md` — entry point for coding agents
- `agents/architecture.md` — system architecture
- `agents/CONTRIBUTING.md` — how to add a package, scenario, or skill
- `agents/conventions.md` — code, test, commit conventions

### Skills (injected into agent prompts)
- `packages/skills/.agents/skills/abap-workflow/SKILL.md` — ABAP object workflow
- `packages/skills/.agents/skills/abap-test-loop/SKILL.md` — TDD loop for ABAP
- `packages/skills/.agents/skills/abap-result-contract/SKILL.md` — JSON output contract
- `packages/skills/.agents/skills/abap-mock-usage/SKILL.md` — mock server quirks
- `packages/skills/.agents/skills/principles/SKILL.md` — design principles (the meta-skill)
- `packages/skills/.agents/skills/sdd/SKILL.md` — spec-driven development
- `packages/skills/.agents/skills/agent-task/SKILL.md` — how to consume an issue body

## Backlog

Tracked in the org-level [GitHub Project board](https://github.com/orgs/abapify/projects/4)
(public) and as [GitHub Issues](https://github.com/abapify/adt-bench/issues).
Every issue is a self-contained agent task prompt.

## License

Apache-2.0.
