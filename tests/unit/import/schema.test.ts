import { describe, it, expect } from 'vitest';
import { parseLlmJson, LLM_OUTPUT_SCHEMA, SYSTEM_PROMPT } from '@/lib/import/schema';

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

describe('parseLlmJson steps', () => {
  it('parses titled steps and keeps a null title', () => {
    const r = parseLlmJson(
      JSON.stringify({
        name: 'Z',
        recipeInstructions: [
          { title: 'Smażenie cebuli', text: 'Smaż 5 minut.' },
          { title: null, text: 'Gotuj.' },
        ],
      }),
    );
    expect(r.recipeInstructions).toEqual([
      { title: 'Smażenie cebuli', text: 'Smaż 5 minut.' },
      { title: null, text: 'Gotuj.' },
    ]);
  });

  it('normalises legacy string[] to title null with unchanged text', () => {
    const r = parseLlmJson('{"name":"Z","recipeInstructions":["Pierwszy.","Drugi."]}');
    expect(r.recipeInstructions).toEqual([
      { title: null, text: 'Pierwszy.' },
      { title: null, text: 'Drugi.' },
    ]);
  });

  it('normalises {text} steps, a single string, a missing field and a blank title', () => {
    expect(parseLlmJson('{"name":"Z","recipeInstructions":[{"text":"a"}]}').recipeInstructions).toEqual([
      { title: null, text: 'a' },
    ]);
    expect(parseLlmJson('{"name":"Z","recipeInstructions":"a"}').recipeInstructions).toEqual([
      { title: null, text: 'a' },
    ]);
    expect(parseLlmJson('{"name":"Z"}').recipeInstructions).toEqual([]);
    expect(parseLlmJson('{"name":"Z","recipeInstructions":[{"title":"  ","text":"a"}]}').recipeInstructions).toEqual([
      { title: null, text: 'a' },
    ]);
  });

  it('drops a step title longer than 200 chars but keeps the text', () => {
    const long = 'x'.repeat(201);
    const ok = 'y'.repeat(200);
    const r = parseLlmJson(
      JSON.stringify({
        name: 'Z',
        recipeInstructions: [
          { title: long, text: 'a' },
          { title: ok, text: 'b' },
        ],
      }),
    );
    expect(r.recipeInstructions).toEqual([
      { title: null, text: 'a' },
      { title: ok, text: 'b' },
    ]);
  });
});

describe('LLM_OUTPUT_SCHEMA', () => {
  it('requires title and text on each step and still omits the ingredient range', () => {
    const step = LLM_OUTPUT_SCHEMA.properties.recipeInstructions.items;
    expect(step.required).toEqual(['title', 'text']);
    expect(step.additionalProperties).toBe(false);
    expect(LLM_OUTPUT_SCHEMA.properties.recipeIngredient.items.properties).not.toHaveProperty('range');
  });

  it('SYSTEM_PROMPT describes the step shape', () => {
    expect(SYSTEM_PROMPT).toContain('"title": string | null');
  });

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
