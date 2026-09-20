import { describe, it, expect } from 'vitest';
import { extractRecipe, type LlmFn } from '@/lib/import/extract';
import { SYSTEM_PROMPT } from '@/lib/import/schema';

describe('extractRecipe', () => {
  it('returns parsed recipe on valid JSON', async () => {
    const llm: LlmFn = async () => JSON.stringify({
      name: 'Zupa', recipeIngredient: ['x'], recipeInstructions: ['y'],
    });
    const r = await extractRecipe('md', llm, SYSTEM_PROMPT);
    expect(r.name).toBe('Zupa');
  });

  it('retries on invalid JSON and succeeds', async () => {
    let n = 0;
    const llm: LlmFn = async () => {
      n++;
      if (n === 1) return 'not json';
      return JSON.stringify({ name: 'OK', recipeIngredient: ['a'], recipeInstructions: ['b'] });
    };
    const r = await extractRecipe('md', llm, SYSTEM_PROMPT);
    expect(r.name).toBe('OK');
    expect(n).toBe(2);
  });

  it('throws after max retries on garbage', async () => {
    const llm: LlmFn = async () => 'to nie jest przepis';
    await expect(extractRecipe('md', llm, SYSTEM_PROMPT, 1)).rejects.toThrow();
  });

  it('rejects JSON without name (Review Focus #3)', async () => {
    const llm: LlmFn = async () => JSON.stringify({ recipeIngredient: [], recipeInstructions: [] });
    await expect(extractRecipe('md', llm, SYSTEM_PROMPT, 0)).rejects.toThrow();
  });
});
