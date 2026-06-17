# Issue #11: `pnpm run verify` end-to-end result

## Run metadata

- **Date run:** 2026-06-17
- **Working dir:** `/workspace/rigs/c5125306-f5f7-40d5-8c76-82da45b5d6ad/browse`
- **Starting commit:** `855e1bd` (latest in working tree at run time)
- **Command:** `pnpm run verify 2>&1 | tee /tmp/adt-bench-verify.log` (with `set -o pipefail`)
- **Log file:** `/tmp/adt-bench-verify.log` (120 lines)

## Tool versions

| Tool  | Version | Expected | Result |
| ----- | ------- | -------- | ------ |
| node  | v24.15.0  | >=22.19  | OK     |
| pnpm  | 11.7.0    | 11.x     | OK     |
| nx    | 20.3.0    | n/a      | OK     |

## Overall result

`pnpm run verify` **FAILED** with exit code **1**.

The chain stops on the first failing sub-step. The actual `verify` invocation
only executed `spec-check` (exit 1). The other four sub-step exit codes below
were captured by running each script in isolation after the verify run, purely
to inform this report (not part of `pnpm run verify` itself).

## Sub-step results

| Sub-step     | Exit code | Time    | Notes                                                |
| ------------ | --------- | ------- | ---------------------------------------------------- |
| spec-check   | **1**     | ~3s     | **FAILED — `verify` aborted here**                   |
| typecheck    | 0         | ~29s    | OK (run independently; not executed in `verify`)     |
| lint         | 0         | ~4s     | OK (run independently; not executed in `verify`)     |
| test         | 0         | ~20s    | OK (run independently; not executed in `verify`)     |
| bench:smoke  | 0         | ~3s     | OK (run independently; not executed in `verify`)     |

Total wall time for the `verify` invocation (which short-circuited at
`spec-check`): **4 seconds**.

## Failure detail

### Failing sub-step: `spec-check`

- **Command:** `node tools/spec-check.mjs`
- **Exit code:** 1
- **Categories in `tools/spec-check.mjs`:** `spec-mtime`, `spec-coverage`, `spec-drift`

The first 20 lines of the verify log (the full log is at
`/tmp/adt-bench-verify.log`):

```
$ pnpm run spec-check && pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run bench:smoke
$ node tools/spec-check.mjs

=== spec-mtime ===
  FAIL: agent-runner/specs/SPEC.md is older than the newest src/ change. Run `touch /workspace/rigs/c5125306-f5f7-40d5-8c76-82da45b5d6ad/browse/packages/agent-runner/specs/SPEC.md` after updating the spec.
  FAIL: bench-cli/specs/SPEC.md is older than the newest src/ change. Run `touch /workspace/rigs/c5125306-f5f7-40d5-8c76-82da45b5d6ad/browse/packages/bench-cli/specs/SPEC.md` after updating the spec.
  FAIL: evaluator/specs/SPEC.md is older than the newest src/ change. Run `touch /workspace/rigs/c5125306-f5f7-40d5-8c76-82da45b5d6ad/browse/packages/evaluator/specs/SPEC.md` after updating the spec.
  FAIL: mock-adt-server/specs/SPEC.md is older than the newest src/ change. Run `touch /workspace/rigs/c5125306-f5f7-40d5-8c76-82da45b5d6ad/browse/packages/mock-adt-server/specs/SPEC.md` after updating the spec.
  FAIL: prompt-builder/specs/SPEC.md is older than the newest src/ change. Run `touch /workspace/rigs/c5125306-f5f7-40d5-8c76-82da45b5d6ad/browse/packages/prompt-builder/specs/SPEC.md` after updating the spec.
  FAIL: report/specs/SPEC.md is older than the newest src/ change. Run `touch /workspace/rigs/c5125306-f5f7-40d5-8c76-82da45b5d6ad/browse/packages/report/specs/SPEC.md` after updating the spec.
  FAIL: runner-mastracode/specs/SPEC.md is older than the newest src/ change. Run `touch /workspace/rigs/c5125306-f5f7-40d5-8c76-82da45b5d6ad/browse/packages/runner-mastracode/specs/SPEC.md` after updating the spec.
  FAIL: scenarios/specs/SPEC.md is older than the newest src/ change. Run `touch /workspace/rigs/c5125306-f5f7-40d5-8c76-82da45b5d6ad/browse/packages/scenarios/specs/SPEC.md` after updating the spec.
  OK:   skills/specs/SPEC.md (no src/ tree)

spec-mtime: FAIL
```

`spec-check` final summary (later in the same log):

```
=== summary ===
  FAIL: spec-mtime
  FAIL: spec-coverage
  PASS: spec-drift

spec-check: FAIL
[ELIFECYCLE] Command failed with exit code 1.
[ELIFECYCLE] Command failed with exit code 1.
```

`spec-drift` is the only spec-check category that passed. The two failing
categories (`spec-mtime`, `spec-coverage`) both report the same root cause for
all 8 code packages: each package's `specs/SPEC.md` is older than the newest
change under that package's `src/`.

### `pnpm install` (precondition)

- **Command:** `pnpm install --frozen-lockfile`
- **Exit code:** 0
- **Time:** ~17s wall (15.4s pnpm reported)

## Conclusion

`pnpm run verify` does **not** pass end-to-end as of commit `855e1bd`. It
fails at the first sub-step, `spec-check`, because all 8 package SPEC.md
files have an mtime older than the newest change in their corresponding
`src/` trees, and `spec-coverage` consequently reports 8 "specs/SPEC.md is
older than the newest src/ change" violations.

Per the bead's "what NOT to do" rules, no source code, package metadata, or
lockfile was modified. Fixing the spec-mtime/coverage failures is out of
scope for this bead and should be a separate task.
