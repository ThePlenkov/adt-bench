# Spec: @adt-bench/scenarios

## Purpose
Load and validate ABAP scenario markdown files. Each scenario declares acceptance criteria and a final-result contract.

## Scope
- `parseScenarioMarkdown(raw, sourcePath)` — parses one scenario.
- `loadScenario(path)` — reads one scenario from disk.
- `loadScenariosFromDir(dir)` — loads all `.md` files in a directory.
- `findScenario(scenarios, id)` — id-based lookup.
- `ScenarioFrontmatterSchema` — Zod schema for the YAML frontmatter.
- Custom dependency-free YAML subset parser.

## Out of scope
- Evaluator logic (lives in `evaluator`).
- Prompt construction (lives in `prompt-builder`).

## Frontmatter contract

```yaml
id: kebab-case-id           # required, validated
title: Human title          # required
difficulty: easy|medium|hard
required_mcp_servers: [abap]
required_skills: [abap-workflow]
timeout_ms: 300000          # default 300_000
tags: [string]
evaluator:
  type: rule|agent|hybrid   # default rule
  rules: [string]           # rule names
```

## Invariants

1. The `id` must match `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/`.
2. Missing optional fields fall back to documented defaults.
3. The body is preserved verbatim (after frontmatter stripping).

## Test coverage

- `extractBody` — frontmatter presence/absence.
- `parseSimpleYaml` — scalars, inline arrays, block lists, nested objects.
- `ScenarioFrontmatterSchema` — id regex, default application.
- `parseScenarioMarkdown` — end-to-end happy path.
