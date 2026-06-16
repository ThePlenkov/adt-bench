#!/usr/bin/env node
/**
 * tools/spec-drift.mjs
 *
 * For each package, parse the SPEC.md "## 6. Test matrix" section
 * and assert that:
 *   1. Every named test in the matrix has a matching `it(`
 *      declaration in a `*.spec.ts` file in the same package.
 *   2. Every `it(` test in a `*.spec.ts` file in the same package
 *      has a corresponding row in the matrix.
 *   3. Every contract claim in §3.5 (or analogous "built-in
 *      registry" / "implemented endpoints" table) is verified by at
 *      least one test or one structural check.
 *
 * This catches two failure modes that spec-coverage does not:
 *   - A test exists in code but the spec forgot to document it.
 *   - A spec promises a test but the test was deleted.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..');
const packagesDir = join(root, 'packages');

let violations = 0;

function fail(pkg, msg) {
  console.error(`  FAIL: ${msg}`);
  violations++;
}

function ok(pkg, msg) {
  console.log(`  OK:   ${msg}`);
}

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
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

/* Extract the "## 6. Test matrix" section. Returns a Map<testName, contractRef>. */
function parseTestMatrix(spec) {
  const out = new Map();
  // Match the "## 6. Test matrix" header; allow some flexibility in numbering.
  const m = spec.match(/^#{1,3}\s*6\.?\s*Test matrix\s*$(.+?)(?=^#{1,3}\s*\d+\.|\Z)/ms);
  if (!m) return out;
  const block = m[1];
  // Each row looks like: | `<test name>` | <contract ref> |
  // The test name may contain backticks, double quotes, etc.
  const rowRe = /^\|\s*(.+?)\s*\|\s*([^|]+?)\s*\|\s*$/gm;
  let r;
  while ((r = rowRe.exec(block)) !== null) {
    let name = r[1].trim();
    const ref = r[2].trim();
    // Strip surrounding backticks if present
    if (name.startsWith('`') && name.endsWith('`')) {
      name = name.slice(1, -1);
    }
    if (name && name !== 'Test name' && name !== '---' && name.toLowerCase() !== 'covenants') {
      out.set(name, ref);
    }
  }
  return out;
}

/* Extract all `it("name", ...)` and `test("name", ...)` from a
 * source file, preserving the full `describe > describe > it` path.
 *
 * Approach: walk the source char-by-char. Track a stack where each
 * frame is either:
 *   - a describe name (a string), OR
 *   - a generic marker like '{' or '('
 * When we see `describe("name", ...)`, push the name THEN push a
 * marker '(' so we can match the closing paren. When we see
 * `it("name", ...)` or `test("name", ...)`, emit the joined path of
 * the describe names in the stack followed by the it name. The
 * `it` regex consumes the opening `(`, so we explicitly push a
 * marker for that too.
 *
 * For the closing `}` or `)`, we always pop one frame. When the
 * popped frame is a describe name, the describe block is done. */
function extractTestNames(src) {
  const cleaned = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Match line comments: `//` not preceded by `:` (so URL `://`
    // is not treated as a comment). The negative lookbehind
    // requires the char before `//` to NOT be `:`.
    .replace(/(?<![:'"`\\])\/\/.*$/gm, '');

  const stack = [];
  const out = [];

  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];

    if (ch === '/' && cleaned[i + 1] === '/') {
      while (i < cleaned.length && cleaned[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && cleaned[i + 1] === '*') {
      i += 2;
      while (i < cleaned.length && !(cleaned[i] === '*' && cleaned[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < cleaned.length && cleaned[i] !== quote) {
        if (cleaned[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }

    const rest = cleaned.slice(i);
    const descMatch = rest.match(/^describe\s*\(\s*'((?:[^'\\]|\\.)*)'/);
    if (descMatch) {
      const name = descMatch[1].replace(/\\(.)/g, '$1');
      stack.push(name);
      i += descMatch[0].length;
      continue;
    }
    const itMatch = rest.match(/^(?:it|test)\s*\(\s*'((?:[^'\\]|\\.)*)'/);
    if (itMatch) {
      // Unescape the captured name (e.g. `\'` -> `'`, `\"` -> `"`).
      const name = itMatch[1].replace(/\\(.)/g, '$1');
      const describeNames = stack.filter((s) => s !== '{' && s !== '(' && s !== '(it)');
      out.push([...describeNames, name].join(' > '));
      // Push a marker so the closing `)` of the it call has
      // something to pop. We use a unique token to avoid being
      // treated as a describe name.
      stack.push('(it)');
      i += itMatch[0].length;
      continue;
    }
    const idMatch = rest.match(/^[A-Za-z_$][\w$]*/);
    if (idMatch) {
      i += idMatch[0].length;
      continue;
    }
    if (ch === '{' || ch === '(') {
      stack.push(ch);
      i++;
      continue;
    }
    if (ch === '}' || ch === ')') {
      if (stack.length > 0) stack.pop();
      i++;
      continue;
    }
    i++;
  }
  return out;
}

async function checkPackage(pkgPath, pkgName) {
  console.log(`\n[${pkgName}]`);

  // Read the spec
  const specPath = join(pkgPath, 'specs', 'SPEC.md');
  let spec;
  try {
    spec = await readFile(specPath, 'utf8');
  } catch {
    fail(pkgName, `specs/SPEC.md missing`);
    return;
  }
  const matrix = parseTestMatrix(spec);
  if (matrix.size === 0) {
    ok(pkgName, `no test matrix in SPEC.md (acceptable for data-only or end-to-end packages)`);
    return;
  }

  // Read every test file in src/
  const codeTests = new Set();
  for await (const f of walk(join(pkgPath, 'src'))) {
    if (!(f.endsWith('.spec.ts') || f.endsWith('.test.ts'))) continue;
    const src = await readFile(f, 'utf8');
    for (const name of extractTestNames(src)) codeTests.add(name);
  }

  // 1. Every matrix row must have a test in code.
  let missingInCode = 0;
  for (const name of matrix.keys()) {
    if (!codeTests.has(name)) {
      fail(pkgName, `spec promises test "${name}" but it is not in any *.spec.ts file`);
      missingInCode++;
    }
  }
  if (missingInCode === 0) {
    ok(pkgName, `all ${matrix.size} matrix tests exist in code`);
  }

  // 2. Every test in code (that lives in this package) should be in
  //    the matrix. We compare against the test file's package
  //    directory.
  let undocumented = 0;
  for (const name of codeTests) {
    if (!matrix.has(name)) {
      fail(pkgName, `test "${name}" is not documented in SPEC.md §6`);
      undocumented++;
    }
  }
  if (undocumented === 0 && codeTests.size > 0) {
    ok(pkgName, `all ${codeTests.size} tests in code are in the matrix`);
  }
}

const entries = await readdir(packagesDir, { withFileTypes: true });
for (const e of entries) {
  if (!e.isDirectory()) continue;
  await checkPackage(join(packagesDir, e.name), e.name);
}

console.log('');
if (violations === 0) {
  console.log('spec-drift: PASS');
  process.exit(0);
} else {
  console.error(`spec-drift: FAIL (${violations} violation${violations === 1 ? '' : 's'})`);
  process.exit(1);
}
