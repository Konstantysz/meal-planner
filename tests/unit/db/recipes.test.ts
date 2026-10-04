import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRecipe } from '@/lib/db/recipes';

const input = {
  name: 'Spaghetti',
  servings_base: 3,
  prep_time_min: 30,
  source_url: null,
  ingredients: [
    {
      ingredient_id: '3422d8ca-8907-49c2-8c83-da5fc298948f',
      amount: 100,
      unit: 'g',
      raw_text: 'makaron',
      position: 0,
    },
  ],
  steps: [{ position: 0, text: 'Ugotuj makaron' }],
};

function mockRpc(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  const from = vi.fn();
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

describe('createRecipe', () => {
  it('saves through the save_recipe RPC in one call, with Zod defaults applied', async () => {
    const row = { id: 'r1', name: 'Spaghetti' };
    const { client, rpc, from } = mockRpc({ data: row, error: null });

    await expect(createRecipe(client, input, 'h1')).resolves.toEqual(row);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('save_recipe', {
      p_household_id: 'h1',
      p_recipe: {
        ...input,
        visibility: 'household',
        diet_tags: [],
        allergens: [],
        ingredients: input.ingredients.map((i) => ({ ...i, optional: false })),
      },
    });
    // No direct table writes: atomicity lives in the database.
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects invalid input before calling the database', async () => {
    const { client, rpc } = mockRpc({ data: null, error: null });
    await expect(createRecipe(client, { ...input, steps: [] }, 'h1')).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('throws the RPC error', async () => {
    const error = { message: 'new row violates row-level security policy' };
    const { client } = mockRpc({ data: null, error });
    await expect(createRecipe(client, input, 'h1')).rejects.toBe(error);
  });
});
