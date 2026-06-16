# Spec: @adt-bench/prompt-builder

## Purpose
Combine a scenario, skill fragments, and the result schema into a single stable prompt string the agent receives.

## Scope
- `buildPrompt({ scenario, extraSkillFragments?, resultSchemaJson? })` — returns a string.

## Out of scope
- Anything agent-runtime-specific.
- Skill loading — the caller is responsible for resolving skill fragments.

## Section order (locked)

1. `# Role` — fixed role description.
2. `# Available context` — scenario id, title, difficulty, required MCP servers, required skills, timeout.
3. `# Tool policy` — fixed tool-use rules.
4. `# Validation policy` — fixed validation rules.
5. `# Result policy` — fixed result-formatting rules.
6. `## Domain skills` — only present if `extraSkillFragments` is non-empty.
7. `# Scenario` — verbatim body of the scenario markdown.
8. `# Result schema` — schema sketch.

## Invariants

1. Section order is fixed and locked; tests assert it.
2. The result-schema block is always present.
3. The scenario body is preserved verbatim.
4. The prompt is plain text (markdown-flavoured).
