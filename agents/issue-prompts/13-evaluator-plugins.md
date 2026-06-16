# Issue #13 — Evaluator plugin API for custom rules

## Task

Refactor the evaluator to expose a registration API so third-party
packages (or scenario authors) can add custom rules without forking
the evaluator.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `packages/evaluator/src/evaluator.ts`
  - `packages/evaluator/specs/SPEC.md`
  - `docs/evaluator.md`
- Background: the v1 evaluator has 10 hard-coded rules. The user
  should be able to add a `package-z-released` or
  `no-deprecated-syntax` rule without editing the evaluator source.

## Out of scope

- Distribution. Rules can be `require()`d by a project-level setup
  script; no new npm packages are introduced by this issue.
- Network-loaded rules. Local registration only.

## Files to add or modify

- `packages/evaluator/src/evaluator.ts` — replace the const
  `RULE_REGISTRY` with a mutable `Map` and a `registerRule(name, fn)`
  export.
- `packages/evaluator/src/registry.ts` (new) — the public
  `registerRule` / `listRules` / `reset` API.
- `packages/evaluator/src/registry.spec.ts` (new)
- `packages/evaluator/src/evaluator.spec.ts` — convert the
  `RULE_REGISTRY` references to use the new map.
- `packages/evaluator/specs/SPEC.md` — update.
- `docs/evaluator.md` — new section "Custom rules".

## Steps

1. Move the rule map from `evaluator.ts` into a new `registry.ts`
   module. Export `registerRule(name: string, fn: RuleFn)`, `getRule(name)`,
   `listRules()`, and `reset()` (for tests).
2. Keep the built-in rules registered in `evaluator.ts` via
   `registerRule(...)` calls.
3. Add a small `examples/custom-rule.ts` that shows registering a rule
   from a project.
4. Update `evaluator.ts` to use `getRule(name)` instead of indexing the
   const map.
5. Add `registry.spec.ts` with:
   - `registerRule + getRule` round-trip.
   - `listRules` returns built-ins + the registered one.
   - `reset` clears only the user-registered rules.
6. Update `docs/evaluator.md` with a "Custom rules" section.

## Deliverables

- `registerRule` exported from `@adt-bench/evaluator`.
- Example file.
- Docs updated.
- 3 new unit tests.

## Test plan

- Unit: `registry.spec.ts` — 3 tests.
- Existing evaluator tests still pass.

## Acceptance gate

- `pnpm verify` exits 0.
- The custom rule example actually runs (one demo test in
  `registry.spec.ts`).

## Definition of done

- [ ] `registerRule` exported.
- [ ] Example file committed.
- [ ] Docs updated.
- [ ] Tests pass.
- [ ] `pnpm verify` exits 0.
- [ ] Conventional commit: `feat(evaluator): plugin API for custom rules`.
- [ ] PR opened; this issue closed.

## Dependencies

Blocked by none.
