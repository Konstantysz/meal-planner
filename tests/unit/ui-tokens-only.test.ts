import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Redesigned components use theme tokens only (docs/wiki/concepts/design-brief.md).
const DIRS = ['src/components/ui', 'src/components/shell', 'src/components/plan'];
const FORBIDDEN = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\brgba?\(/,
  /\b(?:bg|text|border|ring|fill|stroke)-(?:gray|zinc|slate|neutral|stone|red|green|blue|white|black)\b/,
];

describe('tokens only', () => {
  const files = DIRS.flatMap((d) => readdirSync(d).map((f) => join(d, f)));
  it.each(files)('%s has no hard-coded colours', (file) => {
    const src = readFileSync(file, 'utf8');
    for (const re of FORBIDDEN) expect(src).not.toMatch(re);
  });
});
