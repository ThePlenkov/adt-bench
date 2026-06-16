import { mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  ScenarioResultSchema,
  type AgentPrepareInput,
  type AgentRunInput,
  type AgentRunResult,
  type AgentRunner,
  type ScenarioResult,
} from '../../agent-runner/src/index.js';
import { parseFinalText } from '../../evaluator/src/index.js';

export interface MastraCodeRunnerOptions {
  /** Path to a directory of SKILL.md files to copy into the workspace. */
  skillsSourceDir: string;
  /** Path to an MCP profile JSON file to copy to the workspace. */
  mcpProfilePath: string;
  /**
   * If true (default for CI / smoke), use a deterministic simulated agent
   * instead of spawning a real mastracode process. The simulated agent
   * produces a `ScenarioResult` derived from the prompt + scenario.
   */
  simulated?: boolean;
}

/**
 * MastraCodeRunner implements `AgentRunner`. In v1 it operates in two modes:
 *   - simulated=true (default for `bench:smoke`): produces a deterministic
 *     result derived from the prompt content. No process is spawned.
 *   - simulated=false: would shell out to the `mastracode` binary. Reserved
 *     for v1.1+ — not exercised in the smoke run.
 */
export class MastraCodeRunner implements AgentRunner {
  readonly id = 'mastracode';
  private readonly opts: MastraCodeRunnerOptions;

  constructor(opts: MastraCodeRunnerOptions) {
    this.opts = opts;
  }

  async prepare(input: AgentPrepareInput): Promise<void> {
    await mkdir(input.agentConfigDir, { recursive: true });
    await mkdir(input.skillsDir, { recursive: true });

    // Copy skills
    await cp(this.opts.skillsSourceDir, input.skillsDir, { recursive: true });

    // Copy MCP profile
    const mcpContent = await readFile(this.opts.mcpProfilePath, 'utf8');
    await writeFile(input.mcpConfigPath, mcpContent, 'utf8');

    // Generate AGENTS.md (instructions)
    if (input.instructionsPath) {
      await mkdir(dirname(input.instructionsPath), { recursive: true });
      await writeFile(
        input.instructionsPath,
        AGENTS_MD_TEMPLATE,
        'utf8'
      );
    }
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const startedAt = new Date().toISOString();
    const t0 = performance.now();
    if (this.opts.simulated !== false) {
      const result = simulatedAgentRun(input);
      const finishedAt = new Date().toISOString();
      const parsed = parseFinalText(result).result;
      return {
        run_id: input.runId,
        agent_id: this.id,
        scenario_id: input.scenarioId,
        status: parsed && parsed.errors.length === 0 ? 'pass' : 'partial',
        started_at: startedAt,
        finished_at: finishedAt,
        duration_ms: Math.round(performance.now() - t0),
        final_text: result,
        parsed_result: parsed,
        errors: [],
      };
    }
    // Real mastracode spawning is v1.1+. For now, fall back to simulated.
    const result = simulatedAgentRun(input);
    const finishedAt = new Date().toISOString();
    const parsed = parseFinalText(result).result;
    return {
      run_id: input.runId,
      agent_id: this.id,
      scenario_id: input.scenarioId,
      status: 'error',
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: Math.round(performance.now() - t0),
      final_text: result,
      parsed_result: parsed,
      errors: ['real-mastracode-spawning-not-implemented-in-v1'],
    };
  }
}

const AGENTS_MD_TEMPLATE = `# ADT-Bench agent instructions

You are running inside the adt-bench harness.

1. Read the scenario prompt carefully.
2. Use the configured MCP tools to accomplish the task.
3. Run any available validation (activation, syntax check, unit tests).
4. Return ONLY a single JSON object matching the scenario result schema.

Do not include prose, code fences, or extra commentary in your final answer.
`;

/**
 * Simulated agent — deterministic, no LLM call. Derives a ScenarioResult
 * from the input:
 *   - For `create-class-hello`: produces a successful class creation result.
 *   - For `read-class-source`: produces a "read existing class" result.
 *   - Otherwise: generic pass.
 * This exists so the entire pipeline (prompt -> run -> result -> evaluator ->
 * report) can be exercised end-to-end in CI without an LLM dependency.
 */
export function simulatedAgentRun(input: AgentRunInput): string {
  const scenarioId = input.scenarioId;
  let result: ScenarioResult;
  if (scenarioId === 'read-class-source') {
    result = {
      scenario_id: scenarioId,
      status: 'pass',
      summary:
        'Read existing class ZCL_BENCH_FIXTURE_OK via the search and source tools.',
      evidence: [
        {
          kind: 'object',
          value: '/sap/bc/adt/oo/classes/zcl_bench_fixture_ok',
        },
      ],
      changed_objects: ['ZCL_BENCH_FIXTURE_OK'],
      errors: [],
    };
  } else {
    result = {
      scenario_id: scenarioId,
      status: 'pass',
      summary: `Simulated agent completed scenario ${scenarioId}: created class ZCL_BENCH_HELLO with method SAY_HELLO returning 'Hello, world!'.`,
      evidence: [
        { kind: 'object', value: `/sap/bc/adt/oo/classes/zcl_bench_hello` },
        { kind: 'activation', value: 'activated' },
      ],
      changed_objects: ['ZCL_BENCH_HELLO'],
      errors: [],
    };
  }
  ScenarioResultSchema.parse(result);
  return JSON.stringify(result, null, 2);
}
