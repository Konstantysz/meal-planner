import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

// Retired UI strings must not reappear in code or the glossary (wiki changelogs and docs/plans may cite them).
const RETIRED = ['przepis usunięty'];

// No shell: the search string reaches git as one argument, so its encoding survives any console (#81).
function gitGrep(s: string): string {
  const r = spawnSync('git', ['grep', '-l', '-F', s, '--', 'src', 'GLOSSARY.md'], { encoding: 'utf8' });
  if (r.status === 1) return ''; // git grep: 1 = no match
  if (r.status !== 0) throw new Error(`git grep failed (${r.status}): ${r.stderr}`);
  return r.stdout.trim();
}

describe('retired UI strings', () => {
  it.each(RETIRED)('„%s" is not used in src or GLOSSARY.md', (s) => {
    expect(gitGrep(s)).toBe('');
  });
});
