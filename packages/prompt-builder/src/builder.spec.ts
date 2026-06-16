import { describe, it, expect } from 'vitest';
import { buildPrompt } from './builder.js';
import { parseScenarioMarkdown } from '../../scenarios/src/index.js';

const SAMPLE = `---
id: create-class-hello
title: Create ABAP hello class
difficulty: easy
required_mcp_servers:
  - abap
required_skills:
  - abap-workflow
  - abap-test-loop
timeout_ms: 300000
tags:
  - smoke
evaluator:
  type: rule
  rules:
    - has-class
    - has-method
---

## Goal

Create class ZCL_BENCH_HELLO with method SAY_HELLO returning 'Hello, world!'.

## Acceptance criteria

- Class ZCL_BENCH_HELLO exists.
- Method SAY_HELLO exists.
- The class is activated.
`;

describe('buildPrompt', () => {
  it('includes all required sections in order', () => {
    const scenario = parseScenarioMarkdown(SAMPLE, 'inmem');
    const prompt = buildPrompt({ scenario });
    const expectedSections = [
      '# Role',
      '# Available context',
      '# Tool policy',
      '# Validation policy',
      '# Result policy',
      '# Scenario',
      '# Result schema',
    ];
    let cursor = 0;
    for (const s of expectedSections) {
      const idx = prompt.indexOf(s, cursor);
      expect(idx, `section ${s} not found after cursor ${cursor}`).toBeGreaterThanOrEqual(0);
      cursor = idx + s.length;
    }
  });

  it('inlines extra skill fragments', () => {
    const scenario = parseScenarioMarkdown(SAMPLE, 'inmem');
    const prompt = buildPrompt({
      scenario,
      extraSkillFragments: ['# abap-workflow\nUse lock -> write -> unlock -> activate.'],
    });
    expect(prompt).toContain('abap-workflow');
    expect(prompt).toContain('lock -> write -> unlock -> activate');
  });

  it('renders the scenario body verbatim', () => {
    const scenario = parseScenarioMarkdown(SAMPLE, 'inmem');
    const prompt = buildPrompt({ scenario });
    expect(prompt).toContain('## Goal');
    expect(prompt).toContain("returning 'Hello, world!'");
    expect(prompt).toContain('## Acceptance criteria');
  });

  it('includes the declared MCP servers and skills', () => {
    const scenario = parseScenarioMarkdown(SAMPLE, 'inmem');
    const prompt = buildPrompt({ scenario });
    expect(prompt).toContain('Required MCP servers: abap');
    expect(prompt).toContain('Required skills: abap-workflow, abap-test-loop');
  });
});
