---
name: agent-task
description: How to consume a GitHub issue body as an agent task prompt. The 9-section template, the lifecycle, the failure modes.
---

# agent-task

Every [GitHub issue](https://github.com/abapify/adt-bench/issues)
in this project is a **self-contained agent task prompt**. The
issue body is the spec for the task. The convention is documented
in [`docs/agent-prompts.md`](../../../../../docs/agent-prompts.md)
and the per-prompt files are in `agents/issue-prompts/<n>-<slug>.md`.

When a coding agent is pointed at an issue (or a local copy in
`agents/issue-prompts/`), it is expected to do the work
end-to-end without asking the user for clarification.

## The 9-section prompt template

Every issue body follows this template:

```
# Issue #N — <short title>

## Task
<one-line imperative summary>

## Context
- Repo: https://github.com/abapify/adt-bench
- Read first:
  - <list of docs/ and packages/ files>
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

The `## Task` and `## Acceptance gate` are mandatory. The other
sections may be elided for trivial tasks.

## The lifecycle of a task

1. **Pick up.** A coding agent (human or AI) reads the issue body
   and the in-repo file (`agents/issue-prompts/<n>-<slug>.md`).
2. **Read.** Consume the `## Read first` list in full. Do not
   skim.
3. **Plan.** Form a mental model of what the change looks like.
   Walk the steps. Identify the test files you'll add or update.
4. **Code.** Make the changes. Reference spec section numbers in
   code comments when it helps.
5. **Test.** Run `pnpm spec-check`, then `pnpm verify`. Both must
   pass.
6. **Commit.** Use a conventional commit message (see
   `agents/conventions.md`).
7. **PR.** Open a PR against `main` with `Closes #N` in the
   description. Wait for review.
8. **Merge.** Reviewer merges. The CI workflow runs the verify
   gate. If green, the issue closes automatically (via
   `Closes #N`).
9. **Update the spec first if behavior changes.** If your
   commit changes a public API or a behavior contract, the spec
   update goes in the SAME commit. If you change the spec
   AFTER the code, `pnpm spec-check` will fail until the spec
   catches up.

## What the agent is responsible for

- Reading the spec for every package whose interface changes.
- Adding tests with names that match `## 6. Test matrix` in the
  relevant spec.
- Updating `## 6. Test matrix` if you add a test that's not in
  the matrix.
- Updating `## 2. Public surface` if you add a new export.
- Updating `## 3. Behaviour contracts` if you change behavior.
- Running `pnpm verify` locally before pushing.
- Using a conventional commit message in the format
  `<type>(<scope>): <subject>`.
- Including `Closes #N` in the PR body.

## What the agent is NOT responsible for

- The CI workflow file (issue #6). That's a separate workstream
  because the GH_TOKEN used in this project lacks the `workflow`
  scope. The contributor needs to add the file via the GitHub UI
  or a token with the right scope.
- The GitHub Project board view management (issue handled outside
  the codebase).
- Merging the PR. Reviewer merges.
- Closing the issue. Auto-closes via `Closes #N`.

## Failure modes and recovery

### "The prompt is unclear"

Don't guess. The issue body has a `## Definition of done` section
with checkboxes. If a checkbox is unclear, leave it unchecked and
explain in the PR description. Reviewers will clarify.

If the `## Out of scope` section doesn't address an ambiguity
you're worried about, **don't expand the scope** — ask in a
comment on the issue, then proceed with the narrower
interpretation.

### "I need to change a public API"

Update the spec FIRST. Specifically:

- The `## 2. Public surface` of the affected package.
- The `## 3. Behaviour contracts` if the behavior changes.
- The `## 6. Test matrix` if you add/remove tests.
- The `## 8. Dependencies` if you add/remove imports.

Then update the code. The `pnpm spec-check` will fail until the
spec catches up.

### "I want to add a dependency"

The convention is: no new dependencies in v1.1 unless absolutely
necessary. If you must, justify it in the PR body and update
`## 8. Dependencies` in the affected spec(s).

If the dependency is internal to `@adt-bench/*`, add the package
import statement. The spec must mention the new internal dep in
§8.

### "The pnpm verify gate fails on spec-drift"

This means your test name in code doesn't match the matrix row.
Either:
- Rename the test to match the matrix row.
- Update the matrix row to match the test name (but be careful —
  the matrix row is the contract).

Either way, the test name must match EXACTLY (including quotes,
parentheses, capitalisation, and the full `describe > it` path).

### "The pnpm verify gate fails on spec-coverage"

This means you added an export without documenting it. Add it to
`## 2. Public surface` of the package's spec.

### "I need to do X but the prompt says don't"

Re-read `## Out of scope`. If X is in the list, do not do X.
File a follow-up issue for X with a different prompt. Smaller
issues review faster.

## Self-test before submitting

Before opening a PR, run this checklist mentally:

- [ ] I read the `## Read first` list.
- [ ] I checked `## Out of scope` for guard-rails.
- [ ] I edited the spec **first** (if behavior changed).
- [ ] I added tests with names from `## 6. Test matrix`.
- [ ] I updated `## 2. Public surface` (if I added exports).
- [ ] `pnpm spec-check` passes locally.
- [ ] `pnpm verify` passes locally.
- [ ] I have a conventional commit message.
- [ ] The PR description includes `Closes #N`.

If any of these is "no", do not open the PR.

## What this skill is NOT

This skill is not the **issue template**. The issue template is
in the prompt itself (in the issue body). This skill tells you
**how to consume** the prompt, not how to write one.

To **write** an issue body, see `docs/agent-prompts.md` in the
repo. The convention is the same as this skill describes, but
viewed from the prompt-author's side.
