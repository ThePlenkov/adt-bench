# Spec: @adt-bench/mock-adt-server

## 1. Purpose

An in-process HTTP server that mocks the SAP ADT REST API. Used for
deterministic agent smoke runs without a real SAP/BTP system. Knows
nothing about agents, scenarios, or reports — it is a self-contained
HTTP server. v1 implements a 16-endpoint minimum; v1.1 (#5) extends to
24+ endpoints.

## 2. Public surface

The package exports exactly the following symbols from `src/index.ts`:

```ts
export interface MockState {
  classes: Map<string, { name: string; source: string; activated: boolean }>;
  httpCalls: Map<string, number>;  // path -> count
}

export interface MockServer {
  url: string;             // "http://127.0.0.1:<port>"
  port: number;
  close: () => Promise<void>;
  reset: () => void;        // wipes state.classes, locks, csrf tokens, httpCalls
  state: MockState;
}

export interface StartOptions {
  initialClasses?: Array<{ name: string; source: string; activated?: boolean }>;
  port?: number;           // 0 = pick a free port
}

export function startMockAdt(opts?: StartOptions): Promise<MockServer>;
```

**Total exports: 6** (2 interfaces + 1 function + 1 type via the
MockServer interface).

## 3. Behaviour contracts

### 3.1 `startMockAdt(opts)`

- Starts an HTTP server on `127.0.0.1` at `opts.port` (or 0 = OS-chosen).
- Binds and resolves once the listener is ready (port known).
- Returns `{ url, port, state, reset, close }`.
- `url` is `http://127.0.0.1:<port>`.
- `state` is shared and live; the caller can inspect it after
  starting.
- The first call to `startMockAdt` MUST succeed; subsequent calls
  may use the same or different ports.

### 3.2 `MockServer.close()`

- Calls `server.close()`.
- Resolves once the server has stopped accepting new connections.
- Rejects with the underlying error if `close` fails.
- After `close`, any HTTP call to `url` fails with `ECONNREFUSED`.

### 3.3 `MockServer.reset()`

- Wipes `state.classes` (clears all classes, even the seeded ones).
- Wipes the in-memory `locks` map.
- Wipes the in-memory `csrfTokens` map.
- Wipes `state.httpCalls` (the per-endpoint counter is reset to 0).
- Does NOT close the server.
- Idempotent; safe to call multiple times.

### 3.4 `MockState`

- `classes`: a `Map<string, ClassState>`. Keys are uppercase class
  names (`ZCL_HELLO`). Values are `{ name, source, activated }`.
  `name` is the uppercase name; `source` is the verbatim ABAP source;
  `activated` is the post-`activate` state (true after a successful
  `POST /sap/bc/adt/activation` that includes the class).
- `httpCalls`: a `Map<string, number>` from HTTP path to call count.
  Incremented on every request (including `/__mock/*`).

### 3.5 Implemented endpoints (v1.1)

Every request is logged in `state.httpCalls` BEFORE any other
processing. CORS preflight (`OPTIONS`) is always allowed.

| Method | Path | Behaviour |
|---|---|---|
| `OPTIONS` | `*` | 204 No Content, CORS headers. |
| `GET` | `/sap/bc/adt/discovery` | Returns an Atom feed listing `oo-classes`. 200. |
| `GET` | `/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=...&maxResults=...` | Returns an Atom feed of classes whose name contains `query` (case-insensitive, `*` is stripped). 200. |
| `GET` | `/sap/bc/adt/oo/classes/{name}/source/main` | Returns the class's `source` as `text/plain`. 404 if not found. |
| `PUT` | `/sap/bc/adt/oo/classes/{name}/source/main?lockHandle=...` | Writes the request body to the class's `source`. Sets `activated = false`. 409 if the lock handle is invalid. 204 on success. |
| `POST` | `/sap/bc/adt/oo/classes` | Creates a class. Body must be an XML with `<adtcore:name>...</adtcore:name>`. 400 if missing, 409 if exists, 201 with `Location: /sap/bc/adt/oo/classes/{lower}` on success. |
| `POST` | `/sap/bc/adt/oo/classes/{name}?_action=LOCK&accessMode=MODIFY` | Acquires a lock. Returns `<LOCK_HANDLE>{handle}</LOCK_HANDLE>` in `application/xml`. 200. |
| `POST` | `/sap/bc/adt/oo/classes/{name}?_action=UNLOCK&lockHandle=...` | Releases the lock if the handle matches. 204. |
| `POST` | `/sap/bc/adt/activation?method=activate&preauditRequested=true` | Body is XML with `<adtcore:objectReference .../>` items. Sets `activated = true` for each referenced class. Returns `<adtcore:activationResult ...>...</...>` with `<adtcore:objectStatus ... activationStatus="activated"/>` per item. 200. |
| `GET` | `/__mock/state` | Returns JSON: `{ classes: [{ name, activated, source_length }], locks: [{ name, handle }] }`. 200. |
| `POST` | `/__mock/reset` | Calls `state.reset()` (wipes classes, locks, csrf, httpCalls). 200 `{ok: true}`. |
| `GET` | `/__mock/stats` | Returns JSON: `{ total, by_endpoint: Record<path, number> }`. 200. |

### 3.6 v1.1 additions (tracked in #5)

- `POST /sap/bc/adt/cts/transportchecks` — returns synthetic
  `DEVK900123` for non-`$TMP` packages.
- `POST /sap/bc/adt/checkruns` — returns `application/vnd.sap.adt.checkmessages+xml`.
- `POST /sap/bc/adt/abapunit/testruns` — 202 with run-id Location.
- `GET /sap/bc/adt/abapunit/testruns/{runId}` — `application/vnd.sap.adt.api.abapunit.run-status.v1+xml`.
- `GET /sap/bc/adt/abapunit/testruns/{runId}/results` — `application/vnd.sap.adt.api.junit.run-result.v1+xml` (uses the `!@MOCK_AUNIT_FAIL` marker in source to force a failure).
- `POST /sap/bc/adt/ddic/ddl/sources` — 201.
- `POST /sap/bc/adt/ddic/behaviordef` — 201.
- `POST /sap/bc/adt/ddic/behaviordef/{name}?_action=activate` — 200.

### 3.7 CSRF behavior

- `GET` request with header `X-CSRF-Token: Fetch` returns a
  `X-CSRF-Token: csrf-<random>` response header. The token is
  stored in the in-memory `csrfTokens` map (not validated on write
  in v1).
- `POST` / `PUT` requests do NOT require a token in v1. v1.1 may
  enforce this.

### 3.8 Default response for unmocked endpoints

- Currently: 404 with body `mock: no handler for <METHOD> <path>`.
- v1.1 (per #12) MUST change this to 501 with a JSON body
  `{ error: "not implemented", endpoint: "<METHOD> <path>", hint: "see docs/mock-adt-coverage.md" }`.

## 4. Invariants

1. **No process spawn:** the package uses Node's built-in `http`
   module. It MUST NOT spawn any subprocess.
2. **Deterministic per port:** given the same `initialClasses` and
   the same sequence of HTTP calls, the final `state` is the same.
   The only nondeterminism is the `csrf-<random>` token.
3. **No persistence:** every state mutation is in-memory. The
   server has no database, no log file, no on-disk cache.
4. **Per-request counter:** `state.httpCalls[path]` is incremented
   exactly once per request, even if the request returns 4xx or
   5xx.
5. **CORS:** every response sets `access-control-allow-origin: *`
   and the appropriate `allow-headers` and `allow-methods`.
6. **No agent knowledge:** the package source MUST NOT contain the
   strings `agent`, `MastraCode`, `Mastra`, `mastracode`,
   `benchmark`, or `scenario`. The mock is a transport-layer fake;
   it does not know who is calling it.

## 5. Error model

- **Server start failure:** `startMockAdt` rejects with the
  underlying error (e.g. `EADDRINUSE`).
- **Request errors:** are returned as 4xx / 5xx HTTP responses with
  the body as a plain text or JSON. The server does NOT 500 the
  process on any request.
- **Async handler errors:** caught and returned as 500 with body
  `String(e)`. The server does NOT crash.

## 6. Test matrix

| Test name | Covers contract |
|---|---|
| `mock-adt-server > serves the discovery endpoint` | §3.5 |
| `mock-adt-server > issues a CSRF token when X-CSRF-Token: Fetch is sent on GET` | §3.7 |
| `mock-adt-server > search returns matching classes` | §3.5 |
| `mock-adt-server > class create -> lock -> write -> unlock -> activate` | §3.5 |
| `mock-adt-server > PUT without a valid lock handle returns 409` | §3.5 |
| `mock-adt-server > stats endpoint reports per-endpoint call counts` | §3.5 |
| `mock-adt-server > reset wipes state` | §3.3 |

(Each v1.1 endpoint added in #5 MUST add at least one test.)

## 7. Non-goals

- The package does NOT simulate the ABAP compiler. Activation
  always succeeds for any class with a source.
- The package does NOT implement ABAP Unit semantics beyond the
  minimum needed for the v1.1 scenarios (the `!@MOCK_AUNIT_FAIL`
  marker is the only failure mode).
- The package does NOT implement transport management beyond the
  single `DEVK900123` synthetic transport.

## 8. Dependencies

- Node `http` (built-in).
- Node `net` (built-in, for `AddressInfo`).
- No other runtime dependencies.
