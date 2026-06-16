#!/usr/bin/env tsx
import { runSmoke } from './cli.js';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

(async () => {
  try {
    const out = await runSmoke({ workspaceRoot });
    if (out.overall === 'pass') {
      console.log(`\nbench:smoke OK (run_id=${out.runId}, dir=${out.runDir})\n`);
      process.exit(0);
    } else {
      console.error(`\nbench:smoke FAILED (overall=${out.overall}, run_id=${out.runId})\n`);
      process.exit(1);
    }
  } catch (e) {
    console.error('bench:smoke error:', e);
    process.exit(2);
  }
})();
