import { describe, it, expect } from 'vitest';
import { parseLlmJson, LLM_OUTPUT_SCHEMA } from '@/lib/import/schema';

describe('parseLlmJson', () => {
  it('treats null optional fields as absent (small models emit null instead of omitting)', () => {
    const r = parseLlmJson(
      '{"name":"Zupa","recipeIngredient":["a"],"recipeInstructions":["b"],"image":null,"prepTime":null}',
    );
    expect(r.name).toBe('Zupa');
    expect(r).not.toHaveProperty('image');
  });

  it('strips code fences', () => {
    expect(parseLlmJson('```json\n{"name":"X"}\n```').name).toBe('X');
  });
});

describe('LLM_OUTPUT_SCHEMA', () => {
  it('accepts what parseLlmJson accepts', () => {
    const sample = {
      name: 'Zupa',
      recipeIngredient: ['a'],
      recipeInstructions: ['b'],
      recipeYield: '4',
      prepTime: 'PT20M',
    };
    for (const key of Object.keys(sample)) expect(LLM_OUTPUT_SCHEMA.properties).toHaveProperty(key);
    expect(parseLlmJson(JSON.stringify(sample)).name).toBe('Zupa');
  });
});
