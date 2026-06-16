#!/usr/bin/env node
/**
 * tools/apply-views.mjs
 *
 * Reads tools/project-views.json and (when GitHub ships a
 * createProjectV2View mutation) applies each view to the project.
 *
 * Today (mid-2026) the GitHub Projects v2 GraphQL API does not expose
 * view creation. This script will print a dry-run report of what it
 * would do, and exit 0. When the API is available, the `apply()`
 * function will be filled in.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = join(here, 'project-views.json');
const cfg = JSON.parse(await readFile(configPath, 'utf8'));

console.log(`Project: ${cfg.project.url}`);
console.log(`Fields:  ${Object.keys(cfg.fields).join(', ')}`);
console.log(`Views:   ${cfg.views.length}`);
console.log('');

for (const view of cfg.views) {
  const filter = view.filter ?? '';
  const groupBy = (view.group_by ?? []).join(', ') || '(none)';
  const sortBy = (view.sort_by ?? [])
    .map((s) => `${s.field} ${s.direction}`)
    .join(', ') || '(none)';
  const fields = (view.visible_fields ?? []).join(', ');
  console.log(`• ${view.name} [${view.layout}]`);
  console.log(`    filter:   ${filter || '(none)'}`);
  console.log(`    group by: ${groupBy}`);
  console.log(`    sort by:  ${sortBy}`);
  console.log(`    fields:   ${fields}`);
  console.log('');
}

console.log('NOTE: GitHub Projects v2 GraphQL API does not yet expose view creation.');
console.log('      See docs/project-views.md for the manual setup recipe.');
console.log('      This script is a dry-run only; it does not call the API.');

// Placeholder for future implementation:
// async function apply() {
//   for (const view of cfg.views) {
//     await graphql(`mutation { createProjectV2View(input: {...}) { view { id } } }`);
//   }
// }
