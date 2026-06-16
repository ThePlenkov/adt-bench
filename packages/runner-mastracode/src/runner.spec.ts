import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MastraCodeRunner, simulatedAgentRun } from './runner.js';
import { parseFinalText } from '../../evaluator/src/index.js';

let workspace: string;
let skillsDir: string;
let mcpPath: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'adt-bench-runner-'));
  skillsDir = await mkdtemp(join(tmpdir(), 'adt-bench-skills-'));
  await import('node:fs/promises').then((fs) =>
    fs.writeFile(join(skillsDir, 'SKILL.md'), '# test skill\nbody', 'utf8')
  );
  mcpPath = join(workspace, 'mcp.json');
  await import('node:fs/promises').then((fs) =>
    fs.writeFile(mcpPath, JSON.stringify({ mcpServers: { abap: { command: 'echo' } } }), 'utf8')
  );
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
  await rm(skillsDir, { recursive: true, force: true });
});

describe('MastraCodeRunner.prepare', () => {
  it('copies skills and MCP profile into the workspace', async () => {
    const runner = new MastraCodeRunner({
      skillsSourceDir: skillsDir,
      mcpProfilePath: mcpPath,
    });
    const ws = await mkdtemp(join(tmpdir(), 'adt-bench-prep-'));
    try {
      const agentDir = join(ws, '.mastracode');
      const skillsTarget = join(agentDir, 'skills');
      const mcpTarget = join(agentDir, 'mcp.json');
      const agPath = join(agentDir, 'AGENTS.md');
      await runner.prepare({
        workspaceDir: ws,
        agentConfigDir: agentDir,
        skillsDir: skillsTarget,
        mcpConfigPath: mcpTarget,
        instructionsPath: agPath,
      });
      const skills = await readFile(join(skillsTarget, 'SKILL.md'), 'utf8');
      expect(skills).toContain('test skill');
      const mcp = JSON.parse(await readFile(mcpTarget, 'utf8'));
      expect(mcp.mcpServers.abap.command).toBe('echo');
      const ag = await readFile(agPath, 'utf8');
      expect(ag).toContain('ADT-Bench');
    } finally {
      await rm(ws, { recursive: true, force: true });
    }
  });
});

describe('MastraCodeRunner.run (simulated)', () => {
  it('returns a valid AgentRunResult', async () => {
    const runner = new MastraCodeRunner({
      skillsSourceDir: skillsDir,
      mcpProfilePath: mcpPath,
      simulated: true,
    });
    const res = await runner.run({
      runId: 'r1',
      scenarioId: 'create-class-hello',
      prompt: 'do the thing',
      timeoutMs: 60_000,
    });
    expect(res.run_id).toBe('r1');
    expect(res.scenario_id).toBe('create-class-hello');
    expect(res.status).toBe('pass');
    expect(res.parsed_result).not.toBeNull();
    expect(res.parsed_result?.changed_objects).toContain('ZCL_BENCH_HELLO');
  });

  it('produces JSON that round-trips through parseFinalText', async () => {
    const text = simulatedAgentRun({
      runId: 'r1',
      scenarioId: 'create-class-hello',
      prompt: 'p',
      timeoutMs: 60000,
    });
    const { result } = parseFinalText(text);
    expect(result?.scenario_id).toBe('create-class-hello');
    expect(result?.status).toBe('pass');
  });

  it('simulated read-class-source run references the fixture class', () => {
    const text = simulatedAgentRun({
      runId: 'r2',
      scenarioId: 'read-class-source',
      prompt: 'p',
      timeoutMs: 60000,
    });
    const { result } = parseFinalText(text);
    expect(result?.changed_objects).toContain('ZCL_BENCH_FIXTURE_OK');
  });
});
