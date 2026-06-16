---
name: sdd
description: Spec-driven development — the practice of writing the spec before the code. With the 9-section template and the three pnpm spec-check gates.
---

# sdd

Spec-driven development (SDD) is the load-bearing rule of this
codebase. The spec is the source of truth; the code is correct
when it matches the spec. The `pnpm spec-check` gate enforces it.

## The 30-second version

Every package has a `specs/SPEC.md` with 9 sections (see below).
The spec is **written before the code**. The `pnpm spec-check`
script runs three checks:

1. `spec-mtime` — `SPEC.md` is newer than `src/`.
2. `spec-coverage` — every export in `src/index.ts` is documented
   in `SPEC.md`. Every top-level symbol in `src/` is documented.
3. `spec-drift` — every test in the `## 6. Test matrix` exists in
   code. Every test in code is in the matrix.

If any of these fail, the PR is blocked.

## The 9-section template (mandatory)

```
# Spec: <package-name>

## 1. Purpose
One paragraph, no marketing.

## 2. Public surface
Every TypeScript symbol exported from src/index.ts, in fenced
code blocks, with the full signature. (The spec-coverage tool
greps for these and fails if any export is missing.)

## 3. Behaviour contracts
One subsection per exported function/class/method. For each:
- Inputs and outputs, with edge cases.
- Error model.
- Ordering guarantees (for async / I/O code).

## 4. Invariants
Numbered list of must-hold properties. Reference by number
("Inv. 4") in tests and PRs.

## 5. Error model
What throws, what returns, what shapes (for Zod schemas).

## 6. Test matrix
Markdown table with two columns:
| Test name | Covers contract |
The "Test name" is the full describe > describe > it path.
The "Covers contract" references §3 subsections or §4 invariants.

## 7. Non-goals
Explicit list of things this package does NOT do. Not a TODO
list — a fence.

## 8. Dependencies
Every runtime and dev dependency. For internal packages, also
state which other @adt-bench/* packages this one imports.
```

The order is fixed. Renumbering the sections will break the
spec-check tools.

## The three gates in detail

### 1. `spec-mtime` (cheap, runs first)

> If you changed the code, you also changed the spec.

For every package, `specs/SPEC.md`'s `mtime` MUST be at least as
new as the newest `src/**` file. If you edit `result.ts` but not
`SPEC.md`, this fails.

Use `touch specs/SPEC.md` after updating the spec.

**This catches the most common drift:** I changed the code but
forgot the spec.

### 2. `spec-coverage` (medium, runs second)

> Every export is documented. Every internal symbol is too.

The tool extracts every `export const|let|var|function|class|interface|async function`
from `src/index.ts` and asserts that the symbol name appears (as
a whole word) somewhere in `specs/SPEC.md`. It also walks
every top-level `const|let|var|function|class|interface|type`
declaration in any `src/**` file and asserts the same.

**This catches:**

- A new export that wasn't added to the spec.
- A renamed function that the spec still calls by its old name.
- An internal helper that the spec doesn't mention.

**It does NOT catch:**

- A function whose body has changed but whose signature is the
  same.
- A function that throws when the spec says it can't throw.
  (This is the "behavior contracts" gap; covered by tests.)

### 3. `spec-drift` (slowest, runs last)

> Every test in the spec exists in code. Every test in code is in
the spec.

The tool parses the `## 6. Test matrix` section and asserts:

- Every row in the matrix has a matching `it('...')` or
  `test('...')` declaration in some `*.spec.ts` in the same
  package.
- Every `it('...')` or `test('...')` declaration in any
  `*.spec.ts` file in the same package has a matching row in
  the matrix.

The test name in the matrix is the **full path** through any
nested `describe` blocks, joined with ` > `. Example:
> `evaluate (rule-based) > fails when self-reported status is "fail"`

The tool extracts the test name from the source file (correctly
handling nested describes, regex literals, URL strings, and
escaped quotes) and matches it against the matrix row.

**This catches:**

- A test in the spec that was deleted from code.
- A test in code that was added without updating the matrix.
- Test name drift between the spec and code.

## How to add a new package

1. Write `specs/SPEC.md` first, following the 9-section template.
2. Then write `src/index.ts`, `src/<module>.ts`, etc.
3. Then write `src/<module>.spec.ts` with the test names from §6.
4. `pnpm spec-check` must pass before opening the PR.

If you write code first, the spec-check will fail and you'll
have to backtrack. Write the spec first.

## How to change a package

1. **Edit the spec first.** Update §3 (behaviour contracts) and
   §6 (test matrix) if you're changing observable behavior.
2. **Edit `src/`** to match. Reference the spec change in the
   commit body.
3. `pnpm spec-check` must pass.

If the change is purely internal (no exported signature change,
no behavior change, no test name change), a `touch
specs/SPEC.md` is enough to satisfy `spec-mtime`.

## Common failures and fixes

| Symptom | Fix |
|---|---|
| `spec-mtime` says SPEC.md is older than src/ | `touch specs/SPEC.md` after updating it. |
| `spec-coverage` says an export is undocumented | Add the symbol to §2 with its full signature. |
| `spec-coverage` says an internal symbol is undocumented | Add the symbol to §3 in the relevant behavior contract. |
| `spec-drift` says a test is in spec but not code | Either add the test, or remove the row from the matrix. |
| `spec-drift` says a test is in code but not spec | Add the row to §6 with the full path. |
| `spec-drift` says a test name has a quote mismatch | The matrix row must match the source `it('...')` verbatim. Including the quotes. |

## What the spec does NOT cover (manual checks)

- **Behavioral contracts** — the spec describes the contract in
  prose; nothing automatically checks that `run()` does what §3
  says. Unit tests are the proof. The test matrix in §6 maps
  tests to contract sections; if a contract is not in the
  matrix, it's untested.
- **Throw / non-throw behavior** — the spec says "MUST NOT throw"
  in many places. The only enforcement is a unit test that
  asserts no throw.
- **Performance** — not covered.
- **Visual output** — `printConsoleReport`'s exact format is in
  the code, not the spec. The spec only says "prints a tabular
  report" and the test asserts the right number of lines.

When in doubt: add a test. The spec is a contract; the test is
the proof the contract is honored.

## Why SDD is worth the friction

- **Refactoring is safe.** If a refactor breaks a contract, the
  spec-drift check fails. If a refactor changes a behavior, the
  tests fail. The spec is a safety net.
- **Onboarding is fast.** A new contributor reads the spec, then
  the code, and knows exactly what the code is supposed to do.
  Without the spec, they have to reverse-engineer the contract
  from the code.
- **AI agents are productive.** A coding agent pointed at a
  spec can implement a package end-to-end without asking
  questions. A spec-less agent has to guess, and guesses are
  expensive to roll back.

The friction is real: writing the spec is more work than
skipping it. The pay-off is also real: you can trust the code
to do what the spec says, and you can change the code without
breaking the contract.

See also: `principles/SKILL.md` §1 ("Spec-driven development is
the load-bearing rule").
