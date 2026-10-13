import { describe, it, expect } from 'vitest';
import { RecipeInputSchema, RecipeJsonLdSchema } from '@/lib/schemas';

describe('RecipeJsonLdSchema', () => {
  it('accepts minimal valid recipe', () => {
    const parsed = RecipeJsonLdSchema.parse({
      name: 'Zupa pomidorowa',
      recipeIngredient: ['2 kg pomidorów', '1 cebula'],
      recipeInstructions: ['Ugotuj pomidory', 'Dodaj cebulę'],
      recipeYield: '4 porcje',
    });
    expect(parsed.name).toBe('Zupa pomidorowa');
    expect(parsed.recipeIngredient).toHaveLength(2);
  });

  it('rejects recipe without name', () => {
    expect(() =>
      RecipeJsonLdSchema.parse({
        recipeIngredient: ['x'],
        recipeInstructions: ['y'],
      }),
    ).toThrow();
  });

  it('accepts recipeInstructions as string', () => {
    const parsed = RecipeJsonLdSchema.parse({
      name: 'Test',
      recipeIngredient: ['a'],
      recipeInstructions: 'Zrób coś',
    });
    expect(parsed.recipeInstructions).toBe('Zrób coś');
  });
});

describe('RecipeInputSchema source_author and step title', () => {
  const base = {
    name: 'Zupa',
    servings_base: 2,
    prep_time_min: null,
    source_url: null,
    ingredients: [
      { ingredient_id: '3422d8ca-8907-49c2-8c83-da5fc298948f', amount: 1, unit: 'g', raw_text: 'x', position: 0 },
    ],
    steps: [{ position: 0, text: 'Gotuj' }],
  };

  it('defaults both to null when omitted (old callers)', () => {
    const parsed = RecipeInputSchema.parse(base);
    expect(parsed.source_author).toBeNull();
    expect(parsed.steps[0].title).toBeNull();
  });

  it('accepts and trims values', () => {
    const parsed = RecipeInputSchema.parse({
      ...base,
      source_author: ' Jadłonomia ',
      steps: [{ position: 0, title: ' Zupa ', text: 'Gotuj' }],
    });
    expect(parsed.source_author).toBe('Jadłonomia');
    expect(parsed.steps[0].title).toBe('Zupa');
  });

  it('turns blank strings into null', () => {
    const parsed = RecipeInputSchema.parse({
      ...base,
      source_author: '  ',
      steps: [{ position: 0, title: '', text: 'x' }],
    });
    expect(parsed.source_author).toBeNull();
    expect(parsed.steps[0].title).toBeNull();
  });
});

describe('RecipeInputSchema image_url', () => {
  const base = {
    name: 'Zupa',
    servings_base: 2,
    prep_time_min: null,
    source_url: null,
    ingredients: [
      { ingredient_id: '3422d8ca-8907-49c2-8c83-da5fc298948f', amount: 1, unit: 'g', raw_text: 'x', position: 0 },
    ],
    steps: [{ position: 0, text: 'Gotuj' }],
  };

  it('defaults to null when omitted', () => {
    expect(RecipeInputSchema.parse(base).image_url).toBeNull();
  });

  it('accepts a trimmed https URL on an allowed host', () => {
    const parsed = RecipeInputSchema.parse({ ...base, image_url: ' https://cdn.aniagotuje.com/a.jpg ' });
    expect(parsed.image_url).toBe('https://cdn.aniagotuje.com/a.jpg');
  });

  it('normalises the scheme to lowercase so the DB check passes', () => {
    const parsed = RecipeInputSchema.parse({ ...base, image_url: 'HTTPS://cdn.aniagotuje.com/a.jpg' });
    expect(parsed.image_url).toBe('https://cdn.aniagotuje.com/a.jpg');
  });

  it('turns a blank string into null', () => {
    expect(RecipeInputSchema.parse({ ...base, image_url: '  ' }).image_url).toBeNull();
  });

  it.each(['https://evil.example/a.jpg', 'http://cdn.aniagotuje.com/a.jpg', 'javascript:alert(1)', 'not a url'])(
    'rejects %s',
    (image_url) => {
      expect(() => RecipeInputSchema.parse({ ...base, image_url })).toThrow();
    },
  );
});
