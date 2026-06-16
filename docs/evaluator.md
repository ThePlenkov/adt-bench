# Evaluator

The v1 evaluator is **deterministic and rule-based**. It parses the agent's
final text as a `ScenarioResult`, then applies the rule names listed in the
scenario's `evaluator.rules`.

See `packages/evaluator/specs/SPEC.md` for the canonical contract.

## Aggregation

- Any rule `fail` -> overall `fail`.
- All rules `pass` -> overall `pass`.
- Mixed but at least one `pass` -> overall `partial`.
- All `skip` or empty -> overall `fail`.

The evaluator also records the agent's self-reported status and the
`parseError` (if the final text was not valid JSON / not a valid
`ScenarioResult`).

## Adding a new rule

Open a PR that:

1. Adds a builder function to `packages/evaluator/src/evaluator.ts`.
2. Registers it in `RULE_REGISTRY`.
3. Documents it in `docs/scenario-contract.md`.

The harness will resolve the rule by name and apply it to each run.

## Future evaluators

- **Agent-based**: a second agent reads the transcript and grades
  qualitatively. v1.1+.
- **Hybrid**: rule gate first, agent-based second. v1.1+.

## Mock-state inspection

The v1 evaluator does **not** inspect the mock ADT server's state. Adding
that (e.g. "class `ZCL_BENCH_HELLO` actually exists in the mock") is a v1.1
item; it would require plumbing the mock URL into the evaluator.
