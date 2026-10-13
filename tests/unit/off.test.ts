import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mapOffProduct, guessCategory, searchOff } from '@/lib/off';

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

  it('rejects the known bad peanut butter product (macros ×3.125, out of range)', () => {
    expect(
      mapOffProduct({
        product_name: 'Peanut Butter Crunchy',
        nutriments: { 'energy-kcal_100g': 593.75, proteins_100g: 75, fat_100g: 156.25, carbohydrates_100g: 43.75 },
      }),
    ).toBeNull();
  });

  it('rejects the known bad skyr product (kcal ÷3.5, fails Atwater)', () => {
    expect(
      mapOffProduct({
        product_name: 'Skyr Wanilia',
        nutriments: {
          'energy-kcal_100g': 22.2857142857143,
          proteins_100g: 6.5,
          fat_100g: 1.5,
          carbohydrates_100g: 9.5,
        },
      }),
    ).toBeNull();
  });
});

describe('guessCategory', () => {
  it('maps vegetable tags to warzywa', () => {
    expect(guessCategory(['en:vegetable', 'en:root-vegetable'])).toBe('warzywa');
  });

  it('maps fruit tags to owoce', () => {
    expect(guessCategory(['en:fruit'])).toBe('owoce');
  });

  it('maps meat tags to mieso', () => {
    expect(guessCategory(['en:meat', 'en:beef'])).toBe('mieso');
  });

  it('maps fish tags to ryby', () => {
    expect(guessCategory(['en:fish'])).toBe('ryby');
  });

  it('maps dairy tags to nabial', () => {
    expect(guessCategory(['en:dairy', 'en:milk'])).toBe('nabial');
  });

  it('returns inne as fallback', () => {
    expect(guessCategory(['unknown-tag'])).toBe('inne');
    expect(guessCategory([])).toBe('inne');
  });
});

describe('searchOff', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps multiple products from successful OFF response', async () => {
    const mockResponse = {
      products: [
        {
          product_name: 'Mąka pszenna',
          nutriments: { 'energy-kcal_100g': 364, proteins_100g: 10.3, fat_100g: 1.0, carbohydrates_100g: 76.3 },
          categories_tags: ['en:bread-flour'],
        },
        {
          product_name: 'Cukier',
          nutriments: { 'energy-kcal_100g': 387, proteins_100g: 0, fat_100g: 0, carbohydrates_100g: 100 },
          categories_tags: [],
        },
      ],
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as unknown as Response);

    const result = await searchOff('flour');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Mąka pszenna');
    expect(result[1].name).toBe('Cukier');
  });

  it('skips an implausible product so the next result comes first', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [
          {
            product_name: 'Skyr Wanilia',
            nutriments: { 'energy-kcal_100g': 22.29, proteins_100g: 6.5, fat_100g: 1.5, carbohydrates_100g: 9.5 },
          },
          {
            product_name: 'Skyr naturalny',
            nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, fat_100g: 0, carbohydrates_100g: 4 },
          },
        ],
      }),
    } as unknown as Response);

    const result = await searchOff('skyr');
    expect(result.map((r) => r.name)).toEqual(['Skyr naturalny']);
  });

  it('returns empty array on non-ok response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as unknown as Response);

    const result = await searchOff('test');
    expect(result).toEqual([]);
  });

  it('returns empty array on invalid JSON response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error('Invalid JSON');
      },
    } as unknown as Response);

    const result = await searchOff('test');
    expect(result).toEqual([]);
  });

  it('handles missing products field gracefully', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 1 }),
    } as unknown as Response);

    const result = await searchOff('test');
    expect(result).toEqual([]);
  });
});
