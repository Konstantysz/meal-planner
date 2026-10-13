import { describe, it, expect } from 'vitest';
import { coverPosition } from '@/lib/recipe-cover';
import { recipeFieldErrors } from '@/lib/recipe-form-errors';
import { RecipeInputSchema } from '@/lib/schemas';

describe('coverPosition', () => {
  it('is null for a recipe that was never planned', () => {
    expect(coverPosition([])).toBeNull();
  });

  it('takes the most frequent position', () => {
    expect(
      coverPosition([
        { position: 2, date: '2026-10-01' },
        { position: 0, date: '2026-10-09' },
        { position: 2, date: '2026-10-02' },
      ]),
    ).toBe(2);
  });

  it('breaks a tie with the most recently planned position', () => {
    expect(
      coverPosition([
        { position: 1, date: '2026-10-05' },
        { position: 4, date: '2026-10-07' },
        { position: 1, date: '2026-10-01' },
        { position: 4, date: '2026-10-02' },
      ]),
    ).toBe(4);
  });
});

describe('recipeFieldErrors', () => {
  const valid = {
    name: 'Zupa',
    servings_base: 4,
    prep_time_min: null,
    source_url: null,
    ingredients: [
      { ingredient_id: '3422d8ca-8907-49c2-8c83-da5fc298948f', amount: 1, unit: 'g', raw_text: 'x', position: 0 },
    ],
    steps: [{ position: 0, text: 'x' }],
  };
  const errorsFor = (patch: object) => {
    const r = RecipeInputSchema.safeParse({ ...valid, ...patch });
    return r.success ? {} : recipeFieldErrors(r.error.issues);
  };

  it('has no errors for a valid recipe', () => {
    expect(errorsFor({})).toEqual({});
  });

  it('gives one Polish message per failing field, never raw Zod text', () => {
    const e = errorsFor({ name: '', servings_base: 0, steps: [], ingredients: [] });
    expect(Object.keys(e).sort()).toEqual(['ingredients', 'name', 'servings_base', 'steps']);
    expect(e.steps).toBe('Dodaj co najmniej jeden krok z treścią.');
    expect(JSON.stringify(e)).not.toMatch(/too_small|invalid_type|Required/);
  });

  it('names the row for a nested issue', () => {
    const steps = [
      { position: 0, text: 'x' },
      { position: 1, title: 'a'.repeat(201), text: 'y' },
    ];
    expect(errorsFor({ steps }).steps).toBe('Krok 2: popraw tytuł (do 200 znaków) lub treść.');
  });

  it('puts an issue on an unknown field into a form-level message', () => {
    expect(errorsFor({ source_url: 'nie-url' }).form).toBe('Przepis zawiera nieprawidłowe dane.');
  });
});
