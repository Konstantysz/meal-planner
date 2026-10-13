import { describe, it, expect } from 'vitest';
import { recipePerServing, type PlannedRecipeIngredient } from '@/lib/day-macros';
import { toListItem, type RecipeListRow } from '@/lib/db/recipes';
import { recipeFieldErrors } from '@/lib/recipe-errors';
import { RecipeInputSchema } from '@/lib/schemas';

const rice = { kcal_per_100g: 350, protein_per_100g: 7, fat_per_100g: 1, carbs_per_100g: 78 };
const none = { kcal_per_100g: null, protein_per_100g: null, fat_per_100g: null, carbs_per_100g: null };
const ing = (
  ingredients: PlannedRecipeIngredient['ingredients'],
  amount: number | null = 200,
  unit: string | null = 'g',
): PlannedRecipeIngredient => ({ amount, unit, optional: false, ingredients });

describe('recipePerServing', () => {
  it('divides the total by base servings', () => {
    expect(recipePerServing([ing(rice)], 2)?.kcal).toBeCloseTo(350);
  });

  it('is null when an ingredient has no macro data', () => {
    expect(recipePerServing([ing(rice), ing(none)], 2)).toBeNull();
  });

  it('is null for a recipe with no ingredients or zero servings', () => {
    expect(recipePerServing([], 2)).toBeNull();
    expect(recipePerServing([ing(rice)], 0)).toBeNull();
  });
});

describe('toListItem', () => {
  const row = {
    id: 'r1',
    name: 'Ryż',
    servings_base: 2,
    ingredients: [ing(rice)],
  } as unknown as RecipeListRow;

  it('replaces the joined ingredients with per-serving macros', () => {
    const item = toListItem(row);
    expect(item.macros_per_serving?.kcal).toBeCloseTo(350);
    expect(item).not.toHaveProperty('ingredients');
    expect(item.name).toBe('Ryż');
  });

  it('gives null macros when the ingredient rows are missing', () => {
    expect(toListItem({ ...row, ingredients: null }).macros_per_serving).toBeNull();
  });
});

describe('recipeFieldErrors', () => {
  const invalid = {
    name: '',
    servings_base: 0,
    prep_time_min: null,
    source_url: null,
    ingredients: [],
    steps: [],
  };

  it('maps each failing field to one Polish message', () => {
    const result = RecipeInputSchema.safeParse(invalid);
    if (result.success) throw new Error('expected a failure');
    const fields = recipeFieldErrors(result.error);
    expect(fields.name).toMatch(/nazw/);
    expect(fields.servings_base).toMatch(/porcji/);
    expect(fields.ingredients).toBe('Dodaj co najmniej jeden składnik');
    expect(fields.steps).toBe('Dodaj co najmniej jeden krok');
    expect(Object.values(fields).join()).not.toMatch(/too_small|invalid_type/);
  });

  it('reports an item problem on its list field', () => {
    const result = RecipeInputSchema.safeParse({
      ...invalid,
      name: 'Zupa',
      servings_base: 2,
      steps: [{ position: 0, text: '' }],
    });
    if (result.success) throw new Error('expected a failure');
    expect(recipeFieldErrors(result.error).steps).toBe('Popraw krok nr 1');
  });

  it('does not say the list is empty when an ingredient is the problem', () => {
    const result = RecipeInputSchema.safeParse({
      ...invalid,
      name: 'Zupa',
      servings_base: 2,
      steps: [{ position: 0, text: 'Gotuj' }],
      ingredients: [{ ingredient_id: 'nie-uuid', amount: 1, unit: 'g', raw_text: '', position: 0, optional: false }],
    });
    if (result.success) throw new Error('expected a failure');
    expect(recipeFieldErrors(result.error).ingredients).toBe('Popraw składnik nr 1');
  });
});
