#!/usr/bin/env node
/**
 * tools/spec-check.mjs
 *
 * The umbrella spec-enforcement gate. Runs three checks:
 *   1. spec-mtime   (this file's old behavior) — SPEC.md is newer
 *                   than src/.
 *   2. spec-coverage — every export in src/index.ts is documented in
 *                     specs/SPEC.md, and every top-level symbol in
 *                     src/ is documented.
 *   3. spec-drift   — every test in §6 of SPEC.md exists in code, and
 *                     every test in code is in the matrix.
 *
 * Exits 0 on success, 1 on any failure.
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..');

function run(name) {
  console.log(`\n=== ${name} ===`);
  try {
    execFileSync('node', [join(root, `tools/${name}.mjs`)], {
      stdio: 'inherit',
      cwd: root,
    });
    return true;
  } catch (e) {
    return false;
  }
}

const results = {
  'spec-mtime':    run('spec-mtime'),
  'spec-coverage': run('spec-coverage'),
  'spec-drift':    run('spec-drift'),
};

console.log('\n=== summary ===');
for (const [name, ok] of Object.entries(results)) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${name}`);
}
if (Object.values(results).every((x) => x)) {
  console.log('\nspec-check: PASS');
  process.exit(0);
} else {
  console.error('\nspec-check: FAIL');
  process.exit(1);
}
