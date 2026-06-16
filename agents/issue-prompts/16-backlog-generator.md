# Issue #16 — Link README to issue backlog, generate docs/backlog.md

## Task

Replace the inline "What v1 does NOT do" list in the README with a
link to a generated `docs/backlog.md` that mirrors the open issues.
Add a `pnpm docs:backlog` script that regenerates the file from the
GitHub Issues API.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `docs/backlog.md` (currently hand-maintained)
  - `README.md`
  - `package.json`
- Background: `docs/backlog.md` is a static copy of the issue list. If
  it drifts from the actual project, contributors waste time. The
  generator script keeps them in sync.

## Out of scope

- Pushing to the project board programmatically. View creation is still
  blocked (no API). See `docs/project-views.md`.
- Label sync. Labels are managed via `gh` and the project view, not in
  this script.

## Files to add or modify

- `tools/generate-backlog.mjs` (new) — calls the GitHub Issues API and
  emits `docs/backlog.md`.
- `package.json` — add `docs:backlog` script.
- `docs/backlog.md` — replace the hand-maintained dependency graph
  block with an auto-generated section.
- `README.md` — link to the generated doc.

## Steps

1. Implement `tools/generate-backlog.mjs`:
   - Use `gh api repos/abapify/adt-bench/issues?state=open&per_page=100`.
   - Group by milestone (None, v1.1, v1.2, v2).
   - For each issue, emit a one-line summary: `**#N** <title> — [open](url) [P0|P1|P2]`.
   - Read each issue body to find `Blocked by #N` / `Blocks #N` lines;
   - emit a small dependency tree per milestone.
2. Add a script: `"docs:backlog": "node tools/generate-backlog.mjs"`.
3. Run it; verify the output matches the current hand-maintained file.
4. Add a check in `pnpm verify` that runs the script and asserts no
   drift:
   ```
   docs:check: docs:backlog && git diff --quiet docs/backlog.md
   ```
   (Fails CI if the file is out of date. Optional but valuable.)
5. Update the README's "What v1 does NOT do" section to be a link to
   `docs/backlog.md`.

## Deliverables

- `tools/generate-backlog.mjs` works.
- `docs/backlog.md` is generated.
- README links to the generated file.

## Test plan

- Run the script; diff against committed file; expect no diff.
- Edit an issue body; re-run; expect a diff.

## Acceptance gate

- `pnpm docs:backlog` produces a `docs/backlog.md` that matches what's
  on GitHub.
- Optional `pnpm docs:check` (if added) fails when the file is out of
  date.

## Definition of done

- [ ] Generator script implemented and committed.
- [ ] `pnpm docs:backlog` works.
- [ ] README updated.
- [ ] `pnpm verify` exits 0.
- [ ] Conventional commit: `docs: generate docs/backlog.md from GitHub issues`.
- [ ] PR opened; this issue closed.

## Dependencies

Blocked by none.
