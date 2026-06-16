import { z } from 'zod';

export const EvidenceSchema = z.object({
  kind: z.enum([
    'object',
    'source',
    'activation',
    'syntax_check',
    'test',
    'diagnostic',
    'tool_result',
    'other',
  ]),
  value: z.string().min(1),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ScenarioResultSchema = z.object({
  scenario_id: z.string().min(1),
  status: z.enum(['pass', 'fail', 'partial']),
  summary: z.string().min(1),
  evidence: z.array(EvidenceSchema).default([]),
  changed_objects: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
});
export type ScenarioResult = z.infer<typeof ScenarioResultSchema>;

export const OptionalRunMetricsSchema = z
  .object({
    tool_calls: z
      .object({
        total: z.number().int().nonnegative().optional(),
        by_tool: z.record(z.string(), z.number().int().nonnegative()).optional(),
      })
      .optional(),
    tokens: z
      .object({
        input: z.number().int().nonnegative().optional(),
        output: z.number().int().nonnegative().optional(),
        cache_read: z.number().int().nonnegative().optional(),
        cache_write: z.number().int().nonnegative().optional(),
      })
      .optional(),
    cost_usd: z.number().nonnegative().optional(),
    steps: z.number().int().nonnegative().optional(),
    mcp_servers: z.array(z.string()).optional(),
    adt_http_calls: z
      .object({
        total: z.number().int().nonnegative().optional(),
        by_endpoint: z.record(z.string(), z.number().int().nonnegative()).optional(),
      })
      .optional(),
  })
  .strict();
export type OptionalRunMetrics = z.infer<typeof OptionalRunMetricsSchema>;

export const AgentRunResultSchema = z
  .object({
    run_id: z.string().min(1),
    agent_id: z.string().min(1),
    scenario_id: z.string().min(1),
    status: z.enum(['pass', 'fail', 'partial', 'timeout', 'error']),
    started_at: z.string().datetime(),
    finished_at: z.string().datetime(),
    duration_ms: z.number().int().nonnegative(),
    final_text: z.string(),
    parsed_result: ScenarioResultSchema.nullable(),
    transcript_path: z.string().optional(),
    metrics: OptionalRunMetricsSchema.optional(),
    errors: z.array(z.string()).default([]),
  })
  .strict();
export type AgentRunResult = z.infer<typeof AgentRunResultSchema>;
