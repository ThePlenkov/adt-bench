# Conventions

The codebase's house rules. These are **enforced** by `pnpm verify`
(where mechanical) and by code review (where not). Read this before
making non-trivial changes.

## Language and tooling

- **TypeScript 5.6**, strict mode. `noUncheckedIndexedAccess: true`
  is on, so `arr[i]` is `T | undefined`. Always narrow with `if (i
  in arr)` or `arr[i]!` (with a comment) before use.
- **Zod 3.23** for every external-input schema. Zod is the only
  validator. Do not introduce `class-validator`, `yup`, or
  hand-rolled parsers in new code.
- **Vitest 2.1** for tests. The describe/it pattern. Tests live next
  to the code as `*.spec.ts`.
- **ESLint 9** flat config. Warnings only — no errors. Lint is
  advisory, not a gate.
- **Node 22** minimum. Use `node:fs/promises`, `node:http`, etc.
- **pnpm 11** for the workspace. `pnpm install`, `pnpm add`, etc.
- **No code emitters** (no `ts-node`, no `swc`, no `esbuild`
  custom transforms). `tsx` is fine for running scripts.
- **No bundlers** in v1. TypeScript `tsc` produces the
  `dist/` outputs; consumers import from `src/` directly.

## Code style

- **ESM only.** All packages have `"type": "module"`. Imports use
  `.js` extension even for `.ts` files (this is the ESM-with-
  TypeScript convention).
- **Zod-first schemas.** Define the Zod schema first, then the
  TypeScript type as `z.infer<typeof Schema>`. The Zod schema
  is the source of truth.
- **`strict: true` schemas.** `OptionalRunMetricsSchema` and
  `AgentRunResultSchema` use `.strict()` to reject unknown keys.
  Other schemas (e.g. `ScenarioResultSchema`) are lenient because
  the agent may add fields.
- **No domain leakage across packages.** A package's source MUST
  NOT mention another domain's terms. Specifically:
  - `agent-runner` MUST NOT mention ABAP, ADT, MCP, mastracode,
    claude, openai, gpt, gemini, etc.
  - `mock-adt-server` MUST NOT mention agent, benchmark, scenario.
  - `scenarios` MUST NOT import any other `@adt-bench/*` package.
  This is checked by `tools/spec-coverage.mjs` (manually
  inspected — no automated grep yet).
- **Prefer `const` and immutability.** Avoid `let`. If you need a
  mutable collection, use `Map` / `Set` / arrays with `.push()`.
- **No `any`.** If you can't avoid it, use `unknown` and narrow.

## Testing

- One `*.spec.ts` per `*.ts`. Tests live next to the code.
- **Test names must match the spec's test matrix exactly.** The
  `pnpm spec-check` (`spec-drift`) gate enforces this. If you
  rename a test, update `specs/SPEC.md` §6 in the same commit.
- **Test names use the full `describe > describe > it` path.**
  Example: `evaluate (rule-based) > fails when self-reported
  status is "fail"`.
- **One assertion per test** is the rule of thumb. Multiple
  expects are fine if they all verify the same contract.
- **For Zod schemas, always test the failure modes** (invalid
  input, unknown keys, missing required fields). The schema is
  the API; test it like code.
- **No snapshot tests** in v1. They drift and obscure the diff.
  Use explicit `expect(x).toEqual(...)` assertions.

## The `pnpm verify` gate

Run before opening a PR. The gate runs (in order):

```
pnpm spec-check     # 3 sub-gates: spec-mtime, spec-coverage, spec-drift
pnpm typecheck      # tsc --noEmit on every package
pnpm lint           # eslint packages/*/src
pnpm test           # vitest run on every package
pnpm bench:smoke    # end-to-end: scenario -> prompt -> agent -> result -> eval -> report
```

All five MUST exit 0. If any fails, the PR is blocked.

The bench:smoke step is the **end-to-end proof**: it loads a real
scenario, runs the simulated agent, evaluates the result, writes
artifacts to `results/`, and prints a console report. If this
fails, the harness is broken.

## Commit messages — Conventional Commits

Format: `<type>(<scope>): <subject>`

- `feat` — new feature
- `fix` — bug fix
- `refactor` — code change that doesn't add a feature or fix a bug
- `docs` — documentation only
- `test` — adding or updating tests
- `chore` — tooling, CI, dependencies
- `perf` — performance improvement
- `revert` — undo a previous commit

Scope is the package name when the change is package-local
(`feat(evaluator): agent-based evaluators`), or a short area
(`docs(skills): add principles SKILL`).

Subject is imperative mood, lowercase, no period, ≤72 chars.

Body (optional) explains the **why** in 2-4 sentences. Reference
the issue number with `Closes #N` or `Refs #N` when applicable.

## Adding a new package

```
mkdir -p packages/<name>/{src,specs}
# Create:
#   packages/<name>/package.json
#   packages/<name>/tsconfig.json
#   packages/<name>/src/index.ts    (the public surface)
#   packages/<name>/src/<module>.ts
#   packages/<name>/src/<module>.spec.ts
#   packages/<name>/specs/SPEC.md   (BEFORE writing src/)
```

Follow the 9-section SPEC.md template in `docs/spec-style.md`. The
`pnpm spec-check` gate will fail until the spec describes every
export and every test.

## Adding a new scenario

Create `scenarios/<id>.md` with frontmatter + body. The frontmatter
schema is `ScenarioFrontmatterSchema` (see
`packages/scenarios/src/loader.ts`). The body has a `## Goal` and
`## Acceptance criteria` section. The evaluator rules must be
defined in `packages/evaluator/src/evaluator.ts` if they are
new — otherwise list the existing rule names in
`evaluator.rules`.

## Adding a new skill

Create `packages/skills/.agents/skills/<name>/SKILL.md` with
frontmatter (`name: <name>`, `description: <one line>`) and a
markdown body. The skill is auto-loaded by `loadSkillFragments`.
Do NOT mention specific tool names in the body — skills are
tool-agnostic. The skill's `name` MUST match the directory name
and MUST be lowercase kebab-case.

## Adding a new runner

1. Copy `packages/runner-mastracode/` to `packages/runner-<name>/`.
2. Rename the class. The runner `id` MUST be unique across all
   runners (e.g. `'mastracode'`, `'claude-code'`, `'codex'`).
3. Replace the simulated `run` with a real subprocess spawn
   (v1.1+). v1.1 spec is in the project board (#1, #2, #3).
4. Update `bench-cli` to dispatch on `--agent <name>`.
5. Update the relevant `agents/mastracode/profiles/` to include
   the new runner's MCP setup, or add a per-runner profile dir.

## What reviewers look for in a PR

- [ ] `pnpm verify` exits 0.
- [ ] The spec was updated **before** the code (see the diff order
      in git log).
- [ ] No new exports without SPEC.md mentions.
- [ ] No new tests without a §6 matrix row.
- [ ] No deleted tests without a §6 matrix row removal.
- [ ] No new dependencies in `package.json` without a
      justification in the PR body.
- [ ] Conventional commit message.
- [ ] PR description references the issue (`Closes #N`).
