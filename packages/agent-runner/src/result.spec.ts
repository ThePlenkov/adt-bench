import { describe, it, expect } from 'vitest';
import { AgentRunResultSchema, ScenarioResultSchema, OptionalRunMetricsSchema } from './result.js';

const validScenarioResult = {
  scenario_id: 'create-class-hello',
  status: 'pass' as const,
  summary: 'Created ZCL_BENCH_HELLO with method SAY_HELLO returning Hello, world!.',
  evidence: [
    { kind: 'object' as const, value: '/sap/bc/adt/oo/classes/zcl_bench_hello' },
    { kind: 'activation' as const, value: 'activated' },
  ],
  changed_objects: ['ZCL_BENCH_HELLO'],
  errors: [],
};

const validResult = {
  run_id: '01JABCDEF1234567890ABCDEF',
  agent_id: 'mastracode',
  scenario_id: 'create-class-hello',
  status: 'pass' as const,
  started_at: '2026-06-16T10:00:00.000Z',
  finished_at: '2026-06-16T10:00:30.000Z',
  duration_ms: 30000,
  final_text: '{"scenario_id":"create-class-hello","status":"pass","summary":"ok"}',
  parsed_result: validScenarioResult,
  transcript_path: 'results/01JABCDEF1234567890ABCDEF/transcript.json',
  errors: [],
};

describe('ScenarioResultSchema', () => {
  it('accepts a valid scenario result', () => {
    const r = ScenarioResultSchema.parse(validScenarioResult);
    expect(r.scenario_id).toBe('create-class-hello');
    expect(r.evidence).toHaveLength(2);
  });

  it('rejects unknown status', () => {
    expect(() =>
      ScenarioResultSchema.parse({ ...validScenarioResult, status: 'unknown' })
    ).toThrow();
  });

  it('rejects unknown evidence kind', () => {
    expect(() =>
      ScenarioResultSchema.parse({
        ...validScenarioResult,
        evidence: [{ kind: 'mermaid', value: 'x' }],
      })
    ).toThrow();
  });

  it('defaults arrays to empty when omitted', () => {
    const r = ScenarioResultSchema.parse({
      scenario_id: 'x',
      status: 'pass',
      summary: 's',
    });
    expect(r.evidence).toEqual([]);
    expect(r.changed_objects).toEqual([]);
    expect(r.errors).toEqual([]);
  });
});

describe('OptionalRunMetricsSchema', () => {
  it('accepts an empty object', () => {
    expect(OptionalRunMetricsSchema.parse({})).toEqual({});
  });

  it('accepts all optional fields', () => {
    const m = OptionalRunMetricsSchema.parse({
      tool_calls: { total: 5, by_tool: { search: 1, create: 4 } },
      tokens: { input: 1000, output: 500 },
      cost_usd: 0.012,
      steps: 8,
      mcp_servers: ['arc-1'],
      adt_http_calls: { total: 22, by_endpoint: { '/sap/bc/adt/discovery': 1 } },
    });
    expect(m.cost_usd).toBe(0.012);
  });

  it('rejects unknown keys (strict mode)', () => {
    expect(() => OptionalRunMetricsSchema.parse({ unknown: true })).toThrow();
  });
});

describe('AgentRunResultSchema', () => {
  it('accepts a valid run result', () => {
    const r = AgentRunResultSchema.parse(validResult);
    expect(r.agent_id).toBe('mastracode');
    expect(r.parsed_result?.scenario_id).toBe('create-class-hello');
  });

  it('accepts a minimal run result with null parsed_result', () => {
    const r = AgentRunResultSchema.parse({ ...validResult, parsed_result: null });
    expect(r.parsed_result).toBeNull();
  });

  it('rejects invalid status', () => {
    expect(() => AgentRunResultSchema.parse({ ...validResult, status: 'cancelled' })).toThrow();
  });

  it('rejects missing required datetime fields', () => {
    const { started_at: _s, ...rest } = validResult;
    void _s;
    expect(() => AgentRunResultSchema.parse(rest)).toThrow();
  });
});
