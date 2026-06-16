# Result schema

See `packages/agent-runner/src/result.ts` for the canonical Zod schemas. This
document summarises the shapes for non-TypeScript readers.

## ScenarioResult (agent -> harness)

```ts
{
  scenario_id: string;            // e.g. "create-class-hello"
  status: "pass" | "fail" | "partial";
  summary: string;                // 1-3 sentences
  evidence: Array<{
    kind: "object" | "source" | "activation" | "syntax_check" |
          "test" | "diagnostic" | "tool_result" | "other";
    value: string;
  }>;
  changed_objects: string[];      // ABAP object names
  errors: string[];               // human-readable error messages
}
```

The harness parses this from the agent's `final_text` (tolerating code
fences and surrounding prose).

## AgentRunResult (harness -> report)

```ts
{
  run_id: string;                 // ULID
  agent_id: string;               // e.g. "mastracode"
  scenario_id: string;
  status: "pass" | "fail" | "partial" | "timeout" | "error";
  started_at: string;             // ISO 8601
  finished_at: string;            // ISO 8601
  duration_ms: number;            // integer
  final_text: string;             // raw agent output
  parsed_result: ScenarioResult | null;
  transcript_path?: string;
  metrics?: { /* see below */ };
  errors: string[];
}
```

## OptionalRunMetrics

All fields are optional. Different agent runtimes expose different telemetry.

```ts
{
  tool_calls?: { total?: number; by_tool?: Record<string, number> };
  tokens?: { input?: number; output?: number; cache_read?: number; cache_write?: number };
  cost_usd?: number;
  steps?: number;
  mcp_servers?: string[];
  adt_http_calls?: { total?: number; by_endpoint?: Record<string, number> };
}
```

`adt_http_calls` is only present when the run hits the mock ADT server (it
reads from `/__mock/stats` at end-of-run).

## Evaluation (evaluator -> report)

```ts
{
  overall: "pass" | "fail" | "partial";
  perRule: Array<{
    rule: string;                 // rule name from scenario
    verdict: "pass" | "fail" | "skip";
    detail: string;               // human-readable
  }>;
  parsedResult: ScenarioResult | null;
  parseError?: string;
  selfReportedStatus?: "pass" | "partial" | "fail";
}
```

## Aggregation

See `packages/report/src/report.ts`. Counts are summed per `scenario_id` and
overall. `partial` is recorded as a separate count from `pass` and `fail`.
