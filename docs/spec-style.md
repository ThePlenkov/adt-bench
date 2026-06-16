# Spec style

This document is the **spec-driven development (SDD) contract** for
the adt-bench project. Every package's `specs/SPEC.md` MUST follow
the conventions below, and every change to `src/` MUST be reflected
in the spec.

## TL;DR

- A package's `specs/SPEC.md` is the **source of truth** for what
  the package does.
- Code is correct when it matches the spec. The spec is correct
  when it describes the code we want.
- The `pnpm spec-check` script (in `tools/spec-check.mjs`) enforces
  three properties automatically. It is a hard gate in `pnpm verify`.

## The three checks

### 1. `spec-mtime` (cheap, runs first)

> "If you changed the code, you also changed the spec."

For every package, the `specs/SPEC.md` file's `mtime` MUST be at least
as new as the newest `src/**` file. If you edit `result.ts` but not
`SPEC.md`, this fails.

Use `touch specs/SPEC.md` after updating the spec to "bump" it.

### 2. `spec-coverage` (medium, runs second)

> "Every export is documented. Every internal symbol is too."

The tool greps every `export const|let|var|function|class|interface|async function`
in `src/index.ts` and asserts that the symbol name appears (as a
whole word) somewhere in `specs/SPEC.md`. It also walks every
top-level `const|let|var|function|class|interface|type` declaration
in any `src/**` file and asserts the same.

This catches:
- A new export that wasn't added to the spec.
- A renamed function that the spec still calls by its old name.
- An internal helper that the spec doesn't mention.

It does NOT catch:
- A function whose body has changed but whose signature is the
  same. (The `spec-drift` check below catches that via tests.)
- A function that throws when the spec says it can't throw.
  (This is the "behavior contracts" gap; see "Manual checks" below.)

### 3. `spec-drift` (slowest, runs last)

> "Every test in the spec exists in code. Every test in code is in the spec."

The tool parses the `## 6. Test matrix` section of `specs/SPEC.md`
and asserts:
- Every row in the matrix has a matching `it('...')` or `test('...')`
  declaration in some `*.spec.ts` file in the same package.
- Every `it('...')` or `test('...')` declaration in any `*.spec.ts`
  file in the same package has a matching row in the matrix.

The test name in the matrix is the **full path** through any nested
`describe` blocks, joined with ` > `. Example:
> `evaluate (rule-based) > fails when self-reported status is "fail"`

The tool extracts the test name from the source file (correctly
handling nested `describe` blocks, regex literals, and string
escape sequences) and matches it against the matrix row.

This catches:
- A test in the spec that was deleted from code (silent test
  deletion is a spec violation).
- A test in code that was added without updating the matrix
  (untested coverage claim).
- Test name drift between the spec and code.

## SPEC.md structure (required)

Every `specs/SPEC.md` MUST have the following sections, in this
order. Section numbers are mandatory; tools match on them.

1. **# Spec: <package-name>**
2. **## 1. Purpose** — one paragraph, no marketing.
3. **## 2. Public surface** — every TypeScript symbol exported from
   `src/index.ts`, in fenced code blocks, with the full signature.
4. **## 3. Behaviour contracts** — one subsection per exported
   function, class, or method. Each subsection states:
   - Inputs and outputs (with edge cases).
   - Error model.
   - Ordering guarantees (for async / I/O code).
5. **## 4. Invariants** — numbered list of must-hold properties.
6. **## 5. Error model** — what throws, what returns, what
   shapes (for Zod schemas).
7. **## 6. Test matrix** — markdown table with two columns:
   | Test name | Covers contract |

   The "Test name" column is the full `describe > describe > it`
   path. The "Covers contract" column references section numbers
   (e.g. `§3.1`) or invariant numbers (e.g. `Inv. 4`).
8. **## 7. Non-goals** — explicit list of things this package does
   NOT do. Catches scope creep.
9. **## 8. Dependencies** — every runtime and dev dependency. For
   internal packages, also state what other `@adt-bench/*` packages
   this one imports.

The "Total exports: N" line in §2 is optional but recommended. The
`spec-coverage` tool prints the actual count for comparison.

## Style rules

- **Be specific.** "The function returns a string" is bad. "The
  function returns an ISO 8601 datetime string captured before the
  spawn" is good.
- **Number your invariants.** `1. **No process spawn:** ...` makes
  them easy to reference in PRs.
- **Quote the test names verbatim.** Don't paraphrase
  `it('fails when self-reported status is "fail"')` to
  `it('fails when status is fail')`. The drift check matches
  literally.
- **Don't say "see code".** If the spec can't stand on its own,
  the spec is wrong.

## Adding a new package

1. `mkdir -p packages/<name>/{src,specs}`.
2. Create `packages/<name>/package.json` (see any existing).
3. Create `packages/<name>/tsconfig.json` extending the base.
4. Write `packages/<name>/specs/SPEC.md` first. The spec drives the
   code; the code does not drive the spec.
5. Write `src/index.ts`, `src/<module>.ts`, etc. Reference the spec
   section numbers in comments where it helps.
6. Write `src/<module>.spec.ts` with the test names from §6.
7. `pnpm spec-check` must pass before you open the PR.

## Changing a package

1. Edit `specs/SPEC.md` first. Update §3 (behavior contracts) and
   §6 (test matrix) if you're changing observable behavior.
2. Edit `src/` to match. Reference the spec change in the commit
   message body.
3. `pnpm spec-check` must pass.

If the change is purely internal (no exported signature change, no
behavior change, no test name change), a `touch specs/SPEC.md` is
enough to satisfy `spec-mtime`.

## Common failures and fixes

| Symptom | Fix |
|---|---|
| `spec-mtime` says SPEC.md is older than src/ | `touch specs/SPEC.md` after updating it. |
| `spec-coverage` says an export is undocumented | Add the symbol to §2 with its full signature. |
| `spec-coverage` says an internal symbol is undocumented | Add the symbol to §3 in the relevant behavior contract. |
| `spec-drift` says a test is in spec but not code | Either add the test, or remove the row from the matrix. |
| `spec-drift` says a test is in code but not spec | Add the row to §6 with the full path. The path is `describe > describe > it` joined by ` > `. |
| `spec-drift` says a test name has a quote mismatch | The matrix row must match the source `it('...')` verbatim. Including the quotes. |

## Why three checks, not one

- `spec-mtime` is cheap (just `stat` calls) and catches the most
  common drift: "I changed the code but forgot the spec".
- `spec-coverage` is medium (regex + string match) and catches
  symbol-level drift.
- `spec-drift` is the most thorough but slowest (parses the spec
  table and walks the AST-light). It catches the most insidious
  drift: "I deleted a test" or "I added a test but didn't tell
  the spec".

Run them in this order so the cheap one fails fast.

## What the spec does NOT cover (manual checks)

- **Behavioral contracts** — the spec describes the contract in
  prose; nothing automatically checks that `run()` does what §3.2
  says. Unit tests are the proof. The test matrix in §6 maps
  tests to contract sections; if a contract is not in the matrix,
  it's untested.
- **Throw / non-throw behavior** — the spec says "MUST NOT throw"
  in many places. The only enforcement is a unit test that
  asserts no throw (or a `try { ... } catch { fail }` pattern).
- **Performance** — not covered. Add benchmarks separately.
- **Visual output** — `printConsoleReport`'s exact format is in
  the code, not the spec. The spec only says "prints a tabular
  report" and the test asserts the right number of lines.

When in doubt: add a test. The spec is a contract; the test is the
proof the contract is honored.
