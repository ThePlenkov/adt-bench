import { describe, it, expect } from 'vitest';
import { parseFinalText, evaluate } from './evaluator.js';
import { parseScenarioMarkdown } from '../../scenarios/src/index.js';
import type { AgentRunResult } from '../../agent-runner/src/index.js';

function makeRun(text: string): AgentRunResult {
  return {
    run_id: 'r1',
    agent_id: 'test',
    scenario_id: 'create-class-hello',
    status: 'pass',
    started_at: '2026-06-16T10:00:00.000Z',
    finished_at: '2026-06-16T10:00:01.000Z',
    duration_ms: 1000,
    final_text: text,
    parsed_result: null,
    errors: [],
  };
}

describe('parseFinalText', () => {
  it('parses bare JSON', () => {
    const text = JSON.stringify({
      scenario_id: 'create-class-hello',
      status: 'pass',
      summary: 'done',
      changed_objects: ['ZCL_BENCH_HELLO'],
      evidence: [{ kind: 'activation', value: 'ok' }],
      errors: [],
    });
    const { result, error } = parseFinalText(text);
    expect(error).toBeUndefined();
    expect(result?.scenario_id).toBe('create-class-hello');
  });

  it('strips code fences', () => {
    const inner = JSON.stringify({
      scenario_id: 'create-class-hello',
      status: 'pass',
      summary: 'done',
    });
    const { result } = parseFinalText('```json\n' + inner + '\n```');
    expect(result?.scenario_id).toBe('create-class-hello');
  });

  it('extracts JSON embedded in prose', () => {
    const inner = JSON.stringify({
      scenario_id: 'create-class-hello',
      status: 'pass',
      summary: 'done',
    });
    const { result } = parseFinalText('Here is the result:\n' + inner + '\nDone.');
    expect(result?.scenario_id).toBe('create-class-hello');
  });

  it('returns null on invalid JSON', () => {
    const { result, error } = parseFinalText('not json');
    expect(result).toBeNull();
    expect(error).toBeDefined();
  });

  it('returns null on structurally wrong JSON', () => {
    const { result, error } = parseFinalText(JSON.stringify({ wrong: 'shape' }));
    expect(result).toBeNull();
    expect(error).toBeDefined();
  });
});

describe('evaluate (rule-based)', () => {
  const SCENARIO = parseScenarioMarkdown(
    `---
id: create-class-hello
title: t
difficulty: easy
required_mcp_servers:
  - abap
required_skills:
  - abap-workflow
evaluator:
  type: rule
  rules:
    - has-class
    - activation
    - status-pass
    - no-fatal-errors
---
body`,
    'inmem'
  );

  it('passes when all rules pass', () => {
    const run = makeRun(
      JSON.stringify({
        scenario_id: 'create-class-hello',
        status: 'pass',
        summary: 'Created ZCL_BENCH_HELLO with SAY_HELLO method.',
        changed_objects: ['ZCL_BENCH_HELLO'],
        evidence: [{ kind: 'activation', value: 'activated' }],
        errors: [],
      })
    );
    const e = evaluate({ scenario: SCENARIO, run });
    expect(e.overall).toBe('pass');
    expect(e.perRule.every((r) => r.verdict === 'pass')).toBe(true);
  });

  it('fails when a key changed_object is missing', () => {
    const run = makeRun(
      JSON.stringify({
        scenario_id: 'create-class-hello',
        status: 'pass',
        summary: 'created',
        changed_objects: ['ZCL_OTHER'],
        evidence: [{ kind: 'activation', value: 'ok' }],
        errors: [],
      })
    );
    const e = evaluate({ scenario: SCENARIO, run });
    expect(e.overall).toBe('fail');
    const classRule = e.perRule.find((r) => r.rule === 'has-class');
    expect(classRule?.verdict).toBe('fail');
  });

  it('fails when self-reported status is "fail"', () => {
    const run = makeRun(
      JSON.stringify({
        scenario_id: 'create-class-hello',
        status: 'fail',
        summary: 'broken',
        changed_objects: ['ZCL_BENCH_HELLO'],
        evidence: [{ kind: 'activation', value: 'ok' }],
        errors: [],
      })
    );
    const e = evaluate({ scenario: SCENARIO, run });
    expect(e.overall).toBe('fail');
    const statusRule = e.perRule.find((r) => r.rule === 'status-pass');
    expect(statusRule?.verdict).toBe('fail');
  });

  it('treats unparseable final_text as overall fail', () => {
    const run = makeRun('totally not json');
    const e = evaluate({ scenario: SCENARIO, run });
    expect(e.overall).toBe('fail');
    expect(e.parsedResult).toBeNull();
    expect(e.parseError).toBeDefined();
  });
});
