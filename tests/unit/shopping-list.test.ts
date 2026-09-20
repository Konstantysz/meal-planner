import { describe, it, expect } from 'vitest';
import { aggregateShoppingList, type PlannedRecipe } from '@/lib/shopping-list';

const recipe = (over: Partial<PlannedRecipe> = {}): PlannedRecipe => ({
  recipe_id: 'r1', servings: 4, base_servings: 2,
  ingredients: [{
    ingredient_id: 'i1', ingredient_name: 'cebula', category: 'warzywa',
    amount: 100, unit: 'g', raw_text: '100 g cebuli', has_macros: true,
  }],
  ...over,
});

describe('aggregateShoppingList', () => {
  it('scales by servings ratio', () => {
    const out = aggregateShoppingList([recipe()]);
    expect(out[0].total_amount).toBe(200);
  });

  it('aggregates same ingredient in same unit', () => {
    const out = aggregateShoppingList([
      { ...recipe(), servings: 2, base_servings: 2 },
      { ...recipe(), servings: 2, base_servings: 2 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].total_amount).toBe(200);
    expect(out[0].raw_amounts).toHaveLength(2);
  });

  it('does NOT sum same ingredient in different units', () => {
    const out = aggregateShoppingList([
      recipe(),
      { ...recipe(), ingredients: [{
        ingredient_id: 'i1', ingredient_name: 'oliwa', category: 'tluszcze',
        amount: 2, unit: 'łyżka', raw_text: '2 łyżki oliwy', has_macros: false,
      }] },
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((x) => x.unit === 'g')?.total_amount).toBe(200);
    expect(out.find((x) => x.unit === 'łyżka')?.total_amount).toBe(4);
  });

  it('marks incomplete when macros missing', () => {
    const out = aggregateShoppingList([
      recipe({ ingredients: [{
        ingredient_id: 'i1', ingredient_name: 'x', category: 'inne',
        amount: 100, unit: 'g', raw_text: '100 g', has_macros: false,
      }] }),
    ]);
    expect(out[0].incomplete).toBe(true);
  });
});
