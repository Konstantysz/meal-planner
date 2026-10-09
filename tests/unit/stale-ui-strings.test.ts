import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

// Retired UI strings must not reappear in code or the glossary (wiki changelogs and docs/plans may cite them).
const RETIRED = ['przepis usunięty'];

describe('retired UI strings', () => {
  it.each(RETIRED)('„%s" is not used in src or GLOSSARY.md', (s) => {
    const hits = execSync(`git grep -l -F "${s}" -- src GLOSSARY.md || true`, {
      encoding: 'utf8',
    }).trim();
    expect(hits).toBe('');
  });
});
