# Scenario contract

Scenarios are markdown files with YAML frontmatter and a markdown body. The
body is preserved verbatim and passed to the prompt builder.

## Frontmatter

```yaml
id: kebab-case-id           # required, validated against /^[a-z0-9][a-z0-9-]*[a-z0-9]$/
title: Human title          # required
difficulty: easy|medium|hard
required_mcp_servers: [abap]   # default []
required_skills: [abap-workflow]  # default []
timeout_ms: 300000              # default 300_000
tags: [smoke, class]
evaluator:
  type: rule|agent|hybrid       # default rule
  rules: [string]               # built-in rule names
```

The schema is enforced by `@adt-bench/scenarios`' `ScenarioFrontmatterSchema`.

## Body

Markdown. The benchmark does not interpret it. Recommended sections:

- `## Goal` — what the agent must do.
- `## Constraints` — what the agent must NOT do.
- `## Acceptance criteria` — bullet list, in sync with `evaluator.rules`.
- `## Expected final response` — reminder that the final answer is JSON.

## Result contract

The agent must return a JSON object matching `ScenarioResultSchema` (see
`packages/agent-runner/src/result.ts`):

```json
{
  "scenario_id": "string",
  "status": "pass | fail | partial",
  "summary": "string",
  "evidence": [
    { "kind": "object | source | activation | syntax_check | test | diagnostic | tool_result | other", "value": "string" }
  ],
  "changed_objects": ["string"],
  "errors": ["string"]
}
```

## Built-in evaluator rules

| Rule | What it checks |
|---|---|
| `has-class` | `changed_objects` contains `ZCL_BENCH_HELLO` (case-insensitive) |
| `has-fixture-ok` | `changed_objects` contains `ZCL_BENCH_FIXTURE_OK` |
| `has-method` | `summary` contains the string `SAY_HELLO` (case-insensitive) |
| `activation` | `evidence` has at least one `kind: "activation"` |
| `syntax_check` | `evidence` has at least one `kind: "syntax_check"` |
| `test` | `evidence` has at least one `kind: "test"` |
| `object-evidence` | `evidence` has at least one `kind: "object"` |
| `status-pass` | `status` is `pass` |
| `status-partial-or-pass` | `status` is `pass` or `partial` |
| `no-fatal-errors` | `errors` array is empty |

Custom rules are v1.1+.
