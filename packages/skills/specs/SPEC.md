# Spec: @adt-bench/skills

## 1. Purpose

The benchmark-owned domain instructions loaded by the harness and
injected into the agent prompt as system-message fragments. Skills
teach the agent the ABAP workflow, the testing loop, the result
contract, and how to interact with the mock ADT server. They are
tool-agnostic: they describe the *work*, not the *API*.

## 2. Public surface

This package is a **data package** — it has no `src/`, no exports.
The package is consumed by reading files from disk.

- **Package type:** data-only. No `main` or `exports` field in
  `package.json`.
- **Skill directory layout** (agentskills.io format):
  ```
  packages/skills/.agents/skills/<name>/SKILL.md
  ```
- **Per-skill frontmatter** (YAML at the top of `SKILL.md`):
  ```yaml
  ---
  name: <kebab-case>
  description: <one-line summary, max 120 chars>
  ---
  ```

**Exports: 0** (data package).

The spec-coverage tool treats a package without a `src/` directory as
"data-only" and does not enforce the export test on it.

## 3. Behaviour contracts

### 3.1 Required skills (v1.1)

Exactly four skills MUST exist. Removing one is a v1.1+ change and
requires updating this spec.

| Skill name | Purpose | One-line description |
|---|---|---|
| `abap-workflow` | Standard ABAP object workflow | "Standard ABAP object workflow (discover, create or edit, check, activate, validate)." |
| `abap-test-loop` | Test-driven loop | "Test-driven loop for ABAP — inspect, change, check syntax, run unit tests, diagnose, fix." |
| `abap-result-contract` | Strict JSON output contract | "How to return a strict scenario result JSON with evidence and no extra prose." |
| `abap-mock-usage` | Mock ADT differences | "Differences and deterministic behavior of the mock ADT server used by adt-bench smoke runs." |

Each skill's `description` is the exact text above. (Trim leading
whitespace and a single trailing newline before comparison.)

### 3.2 SKILL.md content rules

- MUST start with the frontmatter delimited by `---`.
- The `name` field MUST be lowercase kebab-case.
- The `name` field MUST match the directory name.
- The `description` field MUST be 1 line, max 120 chars.
- After the frontmatter, the body MUST be valid markdown.
- The body SHOULD have an H1 heading (e.g. `# abap-workflow`) that
  matches the skill name in title-case.
- The body SHOULD be 1-3 screens of text. Skill files > 500 lines are
  almost certainly trying to do too much.

### 3.3 Tool-agnosticism

- A skill MUST NOT name a specific MCP server, CLI, or agent API.
  For example, `abap-workflow` mentions "ADT REST API" generically
  but does NOT say "use the `create_class` tool from `arc-1`".
- If a tool-specific behavior is needed (e.g. "arc-1 returns 403 on
  CSRF mismatch"), it belongs in a per-MCP-server README, not in
  a shared skill.

### 3.4 Loading

The harness reads skills via `loadSkillFragments(skillsSourceDir)`
from `@adt-bench/bench-cli`. The function:
- Lists child directories of `skillsSourceDir`.
- Reads `<child>/SKILL.md` if present.
- Returns the file contents in `readdir` order.
- Skips silently if a `SKILL.md` is missing or unreadable.

## 4. Invariants

1. **The four required skills are always present.** Any PR that
   removes a skill fails CI.
2. **`name` matches the directory name.** A skill at
   `.agents/skills/foo-bar/SKILL.md` with `name: baz` is invalid.
3. **No tool-specific content.** The CI check `tools/spec-coverage.mjs`
   greps each `SKILL.md` body for a small list of forbidden
   substrings: `arc-1`, `adt-cli`, `abapify-adt-mcp`, `claude code`,
   `codex`, `gemini`. None of these may appear in a skill body.
4. **The directory contains exactly one `SKILL.md`.** A skill
   directory with no `SKILL.md` is skipped silently; a directory
   with multiple `SKILL.md` files (e.g. a backup) is invalid.

## 5. Error model

- **Missing skill:** `loadSkillFragments` skips silently. The
  prompt simply omits the missing skill. This is by design: a
  scenario should be able to run with a partial skill set.
- **Malformed frontmatter:** the skill is included as-is. The
  harness does not parse the YAML; the LLM does. (Future versions
  may add a strict parse to catch skill bugs early.)

## 6. Test matrix

The skills are tested at three levels:
- **CI grep:** `tools/spec-coverage.mjs` greps each `SKILL.md` for
  the forbidden substrings. The test fails if any are found.
- **Smoke run:** `pnpm bench:smoke` runs `executeRun` with the
  default skills, builds the prompt, and the agent's `final_text`
  (in simulated mode) is checked to be a valid `ScenarioResult`.
- **Manual:** read each SKILL.md in the GitHub UI to confirm
  content quality.

(No unit tests in v1.1; the test matrix is the CI grep + the
smoke run.)

## 7. Non-goals

- The package does NOT provide a programmatic API. It is data.
- The package does NOT enforce the `description` length in code.
  The 120-char limit is a convention enforced by review.
- The package does NOT translate skills. All skills are English in
  v1.

## 8. Dependencies

None. This package has no `src/` and no imports.

The harness (`@adt-bench/bench-cli`) reads the files at runtime via
Node's `fs/promises`. The files are committed to the repo.
