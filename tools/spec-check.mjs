#!/usr/bin/env node
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;

/**
 * spec-check: for each package, ensure that `specs/SPEC.md` exists and was
 * last modified at-or-after the most recent change under `src/`. If a SPEC is
 * older than its `src/`, the contributor must update the spec.
 */
async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
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
    const s = await stat(f);
    if (s.mtimeMs > max) max = s.mtimeMs;
  }
  return max;
}

const packagesDir = join(root, 'packages');
const entries = await readdir(packagesDir, { withFileTypes: true });
let failed = false;
for (const e of entries) {
  if (!e.isDirectory()) continue;
  const pkg = join(packagesDir, e.name);
  const specPath = join(pkg, 'specs', 'SPEC.md');
  try {
    await stat(specPath);
  } catch {
    console.error(`FAIL: ${e.name}/specs/SPEC.md is missing`);
    failed = true;
    continue;
  }
  const srcFiles = [];
  try {
    for await (const f of walk(join(pkg, 'src'))) {
      srcFiles.push(f);
    }
  } catch {
    // no src/ directory; treat as a data-only package
  }
  if (srcFiles.length === 0) {
    console.log(`OK:   ${e.name}/specs/SPEC.md (no src/ tree)`);
    continue;
  }
  const newestSrc = await newestMtime(srcFiles);
  const specStat = await stat(specPath);
  if (specStat.mtimeMs < newestSrc) {
    console.error(
      `FAIL: ${e.name}/specs/SPEC.md is older than the newest src/ change. ` +
        `Run \`touch ${specPath}\` after updating the spec.`
    );
    failed = true;
  } else {
    console.log(`OK:   ${e.name}/specs/SPEC.md`);
  }
}
if (failed) {
  console.error('\nspec-check: some specs are stale. Update them and re-run.');
  process.exit(1);
}
console.log('\nspec-check: all specs are fresh.');
