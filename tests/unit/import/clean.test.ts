import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanHtml } from '@/lib/import/clean';

describe('cleanHtml', () => {
  it('removes scripts, styles, nav, footer', () => {
    const md = cleanHtml('<html><head><style>x</style></head><body><nav>n</nav><article><h1>T</h1><p>Body</p></article><footer>f</footer></body></html>');
    expect(md).toContain('T');
    expect(md).toContain('Body');
    expect(md).not.toContain('<style>');
    expect(md).not.toContain('footer');
  });

  it('extracts article content from jadlonomia fixture', () => {
    const html = readFileSync('tests/fixtures/jadlonomia/sample.html', 'utf8');
    const md = cleanHtml(html);
    expect(md.length).toBeGreaterThan(100);
    expect(md).not.toMatch(/<script/i);
  });

  it('extracts article content from aniagotuje fixture', () => {
    const html = readFileSync('tests/fixtures/aniagotuje/sample.html', 'utf8');
    const md = cleanHtml(html);
    expect(md.length).toBeGreaterThan(100);
  });
});
