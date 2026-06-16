# Reproducing

## Prerequisites

- Node.js >= 22.19
- pnpm 11.x (`npm install -g pnpm@11`)

## Clone & install

```bash
git clone https://github.com/abapify/adt-bench.git
cd adt-bench
pnpm install
```

## Run the full verify gate

```bash
pnpm verify
```

This runs (in order):

1. `pnpm spec-check` — every package's `specs/SPEC.md` must be at least as new
   as its `src/` tree.
2. `pnpm typecheck` — `tsc --noEmit` on every package.
3. `pnpm lint` — ESLint on every package.
4. `pnpm test` — Vitest on every package.
5. `pnpm bench:smoke` — runs `create-class-hello` against the simulated
   agent and the mock ADT server.

## Run a single scenario

```bash
pnpm bench:run --scenario create-class-hello
pnpm bench:run --scenario read-class-source
```

## Inspect a run

Each run writes to `results/<ulid>/`:

```
prompt.txt          # the exact prompt sent to the agent
result.json         # the AgentRunResult
evaluation.json     # the Evaluation (per-rule verdicts)
transcript.jsonl    # NDJSON of user/assistant turns
```

## Aggregate & report

```bash
pnpm bench:report
```

Prints a console table and writes `results/summary.json`.

## Reset

`results/` is gitignored except for `.gitkeep`. `rm -rf results/*` between
runs is safe.

## LLM-based runs (v1.1+)

To run a real agent against a real SAP system, configure:

```bash
export LLM_PROVIDER=anthropic
export LLM_MODEL=claude-sonnet-4-5
export LLM_API_KEY=sk-...
export ABAP_URL=https://my-btp.example.com
export ABAP_USER=...
export ABAP_PASSWORD=...
```

Then use the `live-arc-1.mcp.json` profile (or write your own). The runner's
`simulated: false` mode is v1.1.
