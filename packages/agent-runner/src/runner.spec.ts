import { describe, it, expect } from 'vitest';
import {
  AgentPrepareInputSchema,
  AgentRunInputSchema,
  type AgentRunner,
} from './runner.js';
import type { AgentRunResult } from './result.js';

describe('AgentPrepareInputSchema', () => {
  it('accepts required fields', () => {
    const p = AgentPrepareInputSchema.parse({
      workspaceDir: '/tmp/r',
      agentConfigDir: '/tmp/r/.mastracode',
      skillsDir: '/tmp/r/.mastracode/skills',
      mcpConfigPath: '/tmp/r/.mastracode/mcp.json',
    });
    expect(p.instructionsPath).toBeUndefined();
  });

  it('rejects missing workspaceDir', () => {
    expect(() =>
      AgentPrepareInputSchema.parse({
        agentConfigDir: '/x',
        skillsDir: '/x',
        mcpConfigPath: '/x',
      })
    ).toThrow();
  });
});

describe('AgentRunInputSchema', () => {
  it('accepts required fields', () => {
    const r = AgentRunInputSchema.parse({
      runId: 'r1',
      scenarioId: 'create-class-hello',
      prompt: 'do the thing',
      timeoutMs: 300000,
    });
    expect(r.env).toBeUndefined();
  });

  it('rejects non-positive timeout', () => {
    expect(() =>
      AgentRunInputSchema.parse({
        runId: 'r1',
        scenarioId: 's',
        prompt: 'p',
        timeoutMs: 0,
      })
    ).toThrow();
  });
});

describe('AgentRunner contract (compile-time)', () => {
  it('can be implemented with the required shape', () => {
    const runner: AgentRunner = {
      id: 'test-runner',
      async prepare() {
        // noop
      },
      async run(): Promise<AgentRunResult> {
        return {
          run_id: 'r1',
          agent_id: 'test-runner',
          scenario_id: 's',
          status: 'pass',
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          duration_ms: 0,
          final_text: '{}',
          parsed_result: null,
          errors: [],
        };
      },
    };
    expect(runner.id).toBe('test-runner');
  });
});
