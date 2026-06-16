---
name: abap-workflow
description: Standard ABAP object workflow (discover, create or edit, check, activate, validate).
---

# abap-workflow

The canonical sequence for working with any ABAP object via the ADT REST API:

1. **Discover** — call `/sap/bc/adt/discovery` (or your server's equivalent) to learn which endpoints are available. The MCP tools should expose this for you; use them.
2. **Search** — before creating, search for the object name. Avoid creating duplicates.
3. **Create (if needed)** — POST to the create endpoint with the appropriate descriptor (e.g. `application/vnd.sap.adt.oo.classes.v2+xml` for a class). The response includes a `Location` header with the new URI.
4. **Lock** — POST `?_action=LOCK&accessMode=MODIFY` to acquire an edit lock. Save the `LOCK_HANDLE` from the response body.
5. **Write source** — PUT the source to the include URI with the lock handle. `Content-Type: text/plain; charset=utf-8`.
6. **Unlock** — POST `?_action=UNLOCK&lockHandle=...` to release.
7. **Activate** — POST to `/sap/bc/adt/activation` with the object references.
8. **Validate** — read the source back, run a syntax check, or run ABAP Unit if applicable.

The CSRF token dance: a GET request with `X-CSRF-Token: Fetch` returns a token in the response header. Pass the same token (and the cookies) on every state-changing request.
