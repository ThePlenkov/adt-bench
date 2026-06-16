#!/usr/bin/env tsx
import { writeAndPrintSummary } from './cli.js';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

(async () => {
  await writeAndPrintSummary(workspaceRoot);
})();
