# Issue #9 — Live BTP integration via BTP_SERVICE_KEY

## Task

Add support for running the benchmark against a real BTP ABAP Cloud
system by accepting a `BTP_SERVICE_KEY` env var or `--service-key`
CLI flag. The runner converts the service key into the
`ABAP_URL` / `ABAP_USER` / `ABAP_PASSWORD` env vars that the
configured MCP server expects. Add a pre-flight reachability check
and an explicit `--allow-live-system` safety flag.

## Context

- Repo: https://github.com/abapify/adt-bench
- Read first:
  - `docs/design.md` — safety defaults
  - `packages/bench-cli/src/run.ts` — current CLI
  - `packages/bench-cli/src/cli.ts` — `executeRun`
  - `agents/mastracode/profiles/live-arc-1.mcp.json` — existing live profile
- Background: the v1 design mandates that v1 is deterministic and
  CI-friendly. v1.1 must add a real-system path that is **opt-in** and
  **never runs in CI** unless explicitly enabled.

## Out of scope

- Persisting credentials. The service key is read once per run and
  discarded.
- BTP-specific OAuth flows beyond the service-key format. The
  `oauth2` and `x509` profiles are future work.

## Files to add or modify

- `packages/bench-cli/src/cli.ts` — add `--service-key` flag handling.
- `packages/bench-cli/src/run.ts` — same.
- `packages/bench-cli/src/btp.ts` (new) — `parseServiceKey(json)`,
  `checkReachable(url, user, password)`.
- `packages/bench-cli/src/btp.spec.ts` (new)
- `packages/bench-cli/specs/SPEC.md` — update.
- `docs/reproducing.md` — new section "Live BTP runs".

## Steps

1. Implement `parseServiceKey(json: string)` that:
   - Parses the JSON.
   - Extracts `uaa.url`, `uaa.clientid`, `uaa.clientsecret`, the
     `abap` endpoint, and the `identityzone` / `tenantid`.
   - Returns `{ url, clientid, clientsecret, abap_url, abap_user, abap_password }`
     where `abap_user` and `abap_password` are derived from a
     service-key OAuth flow (simplest: client credentials grant
     against `uaa.url/oauth/token` with `grant_type=client_credentials`).
2. Implement `checkReachable(url)` that does a `GET /sap/bc/adt/discovery`
   with the credentials and expects 200.
3. Add `--service-key <path|->` to `bench:run` (read from file or stdin).
4. Add `--allow-live-system` flag. Without it, the runner refuses to
   proceed if a live profile is selected.
5. Add an env-var fallback: if `BTP_SERVICE_KEY` is set and
   `--allow-live-system` is true, use it.
6. In CI, **never** set `BTP_SERVICE_KEY`. The workflow file from #6
   does not pass it.

## Deliverables

- `parseServiceKey` and `checkReachable` unit-tested.
- `pnpm bench:run --profile live-arc-1 --service-key ./key.json
  --allow-live-system --scenario create-class-hello` runs end-to-end
  against a real system (when one is configured).
- `docs/reproducing.md` documents the live-system path.

## Test plan

- Unit: `btp.spec.ts > parseServiceKey` with a sample BTP service key.
- Integration: manual run against a real system (out of scope for CI).

## Acceptance gate

- `pnpm verify` exits 0.
- Live runs require both `--allow-live-system` and a service key.
- The CI workflow never sees `BTP_SERVICE_KEY`.

## Definition of done

- [ ] `parseServiceKey` and `checkReachable` implemented and unit-tested.
- [ ] `--service-key` and `--allow-live-system` flags work.
- [ ] `docs/reproducing.md` updated.
- [ ] `pnpm verify` exits 0.
- [ ] Conventional commit: `feat(cli): live BTP integration via BTP_SERVICE_KEY`.
- [ ] PR opened; this issue closed.

## Dependencies

Blocked by #1 (real runner needed to actually exercise the live
system).
