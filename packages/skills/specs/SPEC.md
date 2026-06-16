# Spec: @adt-bench/skills

## Purpose
Benchmark-owned domain instructions in `SKILL.md` format. Loaded by the runner and injected into the agent prompt as system_message fragments.

## Scope

- 4 skills in v1:
  - `abap-workflow` — discover/create/lock/write/unlock/activate
  - `abap-test-loop` — inspect/change/check/aunit/fix iteration
  - `abap-result-contract` — strict JSON output contract
  - `abap-mock-usage` — differences when running against the mock ADT server

## Out of scope

- Skills that mention specific tool names or APIs. The default set is
  tool-agnostic; per-MCP-server guidance lives in MCP server docs.
- Hot reload.

## File format

Each skill is a directory under `packages/skills/.agents/skills/<name>/` with
a `SKILL.md` file (agentskills.io layout). Frontmatter:

```yaml
name: kebab-case-name
description: One-line summary.
```

## Invariants

1. Skills do not name specific tools by default.
2. The runner picks up every directory under `.agents/skills/` and reads its
   `SKILL.md` for prompt injection.
3. Skills are tool-agnostic: they describe the *work*, not the *API*.

## Test coverage

The runner's `loadSkillFragments` is exercised end-to-end by the bench:smoke run.
