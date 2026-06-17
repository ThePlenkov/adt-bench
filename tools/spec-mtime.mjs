#!/usr/bin/env node
/**
 * tools/spec-mtime.mjs
 *
 * For each package, ensure that `specs/SPEC.md` reflects (or
 * post-dates) the most recent change under `src/`. This is the
 * cheap, fast gate. The deeper checks (spec-coverage, spec-drift)
 * live in their own tools.
 *
 * Implementation note (issue #11): the original implementation
 * compared filesystem mtimes, which produced false-positive failures
 * on fresh checkouts / git worktrees where wall-clock mtimes do not
 * match commit-time ordering (files checked out in the same second
 * can have mtimes that are sub-second newer than the spec they
 * post-date). The spec's intent — documented in docs/spec-style.md
 * §"1. spec-mtime" — is "if you changed the code, you also changed
 * the spec", which is a property of the git history, not the
 * filesystem.
 *
 * We therefore compute each file's effective mtime as
 *     max(git_commit_time_seconds, filesystem_mtime_seconds)
 * so that:
 *   - committed files are compared by their commit time (deterministic
 *     across checkouts, CI, containers), and
 *   - uncommitted/dirty files (filesystem_mtime > commit_time) keep
 *     behaving like the old filesystem-mtime gate.
 *
 * Exits 0 if every package's SPEC.md is fresh, 1 otherwise.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);

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

/* Return a Map<repo-relative-path, latest-commit-time-seconds> for
 * every path under <dir> that has been touched by some commit
 * reachable from HEAD. We do this in a single `git log` invocation
 * with a sentinel prefix on the commit-time line so the parser is
 * robust to paths that happen to be all digits. */
async function commitTimesUnder(dir) {
  const out = new Map();
  let res;
  try {
    res = await execFileP(
      'git',
      [
        'log',
        '--pretty=format:COMMIT_TIME %ct',
        '--name-only',
        '--no-renames',
        '-z',
        'HEAD',
        '--',
        dir,
      ],
      { cwd: root }
    );
  } catch {
    return out;
  }
  // With `-z`, `git log` emits records separated by NUL. Each
  // record is: "COMMIT_TIME <digits>\n<path1>\0<path2>\0...\0".
  // The first token after a NUL boundary is the commit-time header
  // (ending in a newline), followed by one or more NUL-terminated
  // path tokens, until the next "COMMIT_TIME ..." header.
  const tokens = res.stdout.split('\0');
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (!tok) { i++; continue; }
    const m = tok.match(/^COMMIT_TIME (\d+)\n([\s\S]*)$/);
    if (!m) { i++; continue; }
    const ct = Number(m[1]);
    const inline = m[2].trim();
    if (inline) {
      out.set(inline, Math.max(out.get(inline) ?? 0, ct));
    }
    i++;
    while (i < tokens.length && tokens[i] && !tokens[i].startsWith('COMMIT_TIME ')) {
      const pth = tokens[i].trim();
      if (pth) out.set(pth, Math.max(out.get(pth) ?? 0, ct));
      i++;
    }
  }
  return out;
}

function rel(file) {
  return file.startsWith(root + '/') ? file.slice(root.length + 1) : file;
}

async function effectiveMtime(file, commitTimes) {
  let fsMtime = 0;
  try {
    const s = await stat(file);
    fsMtime = Math.floor(s.mtimeMs / 1000);
  } catch {}
  const ct = commitTimes.get(rel(file));
  if (ct === undefined) return fsMtime; // never committed: filesystem only
  return Math.max(ct, fsMtime);          // dirty file: filesystem mtime wins
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
  const srcDir = join(pkg, 'src');
  const srcFiles = [];
  try {
    for await (const f of walk(srcDir)) srcFiles.push(f);
  } catch {
    // no src/ directory; data-only package
    console.log(`  OK:   ${e.name}/specs/SPEC.md (no src/ tree)`);
    continue;
  }
  if (srcFiles.length === 0) {
    console.log(`  OK:   ${e.name}/specs/SPEC.md (no src/ tree)`);
    continue;
  }

  // Single git log per package covering both src/ and specs/.
  const combined = await commitTimesUnder(pkg);

  let newestSrc = 0;
  for (const f of srcFiles) {
    const t = await effectiveMtime(f, combined);
    if (t > newestSrc) newestSrc = t;
  }
  const specT = await effectiveMtime(specPath, combined);
  if (specT < newestSrc) {
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
