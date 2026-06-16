import {
  ScenarioResultSchema,
  type AgentRunResult,
  type ScenarioResult,
} from '../../agent-runner/src/index.js';
import type { ParsedScenario } from '../../scenarios/src/index.js';

export type RuleVerdict = 'pass' | 'fail' | 'partial';

export interface RuleResult {
  rule: string;
  verdict: 'pass' | 'fail' | 'skip';
  detail: string;
}

export interface Evaluation {
  overall: RuleVerdict;
  perRule: RuleResult[];
  parsedResult: ScenarioResult | null;
  parseError?: string;
  selfReportedStatus?: ScenarioResult['status'];
}

export function parseFinalText(text: string): {
  result: ScenarioResult | null;
  error?: string;
} {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  const candidate = fenced ? fenced[1]! : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  const slice =
    firstBrace !== -1 && lastBrace > firstBrace
      ? candidate.slice(firstBrace, lastBrace + 1)
      : candidate;
  try {
    const parsed = JSON.parse(slice);
    const result = ScenarioResultSchema.parse(parsed);
    return { result };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function hasChangedObject(name: string) {
  return (result: ScenarioResult | null): RuleResult => {
    if (!result) return { rule: `changed:${name}`, verdict: 'fail', detail: 'no parsed result' };
    const ok = result.changed_objects.some((o) => o.toUpperCase() === name.toUpperCase());
    return {
      rule: `changed:${name}`,
      verdict: ok ? 'pass' : 'fail',
      detail: ok
        ? `${name} is in changed_objects`
        : `${name} is NOT in changed_objects: [${result.changed_objects.join(', ')}]`,
    };
  };
}

function hasEvidenceKind(kind: string) {
  return (result: ScenarioResult | null): RuleResult => {
    if (!result) return { rule: `evidence:${kind}`, verdict: 'fail', detail: 'no parsed result' };
    const ok = result.evidence.some((e) => e.kind === kind);
    return {
      rule: `evidence:${kind}`,
      verdict: ok ? 'pass' : 'fail',
      detail: ok ? `evidence of kind "${kind}" present` : `no evidence of kind "${kind}"`,
    };
  };
}

function statusAtLeast(min: ScenarioResult['status']) {
  return (result: ScenarioResult | null): RuleResult => {
    if (!result) return { rule: `status>=${min}`, verdict: 'fail', detail: 'no parsed result' };
    const order: Record<ScenarioResult['status'], number> = { pass: 2, partial: 1, fail: 0 };
    const ok = order[result.status] >= order[min];
    return {
      rule: `status>=${min}`,
      verdict: ok ? 'pass' : 'fail',
      detail: `self-reported status is "${result.status}" (need >= "${min}")`,
    };
  };
}

function noFatalErrors() {
  return (result: ScenarioResult | null): RuleResult => {
    if (!result) return { rule: 'no-fatal-errors', verdict: 'fail', detail: 'no parsed result' };
    const ok = result.errors.length === 0;
    return {
      rule: 'no-fatal-errors',
      verdict: ok ? 'pass' : 'fail',
      detail: ok ? 'no errors reported' : `errors: ${result.errors.join('; ')}`,
    };
  };
}

function evidenceSummaryContains(substring: string) {
  return (result: ScenarioResult | null): RuleResult => {
    if (!result) {
      return { rule: `summary~"${substring}"`, verdict: 'fail', detail: 'no parsed result' };
    }
    const ok = result.summary.toLowerCase().includes(substring.toLowerCase());
    return {
      rule: `summary~"${substring}"`,
      verdict: ok ? 'pass' : 'fail',
      detail: ok
        ? `summary contains "${substring}"`
        : `summary does not contain "${substring}": ${result.summary}`,
    };
  };
}

const RULE_REGISTRY: Record<string, (result: ScenarioResult | null) => RuleResult> = {
  'has-class': (r) => hasChangedObject('ZCL_BENCH_HELLO')(r),
  'has-method': (r) => evidenceSummaryContains('SAY_HELLO')(r),
  'has-fixture-ok': (r) => hasChangedObject('ZCL_BENCH_FIXTURE_OK')(r),
  activation: hasEvidenceKind('activation'),
  syntax_check: hasEvidenceKind('syntax_check'),
  test: hasEvidenceKind('test'),
  'object-evidence': hasEvidenceKind('object'),
  'status-pass': statusAtLeast('pass'),
  'status-partial-or-pass': statusAtLeast('partial'),
  'no-fatal-errors': noFatalErrors(),
};

function runRule(name: string, result: ScenarioResult | null): RuleResult {
  const impl = RULE_REGISTRY[name];
  if (!impl) return { rule: name, verdict: 'skip', detail: `unknown rule "${name}"` };
  const r = impl(result);
  // Preserve the canonical rule name (the lookup key) so callers can
  // match per-rule results back to the scenario's evaluator.rules.
  return { ...r, rule: name };
}

function aggregate(perRule: RuleResult[]): RuleVerdict {
  if (perRule.some((r) => r.verdict === 'fail')) return 'fail';
  if (perRule.every((r) => r.verdict === 'pass')) return 'pass';
  if (perRule.some((r) => r.verdict === 'pass')) return 'partial';
  return 'fail';
}

export function evaluate(args: {
  scenario: ParsedScenario;
  run: AgentRunResult;
}): Evaluation {
  const { result, error } = parseFinalText(args.run.final_text);
  const ruleNames = args.scenario.frontmatter.evaluator.rules;
  const perRule = ruleNames.length === 0 ? [] : ruleNames.map((n) => runRule(n, result));
  return {
    overall: aggregate(perRule),
    perRule,
    parsedResult: result,
    ...(error !== undefined ? { parseError: error } : {}),
    ...(result ? { selfReportedStatus: result.status } : {}),
  };
}
