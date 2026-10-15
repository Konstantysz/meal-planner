import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Redesigned components use theme tokens only (docs/wiki/concepts/design-brief.md).
const DIRS = [
  'src/components/ui',
  'src/components/shell',
  'src/components/plan',
  'src/components/shopping',
  'src/components/auth',
  'src/components/import',
];
const FORBIDDEN = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\brgba?\(/,
  /\b(?:bg|text|border|ring|fill|stroke)-(?:gray|zinc|slate|neutral|stone|red|green|blue|white|black)\b/,
];

// `faint` is 3:1 against the surfaces: fine for icons, too weak for text and placeholders (design brief, "Colour").
describe('faint is for icons only', () => {
  const files = readdirSync('src', { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => join('src', f));
  it.each(files)('%s uses text-faint only on an <Icon>', (file) => {
    const lines = readFileSync(file, 'utf8').split('\n');
    const bad = lines.filter(
      (l) => /\b(?:text|placeholder)-faint\b|placeholder:text-faint/.test(l) && !l.includes('<Icon'),
    );
    expect(bad).toEqual([]);
  });
});

describe('tokens only', () => {
  const files = DIRS.flatMap((d) => readdirSync(d).map((f) => join(d, f)));
  it.each(files)('%s has no hard-coded colours', (file) => {
    const src = readFileSync(file, 'utf8');
    for (const re of FORBIDDEN) expect(src).not.toMatch(re);
  });
});
