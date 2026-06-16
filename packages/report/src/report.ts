import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentRunResult } from '../../agent-runner/src/index.js';
import type { Evaluation } from '../../evaluator/src/index.js';

export interface RunRecord {
  run: AgentRunResult;
  evaluation: Evaluation;
  runDir: string;
}

export interface Summary {
  generated_at: string;
  total_runs: number;
  pass: number;
  fail: number;
  partial: number;
  by_scenario: Array<{
    scenario_id: string;
    runs: number;
    pass: number;
    fail: number;
    partial: number;
  }>;
  runs: RunRecord[];
}

export async function loadRunDir(runDir: string): Promise<RunRecord | null> {
  const resultPath = join(runDir, 'result.json');
  const evalPath = join(runDir, 'evaluation.json');
  try {
    const [resultRaw, evalRaw] = await Promise.all([
      readFile(resultPath, 'utf8'),
      readFile(evalPath, 'utf8'),
    ]);
    return {
      run: JSON.parse(resultRaw) as AgentRunResult,
      evaluation: JSON.parse(evalRaw) as Evaluation,
      runDir,
    };
  } catch {
    return null;
  }
}

export async function loadResultsDir(dir: string): Promise<RunRecord[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: RunRecord[] = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      const rec = await loadRunDir(join(dir, e.name));
      if (rec) out.push(rec);
    }
  }
  return out;
}

export function summarize(records: RunRecord[]): Summary {
  const byScenario = new Map<string, { runs: number; pass: number; fail: number; partial: number }>();
  let pass = 0;
  let fail = 0;
  let partial = 0;
  for (const r of records) {
    if (r.evaluation.overall === 'pass') pass++;
    else if (r.evaluation.overall === 'fail') fail++;
    else partial++;
    const sid = r.run.scenario_id;
    const s = byScenario.get(sid) ?? { runs: 0, pass: 0, fail: 0, partial: 0 };
    s.runs++;
    if (r.evaluation.overall === 'pass') s.pass++;
    else if (r.evaluation.overall === 'fail') s.fail++;
    else s.partial++;
    byScenario.set(sid, s);
  }
  return {
    generated_at: new Date().toISOString(),
    total_runs: records.length,
    pass,
    fail,
    partial,
    by_scenario: Array.from(byScenario.entries()).map(([scenario_id, v]) => ({
      scenario_id,
      ...v,
    })),
    runs: records,
  };
}

export async function writeSummary(dir: string, summary: Summary): Promise<string> {
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'summary.json');
  await writeFile(path, JSON.stringify(summary, null, 2));
  return path;
}

export function printConsoleReport(summary: Summary): void {
  const lines: string[] = [];
  lines.push('');
  lines.push('=== ADT-Bench summary ===');
  lines.push(`Generated: ${summary.generated_at}`);
  lines.push(`Total runs: ${summary.total_runs}  (pass=${summary.pass}, partial=${summary.partial}, fail=${summary.fail})`);
  lines.push('');
  if (summary.by_scenario.length === 0) {
    lines.push('No scenarios recorded.');
  } else {
    lines.push('By scenario:');
    for (const s of summary.by_scenario) {
      lines.push(
        `  - ${s.scenario_id}: ${s.runs} runs  (pass=${s.pass}, partial=${s.partial}, fail=${s.fail})`
      );
    }
  }
  lines.push('');
  lines.push('Per run:');
  for (const r of summary.runs) {
    const dur = (r.run.duration_ms / 1000).toFixed(1);
    lines.push(
      `  [${r.evaluation.overall.toUpperCase().padEnd(7)}] ${r.run.scenario_id}  agent=${r.run.agent_id}  duration=${dur}s  run_id=${r.run.run_id}`
    );
    for (const rule of r.evaluation.perRule) {
      const v = rule.verdict.toUpperCase().padEnd(4);
      lines.push(`        ${v} ${rule.rule}: ${rule.detail}`);
    }
  }
  lines.push('');
  console.log(lines.join('\n'));
}
