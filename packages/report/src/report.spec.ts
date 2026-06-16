import { describe, it, expect } from 'vitest';
import { summarize } from './report.js';
import type { RunRecord } from './report.js';
import type { AgentRunResult } from '../../agent-runner/src/index.js';
import type { Evaluation } from '../../evaluator/src/index.js';

function mkRecord(
  scenarioId: string,
  overall: 'pass' | 'fail' | 'partial',
  runId = 'r1'
): RunRecord {
  const run: AgentRunResult = {
    run_id: runId,
    agent_id: 'test',
    scenario_id: scenarioId,
    status: overall,
    started_at: '2026-06-16T10:00:00.000Z',
    finished_at: '2026-06-16T10:00:01.000Z',
    duration_ms: 1000,
    final_text: '{}',
    parsed_result: null,
    errors: [],
  };
  const evaluation: Evaluation = {
    overall,
    perRule: [],
    parsedResult: null,
  };
  return { run, evaluation, runDir: `/tmp/${runId}` };
}

describe('summarize', () => {
  it('aggregates counts across runs and scenarios', () => {
    const s = summarize([
      mkRecord('s1', 'pass', 'r1'),
      mkRecord('s1', 'pass', 'r2'),
      mkRecord('s1', 'fail', 'r3'),
      mkRecord('s2', 'partial', 'r4'),
    ]);
    expect(s.total_runs).toBe(4);
    expect(s.pass).toBe(2);
    expect(s.fail).toBe(1);
    expect(s.partial).toBe(1);
    const s1 = s.by_scenario.find((x) => x.scenario_id === 's1')!;
    expect(s1.runs).toBe(3);
    expect(s1.pass).toBe(2);
    expect(s1.fail).toBe(1);
    const s2 = s.by_scenario.find((x) => x.scenario_id === 's2')!;
    expect(s2.partial).toBe(1);
  });

  it('handles empty input', () => {
    const s = summarize([]);
    expect(s.total_runs).toBe(0);
    expect(s.by_scenario).toEqual([]);
  });
});
