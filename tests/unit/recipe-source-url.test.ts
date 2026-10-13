import { describe, it, expect } from 'vitest';
import { RecipeInputSchema } from '@/lib/schemas';

describe('RecipeInputSchema source_url', () => {
  const base = {
    name: 'X',
    servings_base: 1,
    prep_time_min: null,
    ingredients: [
      { ingredient_id: '3422d8ca-8907-49c2-8c83-da5fc298948f', amount: 1, unit: 'g', raw_text: 'x', position: 0 },
    ],
    steps: [{ position: 0, text: 'x' }],
  };
  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://example.com/a'])('rejects %s', (u) => {
    expect(RecipeInputSchema.safeParse({ ...base, source_url: u }).success).toBe(false);
  });
  it.each(['https://jadlonomia.com/x', 'http://example.com', null])('accepts %s', (u) => {
    expect(RecipeInputSchema.safeParse({ ...base, source_url: u }).success).toBe(true);
  });
});
