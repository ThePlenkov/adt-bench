# Agent task prompts — convention

Each issue in the [adt-bench backlog](https://github.com/orgs/abapify/projects/4) is a self-contained **agent task prompt**. The same content lives in two places:

1. **On GitHub** — the issue body (set by `gh issue edit` or the web UI).
2. **In this repo** — under `agents/issue-prompts/<n>-<slug>.md`. The in-repo copy is the source of truth; the GitHub body is regenerated from it.

The markdown files are checked into the repo so that:

- A coding agent can be pointed at a local file path instead of a URL.
- The prompts survive a GitHub outage.
- They can be reviewed in PRs and improved over time.

## Prompt structure

Every prompt follows the same template. Sections in **bold** are mandatory; the rest are common.

```
# Issue #N — <short title>

## Task
<one-line imperative summary>

## Context
- Repo: https://github.com/abapify/adt-bench
- Read first: <list of docs/ and packages/ files>
- Background: <why this task exists>

## Out of scope
<copy from the v1 non-goals + task-specific guard-rails>

## Files to add or modify
<exact list of file paths>

## Steps
1. <ordered imperative>
2. <...>

## Deliverables
- <file 1> — <what it contains>
- <file 2> — <what it contains>

## Test plan
- Unit tests: <list>
- Integration: <list>
- `pnpm verify` MUST pass before you open the PR.

## Acceptance gate
- <binary pass/fail criteria>
- `pnpm verify` exits 0.

## Definition of done
- [ ] <checkbox>
- [ ] Code committed with the conventional commit message
- [ ] PR opened against main
- [ ] `pnpm verify` green
- [ ] Issue closed

## Dependencies
- Blocked by <links>
- Blocks <links>
```

## How a coding agent should consume a prompt

A coding agent (Cursor, Claude Code, Codex, etc.) can be pointed at one of these files. The expected behavior:

1. Read the prompt in full.
2. Read every file in the **Read first** list (typically in `docs/` and `packages/`).
3. Read the issue's **Dependencies** to understand what's already done.
4. Read the **Out of scope** section before writing code — those guard-rails are non-negotiable.
5. Execute the **Steps** in order, modifying the **Files to add or modify** list.
6. Run `pnpm verify` and ensure it exits 0.
7. Open a PR with the conventional commit message in the **Definition of done**.
8. Mark the **Definition of done** checkboxes; close the issue when the PR merges.

## When the prompt and the issue body drift

If the in-repo file (`agents/issue-prompts/<n>-<slug>.md`) and the GitHub issue body disagree:

- The **in-repo file wins**. Update the GitHub body to match.
- The in-repo file is the source of truth because it is reviewed in
  PRs.

To sync the GitHub body with the in-repo file:

```bash
gh issue edit <n> -R abapify/adt-bench --body-file agents/issue-prompts/<n>-<slug>.md
```

## Adding a new prompt

1. Copy an existing prompt that has similar scope.
2. Rename to `agents/issue-prompts/<n>-<slug>.md` (zero-padded).
3. Update every section to match the new task.
4. Create the corresponding GitHub issue.
5. Push the in-repo file in the same PR as the related code, or in a
   docs-only PR.
6. Run `gh issue edit <n> --body-file agents/issue-prompts/<n>-<slug>.md`.

## Why this convention

The backlog is the single most important artifact in the project.
Every prompt must be:

- **Self-contained.** A new contributor (or a new coding agent) should
  be able to do the work without reading anything outside the
  prompt's "Read first" list.
- **Action-oriented.** Each step is an imperative. "Consider doing
  X" is not a step.
- **Testable.** Every prompt names the tests that must pass.
- **Bounded.** Every prompt names what is **out of scope** so the
  agent does not drift into adjacent work.
- **Idempotent.** Two agents given the same prompt produce the same
  PR. (We are not there yet; v1.1 is the first version of this
  convention.)
