---
name: abap-mock-usage
description: Differences and deterministic behavior of the mock ADT server used by adt-bench smoke runs.
---

# abap-mock-usage

When the benchmark is running against the local mock ADT server (the default in v1), a few things differ from a real SAP system:

- **Authentication** is always `Basic` (user `demo`, password `demo`). No X.509, no SNC, no OAuth.
- **CSRF tokens** are issued by the mock on any GET with `X-CSRF-Token: Fetch`. POST/PUT currently do not enforce the token in v1.
- **Locks** are per-object. A second LOCK from another session overwrites the handle in v1 (real SAP returns 200 with empty handle).
- **Activation** always succeeds for any object that has a source. It does not actually run the ABAP compiler.
- **ABAP Unit** is **not** implemented in v1 of the mock. Use the `kind: "test"` evidence only when the real backend is configured.
- **The `__mock/*` admin endpoints** (`/__mock/state`, `/__mock/reset`, `/__mock/stats`) are not part of SAP ADT. Do not call them from production code; they exist only for the harness and the evaluator.
- **Statistics** — `/__mock/stats` returns `{ total, by_endpoint }` counters that the harness uses for the optional `metrics.adt_http_calls` field.
- **No transport checks** — `transportchecks` is not implemented; the mock skips it and treats `$TMP` packages as local.

When a scenario is run in mock mode, the prompt may include a "Mock ADT server" section with the URL. Use that URL as the base for your MCP server's `ABAP_URL` (or equivalent).
