import { describe, it, expect } from 'vitest';
import { parseLlmJson, LLM_OUTPUT_SCHEMA } from '@/lib/import/schema';

describe('parseLlmJson', () => {
  it('treats null optional fields as absent (small models emit null instead of omitting)', () => {
    const r = parseLlmJson(
      '{"name":"Zupa","recipeIngredient":[],"recipeInstructions":["b"],"image":null,"prepTime":null}',
    );
    expect(r.name).toBe('Zupa');
    expect(r).not.toHaveProperty('image');
  });

  it('strips code fences', () => {
    expect(parseLlmJson('```json\n{"name":"X"}\n```').name).toBe('X');
  });

  it('parses structured ingredients and normalizes the unit', () => {
    const r = parseLlmJson(
      JSON.stringify({
        name: 'Zupa',
        recipeIngredient: [
          { name: 'olej', amount: 2, unit: 'łyżek', optional: false },
          { name: 'cebula', amount: 160, unit: 'gramów', optional: true },
        ],
      }),
    );
    expect(r.recipeIngredient).toEqual([
      { name: 'olej', amount: 2, unit: 'łyżka', optional: false },
      { name: 'cebula', amount: 160, unit: 'g', optional: true },
    ]);
  });

  it('turns null amount/unit and a missing optional into null/null/false', () => {
    const r = parseLlmJson('{"name":"Z","recipeIngredient":[{"name":"sól","amount":null,"unit":null}]}');
    expect(r.recipeIngredient).toEqual([{ name: 'sól', amount: null, unit: null, optional: false }]);
  });

  it('rejects plain-string ingredients', () => {
    expect(() => parseLlmJson('{"name":"Z","recipeIngredient":["2 łyżki soli"]}')).toThrow();
  });
});

describe('LLM_OUTPUT_SCHEMA', () => {
  it('accepts what parseLlmJson accepts', () => {
    const sample = {
      name: 'Zupa',
      recipeIngredient: [{ name: 'a', amount: 1, unit: 'g', optional: false }],
      recipeInstructions: ['b'],
      recipeYield: '4',
      prepTime: 'PT20M',
    };
    for (const key of Object.keys(sample)) expect(LLM_OUTPUT_SCHEMA.properties).toHaveProperty(key);
    expect(parseLlmJson(JSON.stringify(sample)).name).toBe('Zupa');
  });
});
