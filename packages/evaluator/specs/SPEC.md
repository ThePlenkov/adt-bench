# Spec: @adt-bench/evaluator

## 1. Purpose

Deterministic, rule-based evaluation of an agent's run against a
scenario's acceptance criteria. Parses the agent's `final_text` as a
`ScenarioResult` and applies the scenario's `evaluator.rules`. Returns
per-rule verdicts plus an overall verdict. Knows nothing about agents,
MCP, or the report layer.

## 2. Public surface

The package exports exactly the following symbols from `src/index.ts`:

```ts
export type RuleVerdict = 'pass' | 'fail' | 'partial';

export interface RuleResult {
  rule: string;
  verdict: 'pass' | 'fail' | 'skip';
  detail: string;
}

export interface Evaluation {
  overall: RuleVerdict;
  perRule: RuleResult[];
  parsedResult: ScenarioResult | null;  // from @adt-bench/agent-runner
  parseError?: string;
  selfReportedStatus?: 'pass' | 'partial' | 'fail';
}

export function parseFinalText(text: string): {
  result: ScenarioResult | null;
  error?: string;
};

export function evaluate(args: {
  scenario: ParsedScenario;             // from @adt-bench/scenarios
  run: AgentRunResult;                 // from @adt-bench/agent-runner
}): Evaluation;
```

**Total exports: 7** (1 type alias + 1 interface + 1 evaluation
interface + 1 type for `verdict` + 2 functions).

## 3. Behaviour contracts

### 3.1 `parseFinalText(text)`

- `text` is the agent's raw final answer.
- The function tolerates:
  1. Plain JSON.
  2. JSON wrapped in a single fenced code block (` ```json ... ``` `
     or ` ``` ... ``` `).
  3. JSON embedded in surrounding prose. The function finds the
     first `{` and the matching `}` and parses that slice.
- After candidate extraction, the function calls
  `JSON.parse(candidate)`. If parsing fails, returns
  `{ result: null, error: <message> }`.
- If JSON parsing succeeds, calls `ScenarioResultSchema.parse(parsed)`.
  If the schema rejects (missing fields, wrong type, unknown
  evidence kind, etc.), returns `{ result: null, error: <message> }`.
- Returns `{ result: <ScenarioResult> }` on success.
- MUST NOT throw.

### 3.2 `evaluate({ scenario, run })`

- Calls `parseFinalText(run.final_text)`.
- If the parse fails, the returned `Evaluation` has:
  - `parsedResult: null`
  - `parseError: <message>`
  - `perRule: []` (no rules evaluated when there's no result)
  - `overall: 'fail'`
- If the parse succeeds, applies each rule in
  `scenario.frontmatter.evaluator.rules` (in order) and collects a
  `RuleResult` per rule. Each `RuleResult` has:
  - `rule: <original rule name from the scenario>`
  - `verdict: 'pass' | 'fail' | 'skip'`
  - `detail: <human-readable explanation>`
- An unknown rule name produces `verdict: 'skip'` with a `detail`
  starting with `unknown rule`.
- Sets `Evaluation.selfReportedStatus` from the parsed result's
  `status`, when parsing succeeded.
- Sets `Evaluation.overall` via the aggregation function below.

### 3.3 Aggregation (overall verdict)

```
if perRule contains any verdict === 'fail':   overall = 'fail'
else if perRule all === 'pass' (or empty):     overall = 'pass'
else if perRule has at least one 'pass':       overall = 'partial'
else:                                            overall = 'fail'
```

The test `evaluator.spec.ts > fails when a key changed_object is
missing` exercises the fail path; `> passes when all rules pass`
exercises the all-pass path.

### 3.4 Built-in rules (registry)

The registry is keyed by rule name. Each rule is a function
`(parsedResult: ScenarioResult | null) => RuleResult`. The exact list
is verified by `tools/spec-drift.mjs`.

| Rule name | Behaviour |
|---|---|
| `has-class` | `verdict = 'pass'` iff `parsedResult.changed_objects` contains `ZCL_BENCH_HELLO` (case-insensitive). |
| `has-fixture-ok` | Same as above for `ZCL_BENCH_FIXTURE_OK`. |
| `has-method` | `verdict = 'pass'` iff `parsedResult.summary.toLowerCase()` includes `'say_hello'` (case-insensitive). |
| `activation` | `verdict = 'pass'` iff `parsedResult.evidence` has at least one item with `kind === 'activation'`. |
| `syntax_check` | Same for `kind === 'syntax_check'`. |
| `test` | Same for `kind === 'test'`. |
| `object-evidence` | Same for `kind === 'object'`. |
| `status-pass` | `verdict = 'pass'` iff `parsedResult.status === 'pass'`. |
| `status-partial-or-pass` | `verdict = 'pass'` iff `status ∈ {'pass', 'partial'}`. |
| `no-fatal-errors` | `verdict = 'pass'` iff `parsedResult.errors` is empty. |

Adding a new built-in rule is a v1.1+ change and requires updating
this table and the `evaluator.spec.ts` matrix in §6.

### 3.5 Rule name preservation

The `RuleResult.rule` field is the **original** rule name from the
scenario frontmatter, NOT the internal name. (E.g. `has-class` is the
canonical rule name; the implementation uses a different internal
helper. The returned `rule` is `has-class`, not `changed:ZCL_BENCH_HELLO`.)

## 4. Invariants

1. **Determinism:** given the same `run.final_text` and
   `scenario.frontmatter.evaluator.rules`, `evaluate` MUST return
   the same `Evaluation` every time. The package has no
   nondeterminism (no `Math.random`, no `Date.now`, no I/O).
2. **No throws:** `parseFinalText` and `evaluate` MUST NOT throw.
   The test `evaluate > treats unparseable final_text as overall
   fail` exercises this.
3. **Rule name fidelity:** the `rule` field in each `RuleResult` is
   the exact string from the scenario frontmatter. The
   `evaluator.spec.ts` test `fails when a key changed_object is
   missing` calls `perRule.find((r) => r.rule === 'has-class')` and
   asserts the verdict — this test would fail if the rule name
   were transformed.
4. **No external I/O:** the evaluator reads the `run.final_text` and
   the scenario's `evaluator.rules` only. It does not read files,
   call APIs, or depend on `Date.now()`.

## 5. Error model

- `parseFinalText` returns `{ result: null, error: <message> }` on
  any failure (JSON parse, schema rejection). It MUST NOT throw.
- `evaluate` always returns an `Evaluation`. It MUST NOT throw.
- The aggregation function in §3.3 is total over the set of
  `RuleResult[]`.

## 6. Test matrix

| Test name | Covers contract |
|---|---|
| `parseFinalText > parses bare JSON` | §3.1 |
| `parseFinalText > strips code fences` | §3.1 |
| `parseFinalText > extracts JSON embedded in prose` | §3.1 |
| `parseFinalText > returns null on invalid JSON` | §3.1, §4.2 |
| `parseFinalText > returns null on structurally wrong JSON` | §3.1, §4.2 |
| `evaluate (rule-based) > passes when all rules pass` | §3.2, §3.3 |
| `evaluate (rule-based) > fails when a key changed_object is missing` | §3.2, §3.4, §4.3 |
| `evaluate (rule-based) > fails when self-reported status is "fail"` | §3.4 |
| `evaluate (rule-based) > treats unparseable final_text as overall fail` | §3.2, §3.3, §4.2 |

## 7. Non-goals

- Agent-based grading. v1.1 has a separate issue (#8) to add an
  agent-based evaluator; that lives in a new module under
  `src/agent-evaluator.ts` and is NOT part of this spec.
- Mock-server state inspection. v1.1 (#5) will add a way for the
  evaluator to peek at the mock, but it is not in scope here.
- Custom rule registration API. Tracked in #13. The v1 registry is
  a private `Record<string, ...>`.

## 8. Dependencies

- `@adt-bench/agent-runner` (for `ScenarioResult` and
  `AgentRunResult` types).
- `@adt-bench/scenarios` (for `ParsedScenario` type).
- **zod 3.23.x** (transitive).

No other runtime dependencies. The package MUST NOT import
`@adt-bench/runner-*`, `@adt-bench/report`, or
`@adt-bench/mock-adt-server`.
