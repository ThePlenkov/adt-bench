# Issue #4 — Add 4 additional scenarios

## Task

Author 4 new scenario markdown files and their matching mock-adt fixtures:
`syntax-error-recovery`, `abapunit-failure-diagnose`, `create-transport-zpkg`,
`bdef-scaffold-rap`. Wire each into `pnpm bench:matrix` so the full
scenario set runs against every configured agent.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `docs/scenario-contract.md`
  - `docs/result-schema.md`
  - `scenarios/create-class-hello.md` (the template to follow)
  - `scenarios/read-class-source.md` (second example)
  - `packages/scenarios/src/loader.ts` (the schema)
  - `packages/evaluator/src/evaluator.ts` (built-in rules)
  - `packages/mock-adt-server/src/server.ts` (the mock endpoints)
  - `packages/mock-adt-server/specs/SPEC.md`
- Background: v1 only ships 2 scenarios; v1.1 broadens coverage to
  error-recovery, AUnit diagnostics, transport, and RAP. Each scenario
  declares acceptance criteria and the rule set the evaluator applies.

## Out of scope

- Adding new evaluator rules. The 10 built-in rules in
  `packages/evaluator/src/evaluator.ts` are sufficient.
- Extending the mock ADT server. The endpoints needed (`POST
  /sap/bc/adt/checkruns`, `POST /sap/bc/adt/cts/transportchecks`, AUnit
  endpoints, BDEF) are tracked separately in #5. If this issue is
  picked up before #5 is merged, document which endpoints the scenario
  expects and skip the scenario from the matrix until they exist.

## Files to add or modify

- `scenarios/syntax-error-recovery.md` (new)
- `scenarios/abapunit-failure-diagnose.md` (new)
- `scenarios/create-transport-zpkg.md` (new)
- `scenarios/bdef-scaffold-rap.md` (new)
- `fixtures/syntax-error-recovery/seed.json` (new)
- `fixtures/abapunit-failure-diagnose/seed.json` (new)
- `fixtures/create-transport-zpkg/seed.json` (new)
- `fixtures/bdef-scaffold-rap/seed.json` (new)
- `packages/bench-cli/src/cli.ts` — `bench:matrix` command (or extend
  `bench:run --all`)
- `docs/scenario-contract.md` — add the 4 new scenarios to the built-in
  rules reference

## Steps

1. **syntax-error-recovery**:
   - Goal: agent writes invalid ABAP, runs checkruns, parses the error
     message, fixes the source, re-checks.
   - Mock: pre-seed `ZCL_SYNTAX_FAIL` with `source` containing an obvious
     syntax error (e.g. `DATA: x TYPE i.\nx = .`).
   - Evaluator rules: `has-class`, `syntax_check` (twice — once fail,
     once pass), `status-partial-or-pass`.
2. **abapunit-failure-diagnose**:
   - Goal: agent reads `ZCL_BENCH_FIXTURE_FAIL_AUNIT`, runs AUnit, parses
     the JUnit result, identifies the failing assertion.
   - Mock: requires the AUnit endpoints from #5. If not available, gate
     this scenario behind `--feature abapunit`.
   - Rules: `test`, `status-partial-or-pass`, `no-fatal-errors`.
3. **create-transport-zpkg**:
   - Goal: agent creates a class in non-`$TMP` package, runs
     transportchecks, links the transport.
   - Mock: requires `transportchecks` from #5. Gate similarly.
   - Rules: `has-class`, `activation`, `status-partial-or-pass`.
4. **bdef-scaffold-rap**:
   - Goal: agent creates a behavior definition, links it to an existing
     class, activates.
   - Mock: BDEF endpoints from #5.
   - Rules: `has-class`, `activation`, `status-partial-or-pass`.

For each:
- Author the scenario markdown with a `## Goal` and `## Acceptance criteria` section.
- Add the matching fixture seed under `fixtures/<id>/seed.json` (the
  mock-adt-server fixture loader is in `mock-adt-server/specs/SPEC.md`).
- Add at least one assertion to `packages/scenarios/src/loader.spec.ts`
  that the new scenario parses cleanly.

## Deliverables

- 4 new scenario files.
- 4 fixture seed files.
- A passing `pnpm bench:matrix --scenarios all` (with `#5` merged) that
  includes the 4 new scenarios in its output.
- Updated `docs/scenario-contract.md` and `docs/backlog.md`.

## Test plan

- Unit: scenario loader tests (4 new tests).
- Integration: `pnpm bench:matrix --scenarios all` runs all 6 scenarios
  against the simulated agent and the mock ADT server.
- All 4 new scenarios produce a `results/<id>/result.json` with
  `parsed_result` populated (the evaluator's job is the next issue).

## Acceptance gate

- `pnpm verify` exits 0.
- `pnpm bench:matrix --scenarios all` runs all 6 scenarios.
- Each new scenario has a matching seed in `fixtures/`.

## Definition of done

- [ ] 4 scenario files authored.
- [ ] 4 fixture seed files.
- [ ] `bench:matrix` runs all 6.
- [ ] `pnpm verify` exits 0.
- [ ] Conventional commit: `feat(scenarios): add 4 v1.1 scenarios`.
- [ ] PR opened; this issue closed.

## Dependencies

Blocked by #5 (mock-adt-server extensions for transportchecks, AUnit,
BDEF — needed for 3 of the 4 scenarios; syntax-error-recovery only needs
checkruns, also part of #5).
