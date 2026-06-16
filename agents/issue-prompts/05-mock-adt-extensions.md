# Issue #5 — Extend mock ADT server

## Task

Extend `@adt-bench/mock-adt-server` to cover the endpoints the v1.1
scenarios need: `transportchecks`, `checkruns` (with structured error
messages), AUnit (start / poll / results, with a JUnit-formatted
response), BDEF create + activate.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `packages/mock-adt-server/src/server.ts` (the v1 16-endpoint implementation)
  - `packages/mock-adt-server/specs/SPEC.md`
  - `packages/mock-adt-server/src/server.spec.ts` (test patterns)
  - `scenarios/syntax-error-recovery.md` and the other 3 new scenarios
- Background: v1 of the mock only covered the create-class-hello
  flow. v1.1 needs the other SAP ADT endpoints so the new scenarios
  can be exercised end-to-end. All responses must match the SAP
  namespace (e.g. `application/vnd.sap.adt.checkmessages+xml`,
  `application/vnd.sap.adt.api.junit.run-result.v1+xml`).

## Out of scope

- Replicating the entire SAP ADT surface. Only the ~8 endpoints listed
  below are in scope.
- Adding 501 responses for unmocked endpoints. That's a separate
  polish issue (#12).

## Files to add or modify

- `packages/mock-adt-server/src/server.ts` — add handlers for the 8 new
  endpoints.
- `packages/mock-adt-server/src/server.spec.ts` — add tests per endpoint.
- `packages/mock-adt-server/specs/SPEC.md` — update the endpoint table.
- `docs/mock-adt-coverage.md` (new) — full coverage matrix per #12; this
  issue just adds the new endpoints to it.

## Endpoints to add

| Method | Path | Content-Type (in/out) | Returns |
|---|---|---|---|
| `POST` | `/sap/bc/adt/cts/transportchecks` | `application/vnd.sap.as+xml;dataname=com.sap.adt.transport.service.checkData` | `application/vnd.sap.as+xml;dataname=com.sap.adt.transport.service.checkData` with `REQUESTS` block. For `$TMP` packages, return empty `REQUESTS` and `RESULT=S`. For others, return a synthetic `DEVK900123`. |
| `POST` | `/sap/bc/adt/checkruns` | `application/xml` | `application/vnd.sap.adt.checkmessages+xml`. Empty `<messages>` on success; populated with `<msg:message severity="error" ...>` on failure. |
| `POST` | `/sap/bc/adt/abapunit/testruns` | `application/vnd.sap.adt.api.abapunit.run-config.v1+xml` | `202 Accepted` with `Location: /sap/bc/adt/abapunit/testruns/{runId}`. Generate UUID, store in `runs` map. |
| `GET` | `/sap/bc/adt/abapunit/testruns/{runId}` | * | `application/vnd.sap.adt.api.abapunit.run-status.v1+xml` with `status="completed"` after a 50–200ms delay. |
| `GET` | `/sap/bc/adt/abapunit/testruns/{runId}/results` | * | `application/vnd.sap.adt.api.junit.run-result.v1+xml` with real JUnit XML. If the class source contains `!@MOCK_AUNIT_FAIL`, emit 1 failure. |
| `POST` | `/sap/bc/adt/ddic/ddl/sources` | `application/vnd.sap.adt.ddl.source.v1+xml` | `201 Created`. For BDEF-as-DDL. |
| `POST` | `/sap/bc/adt/ddic/behaviordef` | `application/vnd.sap.adt.behaviordefinition.v1+xml` | `201 Created`. |
| `POST` | `/sap/bc/adt/ddic/behaviordef/{name}?_action=activate` | * | `200` with `activationResult` XML. |

Plus existing endpoint tweaks:
- `GET /sap/bc/adt/discovery` — add the new collections
  (`cts.transportchecks`, `checkruns`, `abapunit.testruns`,
  `ddic.ddl.sources`, `ddic.behaviordef`).

## Steps

1. Add a `runs` map for AUnit state: `Map<runId, { status, resultId, startedAt }>`.
2. Add a `transportRequests` map for transportchecks: `Map<name, trNumber>`.
3. Add the 8 handlers in `server.ts`, in the same style as the existing
   `classMatch` / `srcMatch` blocks.
4. For AUnit, schedule a `setTimeout` to flip `status: 'running' -> 'completed'`
   after 50–200ms.
5. Add one `server.spec.ts` test per new endpoint, mirroring the
   `lock -> write -> unlock -> activate` test for classes.
6. Update `docs/mock-adt-coverage.md` with the new entries (matrix form:
   endpoint → status → spec reference).

## Deliverables

- 8 new endpoints implemented.
- ~8 new unit tests.
- Updated SPEC.md.
- New `docs/mock-adt-coverage.md` listing every endpoint with status.

## Test plan

- Unit: per-endpoint tests.
- Integration: `pnpm bench:run --scenario syntax-error-recovery` should
  now be runnable (it was blocked on `checkruns`).
- After this + #4, `pnpm bench:matrix --scenarios all` runs all 6
  scenarios with the simulated agent.

## Acceptance gate

- `pnpm verify` exits 0.
- All 8 new endpoints have a passing unit test.
- A scenario that exercises each new endpoint (e.g.
  `syntax-error-recovery` for `checkruns`) produces a
  `results/<id>/result.json`.

## Definition of done

- [ ] 8 endpoints implemented.
- [ ] ~8 unit tests added.
- [ ] `docs/mock-adt-coverage.md` created with the full matrix.
- [ ] `pnpm verify` exits 0.
- [ ] Conventional commit: `feat(mock-adt): add transportchecks, checkruns, AUnit, BDEF endpoints`.
- [ ] PR opened; this issue closed.

## Dependencies

Blocked by none.

Blocks #4 (3 of the 4 new scenarios need these endpoints) and #12
(coverage docs reference these endpoints).
