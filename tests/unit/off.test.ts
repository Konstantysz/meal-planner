import { describe, it, expect, vi } from 'vitest';
import { mapOffProduct } from '@/lib/off';

describe('mapOffProduct', () => {
  it('maps valid OFF product to IngredientInput', () => {
    const result = mapOffProduct({
      product_name: 'Mąka pszenna',
      nutriments: {
        'energy-kcal_100g': 364,
        proteins_100g: 10.3,
        fat_100g: 1.0,
        carbohydrates_100g: 76.3,
      },
    });
    expect(result?.name).toBe('Mąka pszenna');
    expect(result?.kcal_per_100g).toBe(364);
    expect(result?.source).toBe('off');
  });

  it('returns null when product_name missing', () => {
    expect(mapOffProduct({ nutriments: {} })).toBeNull();
  });

  it('returns null when all macros missing', () => {
    expect(mapOffProduct({ product_name: 'X', nutriments: {} })).toBeNull();
  });
});
