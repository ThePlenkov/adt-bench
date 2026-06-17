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
- **Meta-skill sub-directory:**
  ```
  packages/skills/.agents/skills/_meta/<name>/SKILL.md
  ```
  Skills in `_meta/` are for humans and coding agents, not for the
  ABAP agent at run time. The harness MUST skip them. They follow
  the same frontmatter and file format as regular skills.
- **Per-skill frontmatter** (YAML at the top of `SKILL.md`):
  ```yaml
  ---
  name: <kebab-case>
  description: <one-line summary, max 120 chars>
  ---

  **Exports: 0** (data package).

The spec-coverage tool treats a package without a `src/` directory
as "data-only" and does not enforce the export test on it.

## 3. Behaviour contracts

### 3.1 Required skills (v1.1)

Exactly **four regular skills** MUST exist under
`packages/skills/.agents/skills/`. They are loaded into the agent
prompt at run time. Removing one is a v1.1+ change and requires
updating this spec.

| Skill name | Purpose | One-line description |
|---|---|---|
| `abap-workflow` | Standard ABAP object workflow | "Standard ABAP object workflow (discover, create or edit, check, activate, validate)." |
| `abap-test-loop` | Test-driven loop | "Test-driven loop for ABAP — inspect, change, check syntax, run unit tests, diagnose, fix." |
| `abap-result-contract` | Strict JSON output contract | "How to return a strict scenario result JSON with evidence and no extra prose." |
| `abap-mock-usage` | Mock ADT differences | "Differences and deterministic behavior of the mock ADT server used by adt-bench smoke runs." |

Each skill's `description` is the exact text above. (Trim leading
whitespace and a single trailing newline before comparison.)

### 3.2 Meta-skills (v1.1, sub-directory `_meta/`)

Three meta-skills exist for humans and coding agents. They are
NOT loaded into the agent prompt at run time. They document the
project's design principles, the SDD practice, and the agent-task
convention.

| Skill name | Purpose |
|---|---|
| `principles` | The 12 design principles this codebase is built on. |
| `sdd` | Spec-driven development — the 9-section template and the three gates. |
| `agent-task` | How to consume a GitHub issue body as an agent task prompt. |

The harness MUST skip any sub-directory whose name starts with
`_`. This is verified by `packages/bench-cli/src/cli.ts:42-44`
(the `if (e.name.startsWith('_')) continue` check).

### 3.3 SKILL.md content rules

- MUST start with the frontmatter delimited by `---`.
- The `name` field MUST be lowercase kebab-case.
- The `name` field MUST match the directory name.
- The `description` field MUST be 1 line, max 120 chars.
- After the frontmatter, the body MUST be valid markdown.
- The body SHOULD have an H1 heading (e.g. `# abap-workflow`)
  that matches the skill name in title-case.
- The body SHOULD be 1-3 screens of text. Skill files > 500 lines
  are almost certainly trying to do too much.

### 3.4 Tool-agnosticism (regular skills only)

- A regular skill (anything NOT under `_meta/`) MUST NOT name a
  specific MCP server, CLI, or agent API. For example,
  `abap-workflow` mentions "ADT REST API" generically but does
  NOT say "use the `create_class` tool from `arc-1`".
- Meta-skills (under `_meta/`) MAY name specific tools because
  they are read by humans, not by the ABAP agent.
- If a tool-specific behavior is needed (e.g. "arc-1 returns 403
  on CSRF mismatch"), it belongs in a per-MCP-server README, not
  in a shared skill.

### 3.5 Loading

The harness reads skills via `loadSkillFragments(skillsSourceDir)`
from `@adt-bench/bench-cli`. The function:

- Lists child directories of `skillsSourceDir` non-recursively.
- **Skips** any sub-directory whose name starts with `_` (e.g.
  `_meta`).
- Reads `<child>/SKILL.md` for each remaining child.
- Returns the file contents in `readdir` order.
- Skips silently if a `SKILL.md` is missing or unreadable.

## 4. Invariants

1. **The four regular skills are always present.** Any PR that
   removes a regular skill fails CI.
2. **The three meta-skills are always present under `_meta/`.**
   Any PR that removes a meta-skill fails CI.
3. **`name` matches the directory name.** A skill at
   `.agents/skills/foo-bar/SKILL.md` with `name: baz` is invalid.
4. **No tool-specific content in regular skills.** The CI check
   `tools/spec-coverage.mjs` greps each `SKILL.md` for the
   forbidden substrings: `arc-1`, `adt-cli`, `abapify-adt-mcp`,
   `claude code`, `codex`, `gemini`. None of these may appear in
   a regular skill body. Meta-skills are exempt from this check.
5. **The directory contains exactly one `SKILL.md`.** A skill
   directory with no `SKILL.md` is skipped silently; a directory
   with multiple `SKILL.md` files (e.g. a backup) is invalid.

## 5. Error model

- **Missing skill:** `loadSkillFragments` skips silently. The
  prompt simply omits the missing skill. This is by design: a
  scenario should be able to run with a partial skill set.
- **Malformed frontmatter:** the skill is included as-is. The
  harness does not parse the YAML; the LLM does. (Future versions
  may add a strict parse to catch skill bugs early.)
- **Forbidde substrings in regular skill:** `spec-coverage`
  fails the build with the file path and the offending term.

## 6. Test matrix

This package is a data package. It has no `src/`, no `*.spec.ts`,
and no tests. The behaviors in §3.5 (the loader) are tested in
`packages/bench-cli/src/cli.spec.ts`. The behaviors in §3.1
(content rules) are enforced by `tools/spec-coverage.mjs`.

For the full test matrix of the loader, see
`packages/bench-cli/specs/SPEC.md` §6.

### CI-level checks (prose, not matrix rows)

- **`spec-coverage` grep for forbidden tool names** — every
  regular skill body MUST NOT contain `arc-1`, `adt-cli`,
  `abapify-adt-mcp`, `claude code`, `codex`, or `gemini`. The
  `tools/spec-coverage.mjs` CI step enforces this. Meta-skills
  (under `_meta/`) are exempt.
- **`pnpm bench:smoke` end-to-end** — the smoke run loads all
  regular skills into the agent prompt, runs the simulated
  agent, and verifies that the resulting `ScenarioResult` is
  valid. This exercises the loader indirectly and is the strongest
  proof that the skills are being consumed.

## 7. Non-goals

- The package does NOT provide a programmatic API. It is data.
- The package does NOT enforce the `description` length in code.
  The 120-char limit is a convention enforced by review.
- The package does NOT translate skills. All skills are English
  in v1.
- The package does NOT version skills. Skill content is committed
  to git; old commits contain old skills.

## 8. Dependencies

None. This package has no `src/` and no imports.

The harness (`@adt-bench/bench-cli`) reads the files at runtime
via Node's `fs/promises`. The files are committed to the repo.

