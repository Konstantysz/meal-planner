import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Contrast of the design tokens in src/app/globals.css (docs/wiki/concepts/design-brief.md, "Colour").
const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
const rootBlock = css.match(/:root\s*{([^}]*)}/)?.[1] ?? '';
const darkBlock = css.match(/prefers-color-scheme: dark\)\s*{\s*:root\s*{([^}]*)}/)?.[1] ?? '';

function parse(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const light = parse(rootBlock);
const themes = { light, dark: { ...light, ...parse(darkBlock) } };
const surfaces = ['background', 'side', 'hover'];
const slots = ['slot-0', 'slot-1', 'slot-2', 'slot-3', 'slot-4'];

describe.each(Object.entries(themes))('token contrast, %s', (_name, t) => {
  it('has every token', () => {
    for (const k of [...surfaces, ...slots, 'ink', 'muted', 'faint', 'brand', 'on-brand', 'on-slot']) {
      expect(t[k], k).toBeDefined();
    }
  });

  it.each(['ink', 'muted', 'brand'])('%s text reaches 4.5:1 on every surface', (fg) => {
    for (const bg of surfaces) expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it('on-slot text reaches 4.5:1 on every slot colour', () => {
    for (const s of slots) expect(contrast(t['on-slot'], t[s]), s).toBeGreaterThanOrEqual(4.5);
  });

  it('on-brand text reaches 4.5:1 on brand', () => {
    expect(contrast(t['on-brand'], t.brand)).toBeGreaterThanOrEqual(4.5);
  });

  it('faint icons reach 3:1 on every surface', () => {
    for (const bg of surfaces) expect(contrast(t.faint, t[bg]), bg).toBeGreaterThanOrEqual(3);
  });
});
