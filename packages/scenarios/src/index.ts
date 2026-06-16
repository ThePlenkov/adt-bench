import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseScenarioMarkdown, type ParsedScenario } from './loader.js';

export type { ParsedScenario, ScenarioFrontmatter } from './loader.js';
export {
  ScenarioFrontmatterSchema,
  extractBody,
  parseScenarioMarkdown,
  parseSimpleYaml,
} from './loader.js';

export async function loadScenario(path: string): Promise<ParsedScenario> {
  const raw = await readFile(path, 'utf8');
  return parseScenarioMarkdown(raw, path);
}

export async function loadScenariosFromDir(dir: string): Promise<ParsedScenario[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: ParsedScenario[] = [];
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.md')) {
      out.push(await loadScenario(join(dir, e.name)));
    }
  }
  return out;
}

export function findScenario(
  scenarios: ParsedScenario[],
  id: string
): ParsedScenario | undefined {
  return scenarios.find((s) => s.frontmatter.id === id);
}
