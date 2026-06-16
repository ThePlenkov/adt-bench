import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSkillFragments } from './cli.js';

let work: string;

beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), 'skills-test-'));
});

afterEach(async () => {
  await rm(work, { recursive: true, force: true });
});

describe('loadSkillFragments', () => {
  it('reads every SKILL.md one level deep', async () => {
    await mkdir(join(work, 'a'), { recursive: true });
    await mkdir(join(work, 'b'), { recursive: true });
    await writeFile(join(work, 'a', 'SKILL.md'), '# a');
    await writeFile(join(work, 'b', 'SKILL.md'), '# b');
    const frags = await loadSkillFragments(work);
    expect(frags.sort()).toEqual(['# a', '# b']);
  });

  it('skips directories whose name starts with _', async () => {
    await mkdir(join(work, 'regular'), { recursive: true });
    await mkdir(join(work, '_meta'), { recursive: true });
    await writeFile(join(work, 'regular', 'SKILL.md'), '# regular');
    await writeFile(join(work, '_meta', 'SKILL.md'), '# meta');
    const frags = await loadSkillFragments(work);
    expect(frags).toEqual(['# regular']);
  });

  it('returns empty array for missing directory', async () => {
    const frags = await loadSkillFragments(join(work, 'does-not-exist'));
    expect(frags).toEqual([]);
  });

  it('skips a skill directory with no SKILL.md', async () => {
    await mkdir(join(work, 'empty'), { recursive: true });
    await mkdir(join(work, 'with-skill'), { recursive: true });
    await writeFile(join(work, 'with-skill', 'SKILL.md'), '# present');
    const frags = await loadSkillFragments(work);
    expect(frags).toEqual(['# present']);
  });
});
