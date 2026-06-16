#!/usr/bin/env node
/**
 * tools/spec-mtime.mjs
 *
 * Original spec-check behavior: for each package, ensure that
 * `specs/SPEC.md` was modified at-or-after the most recent change
 * under `src/`. This is the cheap, fast gate. The deeper checks
 * (spec-coverage, spec-drift) live in their own tools.
 *
 * Exits 0 if every package's SPEC.md is fresh, 1 otherwise.
 */
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..');
const packagesDir = join(root, 'packages');

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

async function newestMtime(files) {
  let max = 0;
  for (const f of files) {
    try {
      const s = await stat(f);
      if (s.mtimeMs > max) max = s.mtimeMs;
    } catch {}
  }
  return max;
}

let failed = false;
const entries = await readdir(packagesDir, { withFileTypes: true });
for (const e of entries) {
  if (!e.isDirectory()) continue;
  const pkg = join(packagesDir, e.name);
  const specPath = join(pkg, 'specs', 'SPEC.md');
  try {
    await stat(specPath);
  } catch {
    console.error(`  FAIL: ${e.name}/specs/SPEC.md is missing`);
    failed = true;
    continue;
  }
  const srcFiles = [];
  try {
    for await (const f of walk(join(pkg, 'src'))) srcFiles.push(f);
  } catch {
    // no src/ directory; data-only package
    console.log(`  OK:   ${e.name}/specs/SPEC.md (no src/ tree)`);
    continue;
  }
  if (srcFiles.length === 0) {
    console.log(`  OK:   ${e.name}/specs/SPEC.md (no src/ tree)`);
    continue;
  }
  const newestSrc = await newestMtime(srcFiles);
  const specStat = await stat(specPath);
  if (specStat.mtimeMs < newestSrc) {
    console.error(
      `  FAIL: ${e.name}/specs/SPEC.md is older than the newest src/ change. ` +
        `Run \`touch ${specPath}\` after updating the spec.`
    );
    failed = true;
  } else {
    console.log(`  OK:   ${e.name}/specs/SPEC.md`);
  }
}

if (failed) {
  console.error('\nspec-mtime: FAIL');
  process.exit(1);
}
console.log('\nspec-mtime: PASS');
process.exit(0);
