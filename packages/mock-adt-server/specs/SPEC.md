# Spec: @adt-bench/mock-adt-server

## Purpose
A minimal in-process mock of the SAP ADT REST API, used to drive deterministic agent smoke runs without a real SAP/BTP system.

## Scope

Implements (v1 minimum):

- `GET /sap/bc/adt/discovery` — Atom feed listing `oo-classes`.
- `GET /sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=...&maxResults=...` — Atom feed of matching classes.
- `GET /sap/bc/adt/oo/classes/{name}/source/main` — class source.
- `PUT /sap/bc/adt/oo/classes/{name}/source/main?lockHandle=...` — write source.
- `POST /sap/bc/adt/oo/classes` — create class.
- `POST /sap/bc/adt/oo/classes/{name}?_action=LOCK&accessMode=MODIFY` — acquire lock.
- `POST /sap/bc/adt/oo/classes/{name}?_action=UNLOCK&lockHandle=...` — release lock.
- `POST /sap/bc/adt/activation?method=activate&preauditRequested=true` — bulk activate.
- `GET /__mock/state` — JSON snapshot of seeded classes and locks.
- `POST /__mock/reset` — wipe state.
- `GET /__mock/stats` — per-endpoint call counts.

## CSRF

- `X-CSRF-Token: Fetch` on a GET request causes the server to issue a token via the `X-CSRF-Token` response header.
- POST/PUT currently do not require the token (v1 simplification; v1.1 may add enforcement).

## Invariants

1. The mock accepts the v1 SAP content types (`application/vnd.sap.adt.oo.classes.v2+xml`, `application/xml`, `text/plain; charset=utf-8`).
2. Lock handles are opaque random strings. PUT fails with 409 if the handle does not match the currently-held lock.
3. `__mock/reset` is the canonical way to wipe state between runs.

## Test coverage

- Discovery returns Atom.
- CSRF token issuance.
- Search filtering.
- End-to-end create → lock → write → unlock → activate cycle.
- PUT without valid lock → 409.
- Stats endpoint tracks call counts.
- Reset clears state.
