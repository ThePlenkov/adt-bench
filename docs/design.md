# Design

This document is the v1 design. It is intentionally short — the package-level
specs under `packages/*/specs/SPEC.md` are the source of truth.

## Goal

ADT-Bench runs an agent against ABAP scenarios with configured skills and MCP
servers, then measures whether the agent produced the required result.

## Non-goals (v1)

- Building ABAP ADT connectors.
- Wrapping `adt-cli`, `arc-1`, or `vscode_abap_remote_fs` as benchmark-owned
  tool packages.
- Normalizing error envelopes across tool providers.
- Forcing all tools into a canonical command set.
- Comparing connector internals as the primary benchmark objective.
- Requiring `adt_http_calls` for every run.
- Requiring token/cost/step metrics from every agent runtime.
- Upstream pull requests to external projects.
- A static website.
- Live BTP as the default CI mode.

## Loop

```
agent + skills + MCP + scenario prompt
  -> structured result JSON
  -> evaluator
  -> report
```

## Architecture

See `README.md` for the package table and the top-level layout. Each package
has its own `specs/SPEC.md`.

## SDD/TDD gates

`pnpm verify` runs:

1. `pnpm spec-check` — every package's `specs/SPEC.md` must be at least as new
   as its `src/` tree.
2. `pnpm typecheck` — `tsc --noEmit` on every package.
3. `pnpm lint` — ESLint on every package.
4. `pnpm test` — Vitest on every package.
5. `pnpm bench:smoke` — runs `create-class-hello` against the simulated agent
   and the mock ADT server, then writes `results/summary.json` and a console
   report.

The verify gate is the single merge gate.

## Deferred work

See `docs/plan.md` (the long-form v0.2 plan) for the full backlog.

| Item | Target |
|---|---|
| Real `mastracode` process spawning | v1.1 |
| Live BTP integration | v1.1 |
| Multi-trial reporting | v1.1 |
| Additional scenarios (transport, AUnit, RAP) | v1.1 |
| Additional MCP servers (Codex, Claude Code, Gemini CLI) | v1.1 |
| Agent-based + hybrid evaluator | v1.1 |
| Static website | v2 |
| Connector comparison dashboards | v2 |
| Custom ADT adapters | separate project |
