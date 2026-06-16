import { describe, it, expect } from 'vitest';
import {
  parseScenarioMarkdown,
  extractBody,
  parseSimpleYaml,
  ScenarioFrontmatterSchema,
} from './loader.js';

describe('extractBody', () => {
  it('splits yaml and body', () => {
    const raw = `---
id: foo
title: Foo
---
## Body
Hello.`;
    const { yaml, body } = extractBody(raw);
    expect(yaml).toContain('id: foo');
    expect(body.trim()).toBe('## Body\nHello.');
  });

  it('returns body equal to raw when no frontmatter', () => {
    const raw = 'just body';
    const { yaml, body } = extractBody(raw);
    expect(yaml).toBe('');
    expect(body).toBe('just body');
  });
});

describe('parseSimpleYaml', () => {
  it('parses scalars', () => {
    expect(parseSimpleYaml('a: 1\nb: hello\nc: true\nd: null')).toEqual({
      a: 1,
      b: 'hello',
      c: true,
      d: null,
    });
  });

  it('parses inline arrays', () => {
    expect(parseSimpleYaml('tags: [a, b, c]')).toEqual({ tags: ['a', 'b', 'c'] });
  });

  it('parses block lists', () => {
    const yaml = `list:
  - a
  - b
  - c`;
    expect(parseSimpleYaml(yaml)).toEqual({ list: ['a', 'b', 'c'] });
  });

  it('parses nested objects with list-valued fields', () => {
    const yaml = `evaluator:
  type: rule
  rules:
    - foo
    - bar`;
    const r = parseSimpleYaml(yaml) as Record<string, unknown>;
    expect(r.evaluator).toEqual({ type: 'rule', rules: ['foo', 'bar'] });
  });
});

describe('ScenarioFrontmatterSchema', () => {
  it('rejects non-kebab id', () => {
    expect(() =>
      ScenarioFrontmatterSchema.parse({ id: 'BadId', title: 't', difficulty: 'easy' })
    ).toThrow();
  });

  it('applies defaults', () => {
    const fm = ScenarioFrontmatterSchema.parse({
      id: 'create-class',
      title: 't',
      difficulty: 'easy',
    });
    expect(fm.required_mcp_servers).toEqual([]);
    expect(fm.required_skills).toEqual([]);
    expect(fm.timeout_ms).toBe(300_000);
    expect(fm.evaluator.type).toBe('rule');
  });
});

describe('parseScenarioMarkdown', () => {
  it('parses a complete scenario', () => {
    const raw = `---
id: create-class-hello
title: Create ABAP hello class
difficulty: easy
required_mcp_servers:
  - abap
required_skills:
  - abap-workflow
timeout_ms: 300000
---

## Goal
Create class ZCL_BENCH_HELLO.
`;
    const s = parseScenarioMarkdown(raw, '/scenarios/create-class-hello.md');
    expect(s.frontmatter.id).toBe('create-class-hello');
    expect(s.frontmatter.required_mcp_servers).toEqual(['abap']);
    expect(s.frontmatter.timeout_ms).toBe(300_000);
    expect(s.body).toContain('## Goal');
    expect(s.sourcePath).toBe('/scenarios/create-class-hello.md');
  });
});
