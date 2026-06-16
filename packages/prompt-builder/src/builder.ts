import type { ParsedScenario } from '../../scenarios/src/index.js';
import { ScenarioResultSchema } from '../../agent-runner/src/index.js';

export interface BuildPromptOptions {
  scenario: ParsedScenario;
  extraSkillFragments?: string[];
  resultSchemaJson?: string;
}

export function buildPrompt(opts: BuildPromptOptions): string {
  const { scenario, extraSkillFragments = [], resultSchemaJson } = opts;
  const fm = scenario.frontmatter;

  const skillSection =
    extraSkillFragments.length === 0
      ? ''
      : [
          '## Domain skills',
          '',
          'The following skill descriptions are loaded. Follow them.',
          '',
          ...extraSkillFragments.map((s, i) => `### Skill ${i + 1}\n\n${s.trim()}\n`),
        ].join('\n');

  const resultSchema = resultSchemaJson ?? JSON.stringify(ScenarioResultSchema._def, null, 2);

  return [
    '# Role',
    '',
    'You are an ABAP development agent. Use the configured MCP tools and the loaded skills to complete the scenario. Return only the final JSON described in the "Result schema" section.',
    '',
    '# Available context',
    '',
    `- Scenario id: \`${fm.id}\``,
    `- Title: ${fm.title}`,
    `- Difficulty: ${fm.difficulty}`,
    `- Required MCP servers: ${fm.required_mcp_servers.join(', ') || '(none declared)'}`,
    `- Required skills: ${fm.required_skills.join(', ') || '(none declared)'}`,
    `- Timeout: ${fm.timeout_ms} ms`,
    '',
    '# Tool policy',
    '',
    '- Use the configured MCP tools. Do not assume an object exists; discover it first when relevant.',
    '- If a required tool is missing, report the gap in the `errors` array of the result and choose `status: "fail"`.',
    '- Do not invent endpoints or capabilities. If you are unsure, run a discovery call first.',
    '',
    '# Validation policy',
    '',
    '- Where the system provides activation, syntax check, or unit-test feedback, run it before declaring success.',
    '- Collect the evidence in the `evidence` array of the result (kind: object | source | activation | syntax_check | test | diagnostic | tool_result | other).',
    '',
    '# Result policy',
    '',
    '- The final answer MUST be a single JSON object matching the schema below.',
    '- Do not include prose outside the JSON object.',
    '- Do not include code fences or backticks around the JSON.',
    '',
    skillSection,
    '# Scenario',
    '',
    scenario.body.trim(),
    '',
    '# Result schema',
    '',
    'Return a JSON object of this shape:',
    '',
    '```json',
    resultSchema,
    '```',
    '',
  ]
    .filter((s) => s !== undefined)
    .join('\n');
}
