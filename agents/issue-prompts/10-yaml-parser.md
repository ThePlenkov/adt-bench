# Issue #10 — Swap scenarios YAML parser for a real library

## Task

Replace the dependency-free inline YAML parser in
`packages/scenarios/src/loader.ts` with a battle-tested library
(`yaml`, already in devDependencies, moved to `dependencies`).

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `packages/scenarios/src/loader.ts` (the current 200-LoC hand-rolled parser)
  - `packages/scenarios/src/loader.spec.ts` (the test cases that must still pass)
  - `packages/scenarios/specs/SPEC.md`
- Background: v1 ships a tiny parser that handles the 4 example
  scenarios. It is not robust to multi-line scalars (`|`, `>`),
  comments, anchors, or other YAML idioms contributors will use. The
  `yaml` package is already a devDependency (used for the docs site
  pipeline) and is the de-facto standard for JS YAML parsing.

## Out of scope

- Migrating any other YAML consumer in the repo.
- Adding YAML lint / format enforcement to the scenarios (separate concern).

## Files to add or modify

- `packages/scenarios/src/loader.ts` — replace `parseSimpleYaml` with a
  call to `yaml.parse`. Keep `extractBody` (markdown parsing) as-is.
- `packages/scenarios/src/loader.spec.ts` — add tests for the previously
  unsupported cases (multi-line scalars, comments, etc.).
- `package.json` — move `yaml` from `devDependencies` to `dependencies`.
- `packages/scenarios/specs/SPEC.md` — update the parser section.

## Steps

1. `pnpm add -w yaml` (or edit the root `package.json` to move it).
2. Replace the body of `parseSimpleYaml` with `yaml.parse(input)`.
   Keep the same exported function signature.
3. Run the existing tests. They should all pass without modification.
4. Add new test cases for:
   - A multi-line literal block (`description: |`).
   - A folded block (`description: >`).
   - A comment line (`# comment`).
   - A nested array of objects.
   - Quoted strings with embedded colons and quotes.
5. If `yaml.parse` returns anything other than a plain object for an
   empty string, normalize: return `{}`.

## Deliverables

- `parseSimpleYaml` now uses `yaml`.
- All existing + new tests pass.
- `yaml` is in `dependencies`, not `devDependencies`.

## Test plan

- `pnpm test` for `packages/scenarios` — all tests pass.
- A new scenario with a multi-line literal block parses correctly
  (round-trip the body through `parseScenarioMarkdown`).

## Acceptance gate

- `pnpm verify` exits 0.
- No behavior change for existing scenarios.

## Definition of done

- [ ] `parseSimpleYaml` uses `yaml.parse`.
- [ ] At least 4 new test cases added.
- [ ] `yaml` moved to `dependencies`.
- [ ] `pnpm verify` exits 0.
- [ ] Conventional commit: `refactor(scenarios): use yaml lib instead of hand-rolled parser`.
- [ ] PR opened; this issue closed.

## Dependencies

Blocked by none.
