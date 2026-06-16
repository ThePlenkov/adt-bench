import { z } from 'zod';

export const ScenarioFrontmatterSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'id must be kebab-case'),
    title: z.string().min(1),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    required_mcp_servers: z.array(z.string().min(1)).default([]),
    required_skills: z.array(z.string().min(1)).default([]),
    timeout_ms: z.number().int().positive().default(300_000),
    tags: z.array(z.string()).default([]),
    evaluator: z
      .object({
        type: z.enum(['rule', 'agent', 'hybrid']).default('rule'),
        rules: z.array(z.string()).default([]),
      })
      .default({ type: 'rule', rules: [] }),
  })
  .strict();
export type ScenarioFrontmatter = z.infer<typeof ScenarioFrontmatterSchema>;

export interface ParsedScenario {
  frontmatter: ScenarioFrontmatter;
  body: string;
  sourcePath: string;
}

/**
 * Extract the body of a markdown file after the YAML frontmatter block.
 * Frontmatter is delimited by `---` on its own line at the start and end.
 */
export function extractBody(raw: string): { yaml: string; body: string } {
  const text = raw.replace(/^\uFEFF/, '');
  if (!text.startsWith('---')) {
    return { yaml: '', body: text };
  }
  const end = text.indexOf('\n---', 3);
  if (end === -1) {
    return { yaml: '', body: text };
  }
  const yaml = text.slice(3, end).replace(/^\n/, '').replace(/\r$/, '');
  const body = text
    .slice(end + 4)
    .replace(/^\n/, '')
    .replace(/^---\s*$/, '')
    .replace(/^\n+/, '');
  return { yaml, body };
}

/**
 * Tiny YAML subset parser sufficient for the flat frontmatter we use.
 * Supports: scalars, inline arrays, block lists with `- ` items, and nested
 * objects with indentation tracking.
 */
export function parseSimpleYaml(input: string): unknown {
  const lines = input.split(/\r?\n/);
  let i = 0;

  function blank(s: string): boolean {
    return /^\s*$/.test(s);
  }

  function indentOf(s: string): number {
    const m = s.match(/^(\s*)/);
    return m ? m[1]!.length : 0;
  }

  function trimBlank(): void {
    while (i < lines.length && blank(lines[i]!)) i++;
  }

  function parseScalar(raw: string): unknown {
    const v = raw.trim();
    if (v === '' || v === '~' || v === 'null') return null;
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
    if (v.startsWith('[') && v.endsWith(']')) {
      const inner = v.slice(1, -1).trim();
      if (inner === '') return [];
      return inner.split(',').map((s) => parseScalar(s.trim()));
    }
    if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
    if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
    return v;
  }

  function parseBlock(minIndent: number): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    trimBlank();
    while (i < lines.length) {
      const line = lines[i]!;
      if (blank(line)) {
        i++;
        continue;
      }
      const ind = indentOf(line);
      if (ind < minIndent) break;
      if (ind !== minIndent) break;
      const m = line.slice(minIndent).match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
      if (!m) {
        i++;
        continue;
      }
      const key = m[1]!;
      const rest = m[2] ?? '';
      i++;
      if (rest === '' || rest === '|' || rest === '>') {
        trimBlank();
        if (i >= lines.length) {
          obj[key] = null;
          continue;
        }
        const next = lines[i]!;
        const nextInd = indentOf(next);
        if (nextInd <= minIndent) {
          obj[key] = null;
          continue;
        }
        const trimmed = next.slice(nextInd);
        if (trimmed.startsWith('- ')) {
          obj[key] = parseList(nextInd);
        } else {
          obj[key] = parseBlock(nextInd);
        }
      } else {
        obj[key] = parseScalar(rest);
      }
      trimBlank();
    }
    return obj;
  }

  function parseList(baseIndent: number): unknown[] {
    const arr: unknown[] = [];
    while (i < lines.length) {
      const line = lines[i]!;
      if (blank(line)) {
        i++;
        continue;
      }
      const ind = indentOf(line);
      if (ind < baseIndent) break;
      if (ind !== baseIndent) break;
      const m = line.slice(baseIndent).match(/^-\s+(.*)$/);
      if (!m) break;
      const rest = m[1] ?? '';
      i++;
      if (rest === '' || rest === '|' || rest === '>') {
        trimBlank();
        if (i < lines.length) {
          const next = lines[i]!;
          const nextInd = indentOf(next);
          if (nextInd > baseIndent) {
            const trimmed = next.slice(nextInd);
            if (trimmed.startsWith('- ')) {
              arr.push(parseList(nextInd));
            } else {
              arr.push(parseBlock(nextInd));
            }
            continue;
          }
        }
        arr.push(null);
        continue;
      }
      arr.push(parseScalar(rest));
      trimBlank();
    }
    return arr;
  }

  return parseBlock(0);
}

export function parseScenarioMarkdown(raw: string, sourcePath: string): ParsedScenario {
  const { yaml, body } = extractBody(raw);
  const parsed = yaml.trim() === '' ? {} : parseSimpleYaml(yaml);
  const frontmatter = ScenarioFrontmatterSchema.parse(parsed);
  return { frontmatter, body, sourcePath };
}
