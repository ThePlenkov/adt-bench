# Issue #12 — Document mock ADT coverage + 501 for unmocked endpoints

## Task

Two related polish items:
1. Create `docs/mock-adt-coverage.md` listing every endpoint the
   harness ever plans to mock, with the current status (mocked,
   not-mocked, planned) and a reference to the test that covers it.
2. Make the mock return `501 Not Implemented` with a structured JSON
   body for any endpoint the harness doesn't handle, so agents fail
   fast and visibly.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `packages/mock-adt-server/specs/SPEC.md`
  - `packages/mock-adt-server/src/server.ts`
  - `packages/skills/.agents/skills/abap-mock-usage/SKILL.md`
- Background: an agent encountering a 404 (the current default) may
  retry indefinitely. A `501` with a clear body lets the agent
  understand the endpoint is known but intentionally unmocked, and
  adjust its strategy.

## Out of scope

- Implementing the missing endpoints. That's tracked in #5 and
  future work.
- 501 for the `/__mock/*` admin routes. Those are special.

## Files to add or modify

- `docs/mock-adt-coverage.md` (new) — full endpoint matrix.
- `packages/mock-adt-server/src/server.ts` — change the default
  `send(res, 404, ...)` to a 501 with a JSON body.
- `packages/mock-adt-server/src/server.spec.ts` — new test for 501.
- `packages/skills/.agents/skills/abap-mock-usage/SKILL.md` — document
  the 501 behavior.

## Steps

1. **Coverage matrix** — list every SAP ADT endpoint grouped by
   category (`oo-classes`, `abapunit`, `cts`, `discovery`, etc.):
   - `endpoint` — full path
   - `method` — GET/POST/etc.
   - `status` — `mocked` | `planned (v1.1)` | `not in scope`
   - `test` — path of the covering test
   - `spec` — path of the SPEC entry
   Format as a markdown table; alphabetise within category.
2. **501 response** — in the default branch of `handle()`:
   - `res.statusCode = 501`
   - `Content-Type: application/json`
   - Body: `{ "error": "not implemented", "endpoint": "<method> <path>", "hint": "see docs/mock-adt-coverage.md" }`
3. **Skill update** — add a section to `abap-mock-usage.md`:
   "When you receive a 501 from the mock, do not retry. The endpoint
   is known but out of scope for the current mock. Switch strategy:
   find an alternative endpoint, or report the gap in the result's
   `errors` array with `status: "partial"`."
4. Add a unit test asserting the 501 shape.

## Deliverables

- `docs/mock-adt-coverage.md` matrix.
- Mock returns 501 + JSON body for unmocked endpoints.
- Skill updated.
- New unit test.

## Test plan

- `server.spec.ts > unmocked endpoints return 501 with a JSON body`.
- Read the matrix: every entry either has a test or is marked
  `not in scope`.

## Acceptance gate

- `pnpm verify` exits 0.
- The coverage doc exists and lists all endpoints the v1.1 mock
  should cover.
- An unmocked endpoint returns 501 + JSON body, not 404.

## Definition of done

- [ ] Coverage doc created.
- [ ] 501 behavior implemented and tested.
- [ ] Skill updated.
- [ ] `pnpm verify` exits 0.
- [ ] Conventional commit: `feat(mock-adt): coverage docs and 501 for unmocked endpoints`.
- [ ] PR opened; this issue closed.

## Dependencies

Blocked by #5 (the coverage doc lists the endpoints #5 implements).
