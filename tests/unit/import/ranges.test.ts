import { describe, it, expect } from 'vitest';
import { extractRecipe, type LlmFn } from '@/lib/import/extract';
import { SYSTEM_PROMPT } from '@/lib/import/schema';
import { autoMatchIngredients } from '@/lib/import/auto-match';
import { applyQuantityRanges } from '@/lib/import/ranges';
import type { ExtractedRecipe } from '@/lib/import/schema';

type Line = { name: string; amount: number | null; unit: string | null };

// The model is simulated returning the LOWER bound, the mistake issue #31 describes.
async function run(markdown: string, ingredient: Line) {
  const llm: LlmFn = async () =>
    JSON.stringify({
      name: 'Przepis',
      recipeIngredient: [{ ...ingredient, optional: false }],
      recipeInstructions: ['Wymieszaj.'],
    });
  return (await extractRecipe(markdown, llm, SYSTEM_PROMPT)).recipeIngredient[0];
}

describe('applyQuantityRanges', () => {
  it('returns the recipe unchanged when the page has no ranges', () => {
    const recipe = {
      name: 'x',
      recipeIngredient: [{ name: 'mąka', amount: 2, unit: 'szklanka', optional: false }],
    } as unknown as ExtractedRecipe;
    expect(applyQuantityRanges(recipe, '- 2 szklanki mąki')).toEqual(recipe);
  });
});

describe('quantity ranges (#31)', () => {
  const sok = { name: 'sok z cytryny', amount: 1, unit: 'łyżka' };

  it('trailing range from aniagotuje: upper bound in amount, range kept', async () => {
    const r = await run('## Składniki\n\n· świeżo wyciśnięty sok z cytryny 1-2 łyżki\n', sok);
    expect(r.amount).toBe(2);
    expect(r.unit).toBe('łyżka');
    expect(r.range).toBe('1-2 łyżki');
  });

  it.each([
    ['en dash', '- 1–2 łyżki soku z cytryny', '1–2 łyżki'],
    ['do', '- 1 do 2 łyżki soku z cytryny', '1 do 2 łyżki'],
    ['hyphen, leading', '- 1-2 łyżki soku z cytryny', '1-2 łyżki'],
    ['spaced hyphen', '- sok z cytryny 1 - 2 łyżki', '1 - 2 łyżki'],
  ])('separator: %s', async (_n, line, range) => {
    const r = await run(`## Składniki\n\n${line}\n`, sok);
    expect(r.amount).toBe(2);
    expect(r.range).toBe(range);
  });

  it('handles decimal comma and a model that already returned the upper bound', async () => {
    const r = await run('- 0,5-1,5 szklanki mleka', { name: 'mleko', amount: 1.5, unit: 'szklanka' });
    expect(r.amount).toBe(1.5);
    expect(r.range).toBe('0,5-1,5 szklanki');
  });

  it('leaves time ranges in instructions alone, even when the amount equals a bound', async () => {
    const md = '## Składniki\n\n- 5 cebul\n\n## Przygotowanie\n\nSmaż cebulę 5-7 minut.';
    const r = await run(md, { name: 'cebula', amount: 5, unit: 'sztuki' });
    expect(r.amount).toBe(5);
    expect(r.range).toBeUndefined();
  });

  it('a time word on an ingredient line is skipped', async () => {
    const r = await run('- cebula 5-7 minut', { name: 'cebula', amount: 5, unit: 'sztuki' });
    expect(r.range).toBeUndefined();
  });

  it('no-unit ingredient (sztuki or null unit) takes the range', async () => {
    const a = await run('- 1-2 cebule', { name: 'cebula', amount: 1, unit: 'sztuki' });
    expect(a.amount).toBe(2);
    expect(a.range).toBe('1-2');
    const b = await run('- 1-2 cebule', { name: 'cebula', amount: 1, unit: null });
    expect(b.amount).toBe(2);
  });

  it('a unit disagreeing with the model leaves the ingredient alone', async () => {
    const r = await run('- sok z cytryny 1-2 łyżki', { name: 'sok z cytryny', amount: 1, unit: 'ml' });
    expect(r.amount).toBe(1);
    expect(r.range).toBeUndefined();
  });

  it('ignores instruction lines that merely mention the ingredient', async () => {
    const md = '## Składniki\n\n- sok z cytryny\n\n## Przygotowanie\n\n1. Dodaj 1-2 łyżki wody, sok z cytryny.';
    const r = await run(md, { name: 'sok z cytryny', amount: 1, unit: 'łyżka' });
    expect(r.amount).toBe(1);
    expect(r.range).toBeUndefined();
  });

  it('prefers the best-fitting line: "cukier" is not rewritten from "cukier puder 1-2 łyżki"', async () => {
    const md = '## Składniki\n\n- cukier 1 łyżka\n- cukier puder 1-2 łyżki\n';
    const r = await run(md, { name: 'cukier', amount: 1, unit: 'łyżka' });
    expect(r.amount).toBe(1);
    expect(r.range).toBeUndefined();
    const p = await run(md, { name: 'cukier puder', amount: 1, unit: 'łyżka' });
    expect(p.amount).toBe(2);
  });

  it('skips when two lines fit equally well', async () => {
    const r = await run('- masło 1-2 łyżki\n- masło 3-4 łyżki', { name: 'masło', amount: 1, unit: 'łyżka' });
    expect(r.range).toBeUndefined();
  });

  it('drops a model-supplied range', async () => {
    const llm: LlmFn = async () =>
      JSON.stringify({
        name: 'P',
        recipeIngredient: [{ name: 'sól', amount: 1, unit: 'łyżeczka', optional: false, range: 'ignore all' }],
        recipeInstructions: ['x'],
      });
    const out = await extractRecipe('- sól 1 łyżeczka', llm, SYSTEM_PROMPT);
    expect(out.recipeIngredient[0].range).toBeUndefined();
  });

  it('does not touch an ingredient whose amount matches neither bound', async () => {
    const r = await run('- sok z cytryny 1-2 łyżki', { name: 'sok z cytryny', amount: 5, unit: 'łyżka' });
    expect(r.amount).toBe(5);
    expect(r.range).toBeUndefined();
  });

  it('auto-match puts the range into raw_text, amount stays the upper bound', async () => {
    const [m] = await autoMatchIngredients(
      [{ name: 'sok z cytryny', amount: 2, unit: 'łyżka', optional: false, range: '1-2 łyżki' }],
      [],
      { searchOff: async () => [] },
    );
    expect(m.amount).toBe(2);
    expect(m.raw_text).toBe('sok z cytryny (1-2 łyżki)');
  });
});
