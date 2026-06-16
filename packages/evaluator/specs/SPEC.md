# Spec: @adt-bench/evaluator

## Purpose
Deterministic, rule-based evaluation of an agent's run against a scenario's acceptance criteria.

## Scope
- `parseFinalText(text)` — extract and validate the agent's `ScenarioResult` JSON from its final answer, tolerating code fences and surrounding prose.
- `evaluate({ scenario, run })` — apply the scenario's `evaluator.rules` and return per-rule verdicts plus an overall verdict.
- Built-in rules:
  - `has-class`, `has-fixture-ok` — changed_objects membership
  - `has-method` — summary contains a string
  - `activation`, `syntax_check`, `test`, `object-evidence` — evidence-kind presence
  - `status-pass`, `status-partial-or-pass` — self-reported status threshold
  - `no-fatal-errors` — `errors` array is empty

## Out of scope
- Agent-based or hybrid evaluators (v1.1+).
- Mock-server state inspection (v1.1+).

## Result contract

```ts
interface Evaluation {
  overall: 'pass' | 'fail' | 'partial';
  perRule: { rule: string; verdict: 'pass' | 'fail' | 'skip'; detail: string }[];
  parsedResult: ScenarioResult | null;
  parseError?: string;
  selfReportedStatus?: 'pass' | 'partial' | 'fail';
}
```

## Aggregation rules

- Any `fail` → overall `fail`.
- All `pass` → overall `pass`.
- Mixed but at least one `pass` → overall `partial`.
- All `skip` or empty → overall `fail`.

## Test coverage

- `parseFinalText`: bare JSON, fenced JSON, prose-embedded JSON, invalid input.
- `evaluate`: all-rules-pass, missing changed_object, fail status, unparseable final_text.
