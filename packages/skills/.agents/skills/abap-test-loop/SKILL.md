---
name: abap-test-loop
description: Test-driven loop for ABAP — inspect, change, check syntax, run unit tests, diagnose, fix.
---

# abap-test-loop

When the task is "make tests pass" or "produce a working implementation", iterate through this loop until the AUnit result is clean:

1. **Inspect** — read the current source of the class and its test include.
2. **Plan a minimal change** — do not refactor; only change what the task requires.
3. **Apply the change** — lock -> PUT source -> unlock.
4. **Syntax check** — POST the class URI to the check endpoint; read the `checkMessages` body for errors.
5. **Run ABAP Unit** — POST the run config to `/sap/bc/adt/abapunit/testruns`; poll the run-status URI; fetch the JUnit-formatted result.
6. **Diagnose** — parse the JUnit XML. For each failing test, look at the failure message and the method that threw.
7. **Fix** — return to step 2.

Cap your iterations. If you have not produced a green result after a reasonable number of iterations (typically 3–5), report `status: "partial"` with a summary of what was tried and what still failed. Do not loop forever.
