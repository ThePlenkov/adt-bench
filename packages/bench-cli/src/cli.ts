import { ulid } from 'ulid';
import { mkdir, writeFile, readdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadScenariosFromDir, findScenario } from '../../scenarios/src/index.js';
import { buildPrompt } from '../../prompt-builder/src/index.js';
import { evaluate } from '../../evaluator/src/index.js';
import { summarize, writeSummary, printConsoleReport, loadResultsDir } from '../../report/src/index.js';
import { MastraCodeRunner } from '../../runner-mastracode/src/index.js';
import type { ParsedScenario } from '../../scenarios/src/index.js';
import type { AgentRunResult, ScenarioResult } from '../../agent-runner/src/index.js';

export interface RunOptions {
  scenarioId: string;
  workspaceRoot: string;
  resultsDir: string;
  skillsSourceDir: string;
  mcpProfilePath: string;
  /** Extra skill fragments (markdown content) to inject into the prompt. */
  extraSkillFragments?: string[];
  /** If provided, also boot the mock ADT server and include its URL in the prompt. */
  mockAdtUrl?: string;
  /** If provided, run with this many trials. */
  trials?: number;
}

export interface RunOutcome {
  runId: string;
  scenario: ParsedScenario;
  result: AgentRunResult;
  evaluation: ReturnType<typeof evaluate>;
  transcript: string;
}

/**
 * Resolve the list of skill fragments to inject into the prompt.
 * Reads every `.md` file under `skillsSourceDir` (one level deep).
 */
export async function loadSkillFragments(skillsSourceDir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(skillsSourceDir, { withFileTypes: true });
  } catch {
    // skillsSourceDir does not exist; treat as empty.
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      // Skip subdirectories whose name starts with `_` (e.g. `_meta`).
      // These contain skills for humans / coding agents, not for the
      // ABAP agent at run time.
      if (e.name.startsWith('_')) continue;
      const skillFile = join(skillsSourceDir, e.name, 'SKILL.md');
      try {
        out.push(await readFile(skillFile, 'utf8'));
      } catch {
        // no SKILL.md in this dir; skip
      }
    }
  }
  return out;
}

/**
 * Execute one full run: load scenario, build prompt, run agent, persist
 * result, evaluate, and return the outcome.
 */
export async function executeRun(opts: RunOptions): Promise<RunOutcome> {
  const scenarios = await loadScenariosFromDir(resolve(opts.workspaceRoot, 'scenarios'));
  const scenario = findScenario(scenarios, opts.scenarioId);
  if (!scenario) {
    throw new Error(`scenario not found: ${opts.scenarioId}`);
  }
  const skillFragments =
    opts.extraSkillFragments ?? (await loadSkillFragments(opts.skillsSourceDir));

  const runId = ulid();
  const runDir = join(opts.resultsDir, runId);
  await mkdir(runDir, { recursive: true });

  // Persistent agent workspace
  const workspace = join(runDir, 'agent-workspace');
  const agentDir = join(workspace, '.mastracode');
  const agentSkillsDir = join(agentDir, 'skills');
  const mcpTarget = join(agentDir, 'mcp.json');
  const agPath = join(agentDir, 'AGENTS.md');

  const runner = new MastraCodeRunner({
    skillsSourceDir: opts.skillsSourceDir,
    mcpProfilePath: opts.mcpProfilePath,
    simulated: true,
  });
  await runner.prepare({
    workspaceDir: workspace,
    agentConfigDir: agentDir,
    skillsDir: agentSkillsDir,
    mcpConfigPath: mcpTarget,
    instructionsPath: agPath,
  });

  // Build the prompt. We optionally inject the mock ADT URL so the agent
  // knows where to point.
  const promptSections: string[] = [];
  if (opts.mockAdtUrl) {
    promptSections.push(`# Mock ADT server\n\nURL: ${opts.mockAdtUrl}\n`);
  }
  promptSections.push(
    buildPrompt({
      scenario,
      extraSkillFragments: skillFragments,
    })
  );
  const prompt = promptSections.join('\n');

  // Run
  const result = await runner.run({
    runId,
    scenarioId: scenario.frontmatter.id,
    prompt,
    timeoutMs: scenario.frontmatter.timeout_ms,
  });

  // Persist result + evaluation + transcript
  await writeFile(join(runDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
  await writeFile(join(runDir, 'prompt.txt'), prompt, 'utf8');
  const evaluation = evaluate({ scenario, run: result });
  await writeFile(
    join(runDir, 'evaluation.json'),
    JSON.stringify(evaluation, null, 2),
    'utf8'
  );
  // Transcript is a minimal JSON Lines of (user prompt, assistant final text).
  const transcript = [
    JSON.stringify({ type: 'user', content: prompt, timestamp: result.started_at }),
    JSON.stringify({
      type: 'assistant',
      content: result.final_text,
      timestamp: result.finished_at,
    }),
  ].join('\n');
  await writeFile(join(runDir, 'transcript.jsonl'), transcript, 'utf8');

  return {
    runId,
    scenario,
    result,
    evaluation,
    transcript,
  };
}

/**
 * Run the v1 smoke path: a single scenario against the simulated agent and
 * the mock ADT server, persisted to `results/`, with a console summary.
 */
export async function runSmoke(opts: {
  workspaceRoot: string;
  scenarioId?: string;
}): Promise<{ overall: 'pass' | 'fail' | 'partial'; runId: string; runDir: string }> {
  const { startMockAdt } = await import('../../mock-adt-server/src/index.js');

  const mock = await startMockAdt({
    initialClasses: [
      {
        name: 'ZCL_BENCH_FIXTURE_OK',
        source:
          'CLASS zcl_bench_fixture_ok DEFINITION PUBLIC.\n  PUBLIC SECTION.\nENDCLASS.\nCLASS zcl_bench_fixture_ok IMPLEMENTATION.\nENDCLASS.',
        activated: true,
      },
    ],
  });

  try {
    const scenarioId = opts.scenarioId ?? 'create-class-hello';
    const outcome = await executeRun({
      scenarioId,
      workspaceRoot: opts.workspaceRoot,
      resultsDir: resolve(opts.workspaceRoot, 'results'),
      skillsSourceDir: resolve(opts.workspaceRoot, 'packages/skills/.agents/skills'),
      mcpProfilePath: resolve(
        opts.workspaceRoot,
        'agents/mastracode/profiles/mock-arc-1.mcp.json'
      ),
      mockAdtUrl: mock.url,
    });

    const summary = await writeAndPrintSummary(opts.workspaceRoot);
    const runRecord = summary.runs.find((r) => r.run.run_id === outcome.runId)!;
    return {
      overall: runRecord.evaluation.overall,
      runId: outcome.runId,
      runDir: resolve(opts.workspaceRoot, 'results', outcome.runId),
    };
  } finally {
    await mock.close();
  }
}

export async function writeAndPrintSummary(workspaceRoot: string): Promise<ReturnType<typeof summarize>> {
  const resultsDir = resolve(workspaceRoot, 'results');
  const records = await loadResultsDir(resultsDir);
  const s = summarize(records);
  await writeSummary(resultsDir, s);
  printConsoleReport(s);
  return s;
}

/**
 * Clean stale run directories from `results/` (except `.gitkeep`).
 */
export async function cleanResultsDir(resultsDir: string): Promise<void> {
  const entries = await readdir(resultsDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      await rm(join(resultsDir, e.name), { recursive: true, force: true });
    }
  }
}

export type { ScenarioResult };
