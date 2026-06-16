# agents/ — agent-facing documentation

This directory is the entry point for **coding agents** (Claude Code,
Cursor, Codex CLI, Gemini CLI, mastracode, ...) and for humans who
work alongside them. The documentation here is written *for* the
agent: it is the spec the agent reads to know what to do.

## Read these in order

1. **[architecture.md](architecture.md)** — the system design in 5
   minutes. Read this first. It tells you what packages exist, how
   they fit together, and where the boundaries are.
2. **[conventions.md](conventions.md)** — the codebase's house rules.
   TypeScript strict, Zod for schemas, conventional commits, the
   `pnpm verify` gate, how to add a package. Read this before
   touching any file.
3. **[CONTRIBUTING.md](CONTRIBUTING.md)** — step-by-step recipes for
   the common tasks: add a package, add a scenario, add a skill,
   add an evaluator rule, add a runner. Read this when you have a
   task in hand.

## Task prompts

The 16 issues in the [project board](https://github.com/orgs/abapify/projects/4)
are mirrored as files in `agents/issue-prompts/<n>-<slug>.md`. These
are **self-contained agent task prompts** — each one is a complete
prompt that tells a coding agent exactly what to do, what files to
read, what files to write, what tests to add, and what the
acceptance gate is. The convention is documented in
`docs/agent-prompts.md`.

To pick up an issue:

1. Read the issue body (or the local `agents/issue-prompts/<n>-*.md`
   file).
2. Read the **Read first** list in the issue body.
3. Read the **Out of scope** section before writing code.
4. Execute the **Steps** in order.
5. Run `pnpm verify` and ensure it exits 0.
6. Open a PR with the conventional commit message in **Definition of done**.

## Skills

`packages/skills/.agents/skills/` contains 7 SKILL.md files. The
first 4 are domain-specific (ABAP workflow, test loop, result
contract, mock usage). The last 3 are meta:

- `principles/` — the design principles this codebase is built on
- `sdd/` — how to practice spec-driven development
- `agent-task/` — how to consume an agent task prompt (an issue)

These are loaded into the agent's prompt by the harness at run
time. They are also useful for human collaborators.

## What this codebase is NOT

This is not a connector comparison framework. The v1 plan
deliberately removed the per-tool adapter packages (`tools-adt-cli`,
`tools-arc-1`, `tools-abapfs`) — see `docs/backlog.md` for the
context. v1.1+ may add them back, but only as time permits.

The benchmark's value comes from comparing **agent runtimes**
(mastracode, Claude Code, Codex, Gemini CLI) against the **same
scenarios** with the **same MCP servers**. The scenarios, skills,
and mock ADT server are the shared substrate; the agent runtimes
are the variable.
