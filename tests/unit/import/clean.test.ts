import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanHtml, cropToRecipe, extractIngredients } from '@/lib/import/clean';
import { MAX_MARKDOWN_CHARS } from '@/lib/import/schema';

describe('cleanHtml', () => {
  it('removes scripts, styles, nav, footer', () => {
    const md = cleanHtml(
      '<html><head><style>x</style></head><body><nav>n</nav><article><h1>T</h1><p>Body</p></article><footer>f</footer></body></html>',
    );
    expect(md).toContain('T');
    expect(md).toContain('Body');
    expect(md).not.toContain('<style>');
    expect(md).not.toContain('footer');
  });

  it('puts quantity before name and keeps group headers (aniagotuje split spans)', () => {
    const li = (name: string, qty: string) =>
      `<li><span itemprop="recipeIngredient"><span class="ingredient-name">${name}</span><span class="ingredient-qty"> ${qty}</span></span></li>`;
    const md = cleanHtml(
      `<article>${'<p>padding text </p>'.repeat(20)}<button class="ing-header"><strong>Składniki do podania</strong></button><ul>${li('świeży tymianek', 'garść łodyg')}${li('sól i pieprz', 'po pół łyżeczki')}</ul></article>`,
    );
    expect(md).toContain('Składniki do podania');
    expect(md).toContain('garść łodyg świeży tymianek');
    expect(md).toContain('po pół łyżeczki sól i pieprz');
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

  it('drops images and keeps only link text (no URLs reach the model)', () => {
    const md = cleanHtml(
      '<article><h1>T</h1><img src="data:image/png;base64,AAAA" alt="long alt"><p>Use <a href="https://x.pl/cebula">cebula</a> here</p></article>',
    );
    expect(md).toContain('Use cebula here');
    expect(md).not.toMatch(/https?:|data:|long alt/);
  });

  it('drops nested related-recipe cards, forms and comments', () => {
    const md = cleanHtml(`<article itemtype="https://schema.org/Recipe"><h1>Main</h1><p>${'x'.repeat(250)}</p>
      <article itemtype="https://schema.org/Recipe"><span itemprop="recipeIngredient">obcy składnik</span></article>
      <form>Dodaj komentarz</form><div id="comments">ktoś napisał</div></article>`);
    expect(md).toContain('Main');
    expect(md).not.toMatch(/obcy składnik|Dodaj komentarz|ktoś napisał/);
  });

  it.each([
    ['jadlonomia', ['1 kg pomidorów', 'Przygotowanie']],
    ['aniagotuje', ['koncentratu pomidorowego', 'Pomidorową podawaj']],
  ])('%s fixture keeps the recipe and fits the model budget', (site, mustHave) => {
    const md = cleanHtml(readFileSync(`tests/fixtures/${site}/sample.html`, 'utf8'));
    for (const s of mustHave) expect(md).toContain(s);
    expect(md.length).toBeLessThanOrEqual(MAX_MARKDOWN_CHARS);
  });
});

describe('cropToRecipe', () => {
  it('returns short input unchanged', () => {
    expect(cropToRecipe('# T\n\nkrótko')).toBe('# T\n\nkrótko');
  });

  it('keeps title and starts at the number-dense Składniki header', () => {
    const md = `# Zupa\n\nSkładniki:\n\ncebula, dynia\n\n${'bla '.repeat(2000)}\n\nSkładniki na 4 porcje:\n\n1 kg dyni\n2 cebule\n\nPrzygotowanie: 1. Gotować.`;
    const out = cropToRecipe(md);
    expect(out.startsWith('# Zupa\n\nSkładniki na 4 porcje:')).toBe(true);
    expect(out).toContain('1 kg dyni');
    expect(out.length).toBeLessThanOrEqual(MAX_MARKDOWN_CHARS);
  });
});

describe('cleanHtml quotes', () => {
  it('turns ASCII double quotes into Polish quotes (they derail JSON string escaping in small models)', () => {
    const md = cleanHtml('<article><p>Wątróbka nie będzie "strzelać" na patelni, 2" rura</p></article>');
    expect(md).toContain('nie będzie „strzelać” na patelni');
    expect(md).not.toContain('"');
  });
});

describe('extractIngredients', () => {
  const li = (inner: string) => `<li><span itemprop="recipeIngredient">${inner}</span></li>`;

  it('returns every ingredient line in page order, whitespace collapsed', () => {
    const html = `<article><ul>${li('150 g  ryżu - ewentualnie brązowy')}${li('<span class="ingredient-name">sól</span><span class="ingredient-qty"> szczypta</span>')}</ul></article>`;
    expect(extractIngredients(html)).toEqual(['150 g ryżu - ewentualnie brązowy', 'szczypta sól']);
  });

  it('skips related-recipe cards nested in the recipe', () => {
    const html = `<article itemtype="https://schema.org/Recipe"><ul>${li('mąka')}</ul><div itemtype="https://schema.org/Recipe"><ul>${li('cudze')}</ul></div></article>`;
    expect(extractIngredients(html)).toEqual(['mąka']);
  });

  it('is empty when the page has no ingredient markup', () => {
    expect(extractIngredients('<article><p>proza</p></article>')).toEqual([]);
  });
});
