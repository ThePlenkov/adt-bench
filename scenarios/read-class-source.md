---
id: read-class-source
title: Read an existing ABAP class
difficulty: easy
required_mcp_servers:
  - abap
required_skills:
  - abap-workflow
  - abap-result-contract
timeout_ms: 300000
tags:
  - smoke
  - read
evaluator:
  type: rule
  rules:
    - has-fixture-ok
    - object-evidence
    - status-partial-or-pass
    - no-fatal-errors
---

## Goal

Find the existing ABAP class `ZCL_BENCH_FIXTURE_OK` using the ABAP MCP search tool, read its source, and report the class name in your final answer.

## Constraints

- Use the configured ABAP MCP tools.
- Do not modify anything.
- The class already exists (in the mock or the real system).

## Acceptance criteria

- `ZCL_BENCH_FIXTURE_OK` is in `changed_objects` (or its evidence references the URI of the class).
- The summary mentions the class name.
- No errors reported.

## Expected final response

Return only the JSON object described in the "Result schema" section of your instructions.
