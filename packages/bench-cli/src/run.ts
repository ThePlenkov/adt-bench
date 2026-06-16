#!/usr/bin/env tsx
import { executeRun, writeAndPrintSummary } from './cli.js';
import { resolve } from 'node:path';
import { startMockAdt } from '../../mock-adt-server/src/index.js';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1) return process.argv[i + 1];
  return fallback;
}

(async () => {
  const scenarioId = arg('scenario') ?? 'create-class-hello';
  const useMock = arg('mock', '1') !== '0';
  const mock = useMock ? await startMockAdt({}) : null;
  try {
    const outcome = await executeRun({
      scenarioId,
      workspaceRoot,
      resultsDir: resolve(workspaceRoot, 'results'),
      skillsSourceDir: resolve(workspaceRoot, 'packages/skills/.agents/skills'),
      mcpProfilePath: resolve(
        workspaceRoot,
        'agents/mastracode/profiles/mock-arc-1.mcp.json'
      ),
      ...(mock ? { mockAdtUrl: mock.url } : {}),
    });
    console.log(`run_id=${outcome.runId} status=${outcome.result.status}`);
    await writeAndPrintSummary(workspaceRoot);
  } finally {
    if (mock) await mock.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
