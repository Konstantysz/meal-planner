import { describe, it, expect } from 'vitest';
import { canEditRecipe } from '@/lib/recipe-access';

describe('canEditRecipe', () => {
  const recipe = { author_id: 'u1' };

  it('lets the author edit', () => {
    expect(canEditRecipe(recipe, 'u1', false)).toBe(true);
  });

  it('sends another member to a fork', () => {
    expect(canEditRecipe(recipe, 'u2', false)).toBe(false);
  });

  it('lets an app admin edit any recipe', () => {
    expect(canEditRecipe(recipe, 'u2', true)).toBe(true);
  });

  it('refuses a signed-out user', () => {
    expect(canEditRecipe(recipe, null, false)).toBe(false);
  });
});
