---
id: create-class-hello
title: Create ABAP hello class
difficulty: easy
required_mcp_servers:
  - abap
required_skills:
  - abap-workflow
  - abap-test-loop
  - abap-result-contract
timeout_ms: 300000
tags:
  - smoke
  - class
evaluator:
  type: rule
  rules:
    - has-class
    - has-method
    - activation
    - status-pass
    - no-fatal-errors
---

## Goal

Create ABAP class `ZCL_BENCH_HELLO` with public method `SAY_HELLO` returning the string `'Hello, world!'`. Activate the class.

## Constraints

- Use the configured ABAP MCP tools.
- The class must be created in package `$TMP`.
- The class must be activated.
- Use the ABAP workflow: discover -> create -> write source -> activate.

## Acceptance criteria

- Class `ZCL_BENCH_HELLO` exists.
- Method `SAY_HELLO` exists.
- The class is activated.
- The result must include evidence of at least one object, one activation, and the method in the summary.

## Expected final response

Return only the JSON object described in the "Result schema" section of your instructions.
