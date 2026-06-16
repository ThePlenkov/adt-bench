# Backlog

Tracked in the org-level [GitHub Project board](https://github.com/orgs/abapify/projects/4) and as [GitHub Issues](https://github.com/abapify/adt-bench/issues) (label `v1.1`, `v1.2`, or `v2`).

For the 6 recommended project-board views (Roadmap, Active work, Next up, v1.1 epic tree, All work by owner, Backlog unmilestoned) and their filters, see [docs/project-views.md](project-views.md). The machine-readable spec is in [tools/project-views.json](../tools/project-views.json).

## Dependency graph (v1.1 epic)

```
#1  real mastracode runner
   ├── blocks #2  runner-claude-code
   │              └── blocks #3  runner-codex + runner-gemini-cli
   ├── blocks #7  multi-trial reporting
   │              └── blocks #14 static results website
   │                             └── blocks #15 connector dashboards (v2)
   ├── blocks #8  agent-based + hybrid evaluators
   └── blocks #9  live BTP integration

#5  mock ADT extensions (transportchecks, AUnit, checkruns, BDEF)
   ├── blocks #4  additional scenarios (4 new)
   └── blocks #12 mock ADT coverage docs + 501 responses

#11 verify all pnpm scripts work end-to-end
   └── blocks #6  GitHub Actions CI workflow
```

## Issues (v1.1)

- **#1** real mastracode runner with telemetry
- **#2** add runner-claude-code package
- **#3** add runner-codex and runner-gemini-cli packages
- **#4** add 4 additional scenarios (syntax-error-recovery, abapunit-failure-diagnose, create-transport-zpkg, bdef-scaffold-rap)
- **#5** extend mock ADT server (transportchecks, AUnit, checkruns, BDEF)
- **#7** multi-trial reporting (--trials N, --parallel K)
- **#8** agent-based + hybrid evaluators
- **#9** live BTP integration via BTP_SERVICE_KEY
- **#12** document mock ADT coverage and return 501 for unmocked endpoints

## Issues (infra)

- **#6** add GitHub Actions CI workflow
- **#10** swap scenarios YAML parser for a real library
- **#11** verify all pnpm scripts work end-to-end
- **#13** evaluator plugin API for custom rules
- **#16** link README to issue backlog, generate docs/backlog.md (this file)

## Issues (v2)

- **#14** static results website (Astro)
- **#15** connector comparison dashboards

## Out of scope (recorded as non-goals)

- Building ABAP ADT connectors in this repo
- Wrapping `adt-cli`, `arc-1`, or `vscode_abap_remote_fs` as benchmark-owned tool packages
- Comparing connector internals as the primary benchmark objective
- A live website in v1
- Upstream PRs to external projects (separate, explicit process)
