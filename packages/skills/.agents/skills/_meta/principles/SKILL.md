---
name: principles
description: The 12 design principles this codebase is built on. Read first, before any task.
---

# principles

The adt-bench codebase was built from scratch on a small set of
non-negotiable principles. Every decision — what to include, what
to defer, what to reject — is traceable to one of these. When in
doubt, fall back to the principle. When you find yourself breaking
one, justify it loudly in the PR.

The principles are ordered roughly from "this is the meta-rule" to
"this is what we do on Tuesday". Read them in order.

## 1. Spec-driven development (SDD) is the load-bearing rule

The spec is the source of truth. Code is correct when it matches
the spec. The spec is correct when it describes the code we want.
The `pnpm spec-check` gate enforces this automatically.

**The spec is written before the code.** Not the other way around.
Not at the same time. Before. If you find yourself writing code
first, stop and write the spec.

See the `sdd` skill for the template, the three gates, and the
common failures.

## 2. Agent-first, runtime-agnostic

The benchmark's value is comparing **agent runtimes** against the
same scenarios. The scenarios, skills, and mock ADT server are
the shared substrate; the agent is the variable. Every architectural
decision must support this.

- A new agent runtime (Claude Code, Codex, Gemini CLI) MUST be
  addable as a single new package (`packages/runner-<name>/`).
- The shared substrate MUST NOT change to support a new runtime.
- The harness code (`bench-cli`) MUST NOT know which runtime is
  being used at the type level — only at the dispatch level
  (`--agent <name>`).

## 3. The harness is a thin orchestrator

`packages/bench-cli` is the only place that knows the end-to-end
pipeline. Every other package is a single-concern module with a
narrow contract. The harness glues them together.

If you find yourself adding business logic to the harness, push it
down into a package with its own spec. The harness should be
~300 lines, not 3,000.

## 4. No domain leakage across packages

A package's source code MUST NOT mention another domain's terms.

- `agent-runner` MUST NOT mention ABAP, ADT, MCP, mastracode,
  claude, openai, gpt, gemini.
- `mock-adt-server` MUST NOT mention agent, benchmark, scenario.
- `scenarios` MUST NOT import any other `@adt-bench/*` package.
- `prompt-builder` MUST NOT inject connector-specific adapter
  documentation (that's the runner's job).
- `evaluator` MUST NOT know which agent produced the result.

This is checked by `tools/spec-coverage.mjs` (manually, for now).
The reason: if a package starts knowing about another domain, the
boundary blurs and a future refactor becomes impossible.

## 5. Zod is the only validator

Every external input is parsed by a Zod schema. The schema is the
source of truth; the TypeScript type is `z.infer<typeof Schema>`.
No `class-validator`, no `yup`, no hand-rolled parsers.

Why: Zod gives us runtime validation + compile-time types from one
declaration. The `.strict()` modifier catches typos and schema
drift. The `.parse()` throws `ZodError` with a structured path.
These are real engineering wins, not theoretical.

## 6. The test matrix is the contract

Every package's `specs/SPEC.md` §6 lists every test the package
must pass. The `spec-drift` tool fails the build if a test in the
matrix is missing from code, OR if a test in code is missing from
the matrix. The two directions are equally important.

A test that is not in the matrix is "untested coverage claim" — a
lie about what we know. A matrix row that is not in code is a
broken promise. Both fail the build.

## 7. Tests are the proof, not the spec

The spec is the **what** — the contract. The tests are the **proof
that the contract holds**. The spec is prose; the tests are
executable.

If the spec says "MUST NOT throw", the proof is a test that
catches the throw and reports a failure. If the spec says
"returns the file content as a string", the proof is a test that
calls the function with a known input and asserts the string.

A spec without tests is a wish. A test without a spec is a
maintenance burden. Both together are a contract.

## 8. The 9-section SPEC template is mandatory

Every `specs/SPEC.md` has the same 9 sections, in the same order:

1. Purpose
2. Public surface
3. Behaviour contracts
4. Invariants
5. Error model
6. Test matrix
7. Non-goals
8. Dependencies

The order is fixed. The sections are mandatory. The `spec-check`
gate enforces it. Deviating from the template is a sign that
something is wrong with the spec.

Why: a predictable structure lets reviewers and tools assume
section presence. If §3 is "Behaviour contracts" in every spec,
you can find it in 2 seconds. If §3 is "How it works" in one spec
and "API reference" in another, every review costs you a search.

## 9. Out of scope is more important than in scope

Every spec has a §7 "Non-goals" section that explicitly lists what
the package does NOT do. This is not a TODO list. This is a fence.

A non-goal says: "I considered this. We are not doing it. Here's
why." It prevents scope creep at the PR-review stage. "But you
could just..." is a non-goal violation, not a feature request.

The hardest part of every design decision is not picking what
to do — it's picking what not to do. Document that.

## 10. Type the contract, not the implementation

Every cross-package boundary is a Zod schema. The schema is
public; the implementation behind it is private.

- `AgentRunResult` is a Zod schema. The shape is fixed. Changing
  it requires a major version bump.
- `ScenarioResult` is a Zod schema. The shape is what the agent
  must return. The agent can be wrong; the schema is right.
- `Evaluation` is a Zod schema. The shape is what the evaluator
  must produce. The evaluator can be wrong; the schema is right.

If you change a schema, you break a contract. The change should
be deliberate, reviewed, and documented in the spec.

## 11. The mock is the truth in tests

Every end-to-end run hits the mock ADT server. The mock is
deterministic, in-process, and has the same shape as a real SAP
ADT endpoint. A test that "talks to ADT" talks to the mock, not
to a real BTP system.

This means:

- `pnpm bench:smoke` runs in CI without secrets.
- `pnpm verify` runs in CI without an LLM (the simulated agent
  returns a deterministic `ScenarioResult`).
- A new contributor can clone, `pnpm install && pnpm verify`,
  and see the whole pipeline work in <60s.

When you add a real agent runner, you MUST also support the
`simulated` and `replay` modes so CI stays deterministic. The
`live` mode is for humans with secrets.

## 12. Prefer the boring solution

Every interesting technical choice in this codebase was rejected
in favor of the boring one:

- Hand-rolled YAML parser instead of `yaml` library? **No, use
  `yaml` (issue #10).**
- Custom GraphQL-like dependency-graph check? **No, use a script
  that grep's the spec.**
- Bespoke agent-loop framework? **No, use `mastracode` or the
  `AgentRunner` interface.**
- Bespoke project-board management UI? **No, use GitHub Issues +
  the GitHub Project board.**

Boring solutions win because:

- They are well-understood. New contributors don't need to learn
  a new abstraction.
- They have stable APIs. The `yaml` library is on a stable
  version; our hand-rolled parser was already broken on the
  `://` case.
- They are replaceable. If `vitest` stops working, we can swap to
  `node:test`. If we build a custom runner framework, we own the
  maintenance forever.

The default answer is "use the boring thing." The default answer
is right 90% of the time.

## How to use these principles

When you face a design decision, ask:

1. **Is this consistent with the spec?** (Principle 1.)
2. **Does this serve the agent-comparison goal?** (Principle 2.)
3. **Am I putting logic in the right place?** (Principle 3.)
4. **Am I leaking domain knowledge across a boundary?** (Principle 4.)
5. **Is this the boring solution?** (Principle 12.)

If the answer to any of these is "no" or "I'm not sure", stop and
read the relevant package's SPEC.md. If the SPEC.md doesn't answer
your question, **update the SPEC.md first**, then continue.
