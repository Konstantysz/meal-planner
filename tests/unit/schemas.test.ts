import { describe, it, expect } from 'vitest';
import { RecipeJsonLdSchema } from '@/lib/schemas';

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
      })
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
