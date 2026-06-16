# Contributing — recipes

Step-by-step recipes for the common tasks. Each recipe is a
checklist. Do them in order.

Before any of this, **read `agents/conventions.md`** and the
relevant package's `specs/SPEC.md`.

## Add a new package

When you need a new layer of abstraction (e.g. a new evaluator
type, a new report format).

1. **Create the directory layout**:
   ```
   mkdir -p packages/<name>/{src,specs}
   ```
2. **Write `specs/SPEC.md` first** (see `docs/spec-style.md`):
   - §1 Purpose
   - §2 Public surface (every export you will add)
   - §3 Behaviour contracts
   - §4 Invariants
   - §5 Error model
   - §6 Test matrix
   - §7 Non-goals
   - §8 Dependencies
3. **Write `package.json`** (copy an existing small one, change
   the name + scripts).
4. **Write `tsconfig.json`** extending `../../tsconfig.base.json`.
5. **Write `src/index.ts`** with the exports from §2.
6. **Write `src/<module>.ts`** with the implementation.
7. **Write `src/<module>.spec.ts`** with the test names from §6.
8. Run `pnpm spec-check` — it should pass.
9. Run `pnpm verify` — it should pass.
10. Open a PR.

## Add a new scenario

When the benchmark needs to cover a new ABAP task.

1. **Check the mock ADT endpoints** — does the scenario need a
   service the mock doesn't support? If yes, file an issue to
   extend the mock first (per #5).
2. **Write `scenarios/<id>.md`** with frontmatter:
   ```yaml
   ---
   id: <kebab-case-id>
   title: Human-readable title
   difficulty: easy|medium|hard
   required_mcp_servers: [abap]
   required_skills: [abap-workflow]
   timeout_ms: 300000
   evaluator:
     type: rule
     rules: [has-class, activation, status-pass, no-fatal-errors]
   ---
   ```
3. **Write the body** with `## Goal`, `## Constraints`, `##
   Acceptance criteria`, `## Expected final response`.
4. **Run `pnpm bench:smoke --scenario <id>`** to confirm the
   scenario loads and the mock can serve the necessary calls.
5. **Update `docs/scenario-contract.md`** with the new scenario's
   rule set.
6. Open a PR.

## Add a new skill

When the agent needs guidance on a new workflow.

1. **Create `packages/skills/.agents/skills/<name>/SKILL.md`** with
   frontmatter:
   ```markdown
   ---
   name: <kebab-case-name>
   description: One-line summary, max 120 chars.
   ---
   ```
2. **Write the body** in markdown. **Do not** mention specific tool
   names (no `arc-1`, `claude`, `codex`, `mcp-server`, etc.). Skills
   are tool-agnostic.
3. **Update `packages/skills/specs/SPEC.md` §3.1** to add the new
   skill to the required-skills table.
4. Run `pnpm spec-check` — the no-tool-names check will fail if
   you violated the rule.
5. Open a PR.

## Add a new evaluator rule

When the existing rules don't cover a new acceptance criterion.

1. **Open `packages/evaluator/src/evaluator.ts`**.
2. **Write a builder function** in the §3.4 area. The function
   takes a `ScenarioResult | null` and returns a `RuleResult`.
3. **Register it in `RULE_REGISTRY`** with a stable name. The name
   is a string used in scenario `evaluator.rules`. Do not reuse
   names.
4. **Add a test in `evaluator.spec.ts`** with a `describe` block
   for the new rule. Test both pass and fail cases.
5. **Update `packages/evaluator/specs/SPEC.md` §3.4** to add the
   rule to the registry table. Update §6 to add the test.
6. **Update `packages/skills/.agents/skills/abap-result-contract/SKILL.md`**
   if the rule is something the agent should know about (usually
   not — most rules are internal).
7. Run `pnpm spec-check` and `pnpm verify`.
8. Open a PR.

## Add a new agent runner (v1.1+)

When a new agent CLI needs to be benchmarked.

1. **Check the agent's CLI surface** — how does it accept a
   prompt, how does it emit output (JSONL? plain text?), how does
   it signal completion?
2. **Create `packages/runner-<name>/`** mirroring
   `runner-mastracode/`:
   ```
   packages/runner-<name>/
   ├── package.json
   ├── tsconfig.json
   ├── specs/SPEC.md        # the runner's contract
   ├── src/
   │   ├── index.ts
   │   ├── runner.ts        # implements AgentRunner
   │   └── runner.spec.ts
   └── fixtures/
       └── <scenario>.jsonl # recorded output
   ```
3. **Write `specs/SPEC.md` first** with the public surface
   (`<Name>Runner` class implementing `AgentRunner`).
4. **Implement `runner.ts`**:
   - `prepare`: copy skills + MCP profile + AGENTS.md to a
     per-run workspace.
   - `run`: spawn the agent, parse output, return `AgentRunResult`.
   - For the v1.1 milestone, support `simulated`, `replay`
     (recorded fixture), and `live` modes.
5. **Record a fixture** for the `simulated` default: run the agent
   once, save its JSONL output, commit it.
6. **Update `bench-cli`** to dispatch on `--agent <name>`.
7. **Add an MCP profile** under `agents/mastracode/profiles/`
   (or a per-runner profile dir).
8. **Update `bench:smoke`** to use the new runner.
9. Run `pnpm verify` — it should pass without a live LLM call.
10. Open a PR. The CI workflow runs `bench:smoke` with the
    default runner (mastracode).

## Add a new MCP server

When the benchmark needs to test a new MCP server (e.g.
`abapify-adt-mcp` instead of `arc-1`).

1. **Create `agents/mastracode/profiles/<name>.mcp.json`** with the
   server's `command` and `env`:
   ```json
   {
     "mcpServers": {
       "abap": {
         "command": "npx",
         "args": ["-y", "abapify-adt-mcp@latest"],
         "env": {
           "ABAP_URL": "${ABAP_URL}",
           "ABAP_USER": "${ABAP_USER}",
           "ABAP_PASSWORD": "${ABAP_PASSWORD}"
         }
       }
     }
   }
   ```
2. **Add a smoke scenario** in `bench-cli` that uses this profile.
3. **Update `docs/project-views.md`** with the new profile name.
4. Open a PR.

## Add a new endpoint to the mock ADT server

When a scenario needs a service the mock doesn't support.

1. **Open `packages/mock-adt-server/src/server.ts`**.
2. **Add a handler** in the `handle()` function for the new
   method + path. The handler should:
   - Increment `state.httpCalls[path]`.
   - Set CORS headers (via `setCors(res)`).
   - Issue a CSRF token if the request is a GET with
     `X-CSRF-Token: Fetch`.
   - Read the body if it's a POST/PUT (`await readBody(req)`).
   - Return the documented SAP content type and shape.
3. **Add a test** in `server.spec.ts` covering: success case, not
   found, error case.
4. **Update `packages/mock-adt-server/specs/SPEC.md` §3.5** with
   the new endpoint.
5. **Update `docs/mock-adt-coverage.md`** with the new endpoint
   and its status.
6. Run `pnpm spec-check` and `pnpm verify`.
7. Open a PR.

## Common pitfalls

- **The `pnpm spec-check` gate is unforgiving.** It will fail on a
  single missing mention. If you're in a hurry, run it locally
  before pushing. The output is verbose but clear about what's
  missing.
- **Test names are literal strings.** The `pnpm spec-drift` check
  compares the matrix row text to the `it('...')` text exactly.
  Punctuation, capitalization, and the full `describe > it` path
  must match.
- **The skills package is data.** No `src/`, no exports. The
  spec-coverage tool treats it specially.
- **Never edit `results/`.** It is gitignored. The smoke run
  regenerates it.
- **Commit one logical change per PR.** If you're adding a
  scenario AND a mock endpoint, that's two PRs. Smaller PRs
  review faster and roll back easier.
