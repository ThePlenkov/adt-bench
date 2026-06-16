# Spec: @adt-bench/scenarios

## 1. Purpose

Loads ABAP scenario markdown files and validates their frontmatter
against a Zod schema. Each scenario declares its goal, constraints,
acceptance criteria, and an evaluator rule set. The body is
preserved verbatim and passed to the prompt builder. Knows nothing
about agents, MCP, or reports.

## 2. Public surface

The package exports exactly the following symbols from `src/index.ts`:

```ts
// Schema
export const ScenarioFrontmatterSchema: z.ZodObject<{
  id: z.ZodString;                   // regex /^[a-z0-9][a-z0-9-]*[a-z0-9]$/
  title: z.ZodString;                 // min(1)
  difficulty: z.ZodEnum<['easy','medium','hard']>;
  required_mcp_servers: z.ZodArray<z.ZodString>;   // default []
  required_skills: z.ZodArray<z.ZodString>;      // default []
  timeout_ms: z.ZodNumber;            // int > 0, default 300_000
  tags: z.ZodArray<z.ZodString>;      // default []
  evaluator: z.ZodObject<{
    type: z.ZodEnum<['rule','agent','hybrid']>;  // default 'rule'
    rules: z.ZodArray<z.ZodString>;             // default []
  }>;                                 // default { type:'rule', rules:[] }
}>;                                   // .strict()

// Types
export type ScenarioFrontmatter = z.infer<typeof ScenarioFrontmatterSchema>;
export interface ParsedScenario {
  frontmatter: ScenarioFrontmatter;
  body: string;                       // verbatim, trimmed of leading newlines
  sourcePath: string;                 // the path the scenario was loaded from
}

// Functions
export function extractBody(raw: string): { yaml: string; body: string };
export function parseSimpleYaml(input: string): unknown;
export function parseScenarioMarkdown(raw: string, sourcePath: string): ParsedScenario;
export async function loadScenario(path: string): Promise<ParsedScenario>;
export async function loadScenariosFromDir(dir: string): Promise<ParsedScenario[]>;
export function findScenario(scenarios: ParsedScenario[], id: string): ParsedScenario | undefined;
```

**Total exports: 9** (1 const + 2 types + 1 interface + 5 functions).

## 3. Behaviour contracts

### 3.1 `extractBody(raw)`

- If `raw` does NOT start with `'---\n'` (BOM stripped first), returns
  `{ yaml: '', body: raw }`. The body is the input verbatim.
- If `raw` starts with `'---\n'` but does NOT contain a closing
  `'\n---'`, returns `{ yaml: '', body: raw }`.
- Otherwise: the YAML block is `raw.slice(3, endOfFirstNewlineMinusThree)`
  (the bytes between the opening and closing `---` markers, stripped
  of the leading and trailing newline). The body is everything after
  the closing `---`, with leading newlines and a single optional
  `---` line stripped.
- MUST NOT trim trailing whitespace from the body.

### 3.2 `parseSimpleYaml(input)`

A dependency-free YAML subset parser. Supports:
- Scalars: numbers (int and float), booleans (`true`/`false`), `null`,
  quoted strings (`"..."` and `'...'`), bare strings.
- Inline arrays: `[a, b, c]` (whitespace tolerant, no nested
  inline arrays in v1.1 — the scenarios loader does not need them).
- Block lists: `key:\n  - a\n  - b\n  - c`.
- Nested objects: `key:\n  sub: value\n  more: value`.
- Two-space indentation convention. Four-space lists nested under
  object keys are supported.
- Empty input `''` returns `{}`.
- Lines that are blank or contain only comments (not in v1.1) are
  skipped.

What it does NOT support (out of v1.1 scope; tracked in #10 for the
`yaml` library swap):
- Multi-line scalars (`|`, `>`).
- Anchors and references (`&`, `*`).
- Tags.
- Comments (`#`).
- Flow-style nested arrays inside block-style.

If a YAML feature is needed, the file fails to parse and the loader
throws a `ZodError` (because the parsed value does not match
`ScenarioFrontmatterSchema`).

### 3.3 `parseScenarioMarkdown(raw, sourcePath)`

- Calls `extractBody(raw)` to split frontmatter from body.
- If `yaml` is empty, treats the frontmatter as `{}`.
- Calls `parseSimpleYaml(yaml)`. Throws if YAML is malformed
  (unparseable).
- Calls `ScenarioFrontmatterSchema.parse(parsed)`. Throws `ZodError`
  if any field is missing or invalid.
- Returns `{ frontmatter, body, sourcePath }`.

### 3.4 `loadScenario(path)`

- Reads `path` as UTF-8.
- Calls `parseScenarioMarkdown(raw, path)`.
- Throws if the file is missing, not UTF-8, or has invalid
  frontmatter.

### 3.5 `loadScenariosFromDir(dir)`

- Reads `dir` (non-recursive).
- For each `.md` file, calls `loadScenario(join(dir, name))`.
- Returns the array of parsed scenarios in the order the files
  appear in the directory listing.
- Files that fail to parse are reported via a thrown error from
  `loadScenario`. (Batch error handling is a future concern.)

### 3.6 `findScenario(scenarios, id)`

- Returns the first `ParsedScenario` whose `frontmatter.id` matches
  `id` exactly.
- Returns `undefined` if no match.

## 4. Invariants

1. **Round-trip:** the body's whitespace, line endings, and code
   blocks are preserved exactly. The only transformation is the
   stripping of the frontmatter and the leading newlines / closing
   `---` line that follows it.
2. **Frontmatter strictness:** the schema uses `.strict()`. A scenario
   with an unknown top-level key (e.g. `fancy_field: true` instead
   of `tags`) is rejected. The test
   `ScenarioFrontmatterSchema > rejects non-kebab id` plus the
   `.strict()` enforcement cover this.
3. **id format:** `id` MUST match `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/`.
   This is enforced by the schema's `.regex()`. Examples of valid
   ids: `create-class-hello`, `read-class-source`,
   `syntax-error-recovery`. Examples of invalid ids: `Create-Class`,
   `-foo`, `foo-`, `foo_bar`.
4. **No filesystem writes:** the package MUST NOT write any files.
   Loading is read-only.
5. **No ABAP knowledge:** the package MUST NOT import any other
   `@adt-bench/*` package. Its only dependency is `zod`.

## 5. Error model

- **YAML parse failure:** `parseSimpleYaml` may return `{}` for empty
  input. For malformed YAML (e.g. unclosed bracket), the parser
  throws a plain `Error` with a message like
  `parseSimpleYaml: unexpected token at line N`.
- **Schema validation failure:** `parseScenarioMarkdown` calls
  `ScenarioFrontmatterSchema.parse(parsed)`. The Zod `ZodError`
  propagates. The message includes the path (e.g.
  `id: must match /^[a-z0-9].../`) and the input value.
- **Filesystem errors:** `loadScenario` throws if the file does not
  exist, is not readable, or contains non-UTF-8 bytes. The error is
  a plain `Error` with the system `errno` text.

## 6. Test matrix

| Test name | Covers contract |
|---|---|
| `extractBody > splits yaml and body` | §3.1 |
| `extractBody > returns body equal to raw when no frontmatter` | §3.1 |
| `parseSimpleYaml > parses scalars` | §3.2 |
| `parseSimpleYaml > parses inline arrays` | §3.2 |
| `parseSimpleYaml > parses block lists` | §3.2 |
| `parseSimpleYaml > parses nested objects with list-valued fields` | §3.2 |
| `ScenarioFrontmatterSchema > rejects non-kebab id` | §4.3 |
| `ScenarioFrontmatterSchema > applies defaults` | §2, §3.3 |
| `parseScenarioMarkdown > parses a complete scenario` | §3.3, §4.1 |

## 7. Non-goals

- Recursive directory loading. v1.1 only supports one level.
- Frontmatter error recovery. One bad scenario aborts the load.
- Multi-line YAML scalars. Use multiple single-line entries or wait
  for the `yaml` library swap (#10).
- Scenario execution. The runner (in `@adt-bench/runner-mastracode`)
  consumes the parsed scenario, not this package.

## 8. Dependencies

- **zod 3.23.x** (production).
- No other runtime dependencies.

This package imports nothing from any other `@adt-bench/*` package.
