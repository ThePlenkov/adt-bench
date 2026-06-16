# Spec: @adt-bench/prompt-builder

## 1. Purpose

Builds a stable, layered prompt string the agent receives, combining
the scenario, optional skill fragments, and a result-schema sketch.
Section order is locked. The package knows nothing about the agent
runtime, MCP, or the result-evaluation logic.

## 2. Public surface

The package exports exactly the following symbols from `src/index.ts`:

```ts
export interface BuildPromptOptions {
  scenario: ParsedScenario;            // from @adt-bench/scenarios
  extraSkillFragments?: string[];      // default []
  resultSchemaJson?: string;           // default = JSON.stringify(ScenarioResultSchema._def, null, 2)
}

export function buildPrompt(opts: BuildPromptOptions): string;
```

**Total exports: 2** (1 interface + 1 function).

## 3. Behaviour contracts

### 3.1 `buildPrompt(opts)` — section order (locked)

The returned string MUST contain exactly these top-level sections, in
this order, separated by a single blank line. The order is verified
by the test `buildPrompt > includes all required sections in order`.

1. `# Role`
2. `# Available context`
3. `# Tool policy`
4. `# Validation policy`
5. `# Result policy`
6. `## Domain skills` (only when `extraSkillFragments.length > 0`)
7. `# Scenario`
8. `# Result schema`

If `extraSkillFragments` is empty or omitted, the `## Domain skills`
section is **absent** entirely (not just empty).

### 3.2 Section contents

#### 3.2.1 `# Role`

- Verbatim fixed text:
  `You are an ABAP development agent. Use the configured MCP tools and
  the loaded skills to complete the scenario. Return only the final
  JSON described in the "Result schema" section.`

#### 3.2.2 `# Available context`

- Six lines, one per frontmatter field, formatted as
  `- <Field>: <value>`:
  - `- Scenario id: \`<id>\``
  - `- Title: <title>`
  - `- Difficulty: <difficulty>`
  - `- Required MCP servers: <comma-separated, or '(none declared)'>`
  - `- Required skills: <comma-separated, or '(none declared)'>`
  - `- Timeout: <timeout_ms> ms`

#### 3.2.3 `# Tool policy`

- Verbatim three lines (see source).
- The package MUST NOT inject connector-specific adapter documentation
  by default. Connector-specific information belongs in MCP server
  docs or optional per-profile notes (handled in #1, future).

#### 3.2.4 `# Validation policy`

- Verbatim two lines (see source).

#### 3.2.5 `# Result policy`

- Verbatim three lines about the JSON-only output.

#### 3.2.6 `## Domain skills`

- Only present when `extraSkillFragments.length > 0`.
- Format:
  ```
  ## Domain skills

  The following skill descriptions are loaded. Follow them.

  ### Skill 1
  <fragment[0]>

  ### Skill 2
  <fragment[1]>
  ```
- Each fragment is `s.trim()`-ed before insertion.

#### 3.2.7 `# Scenario`

- A single line: `# Scenario`.
- Followed by the scenario's `body.trim()` content.
- The body is preserved verbatim except for leading/trailing
  whitespace stripping (`.trim()`).

#### 3.2.8 `# Result schema`

- The literal text `Return a JSON object of this shape:`
- Followed by a fenced code block with content type `json` and
  language marker omitted (or `json` if explicitly requested in the
  schema).
- Inside the fence: either `resultSchemaJson` (if provided) or the
  default which is
  `JSON.stringify(ScenarioResultSchema._def, null, 2)`.

### 3.3 Default for `resultSchemaJson`

- If `resultSchemaJson` is `undefined`, the default is
  `JSON.stringify(ScenarioResultSchema._def, null, 2)`.
- The default is **not** re-validated. The caller is responsible for
  ensuring it's a string.
- If `resultSchemaJson` is the empty string, the fenced code block
  is still rendered (empty body).

## 4. Invariants

1. **Section order is fixed.** The locked order in §3.1 is enforced
   by the order-check test. Changing the order is a breaking change.
2. **Section names are exact.** A future test asserts the headings
   match exactly (case, hash count).
3. **The scenario body is preserved verbatim** (modulo
   `String.prototype.trim()`).
4. **Skill fragments are inserted as their `trim()`-ed value**, never
   raw.
5. **No agent-runtime knowledge.** The package MUST NOT import
   `@adt-bench/runner-*` or any LLM SDK.

## 5. Error model

- `buildPrompt` MUST NOT throw under any input. The function
  concatenates strings and is total.
- An `Error` is only thrown at module load if the
  `ScenarioResultSchema._def` reference is somehow broken (it never
  is, because Zod schemas always have a `_def`).

## 6. Test matrix

| Test name | Covers contract |
|---|---|
| `buildPrompt > includes all required sections in order` | §3.1 |
| `buildPrompt > inlines extra skill fragments` | §3.2.6 |
| `buildPrompt > renders the scenario body verbatim` | §3.2.7, §4.3 |
| `buildPrompt > includes the declared MCP servers and skills` | §3.2.2 |

## 7. Non-goals

- The package does NOT load skill files from disk. The caller passes
  the fragments in. Skill loading is `@adt-bench/skills`'s
  responsibility (currently inline in the harness; the skill
  fragment loader lives in `packages/bench-cli/src/cli.ts`).
- The package does NOT validate the result schema before serializing.
  Validation is `@adt-bench/evaluator`'s job.
- The package does NOT add any tool- or agent-specific guidance to
  the prompt.

## 8. Dependencies

- `@adt-bench/scenarios` (relative import of the
  `ParsedScenario` interface — the package only references the
  interface, never runs any function from it).
- `@adt-bench/agent-runner` (for the `ScenarioResultSchema`
  default).
- **zod 3.23.x** (transitive via the two packages above).

No other runtime dependencies.
