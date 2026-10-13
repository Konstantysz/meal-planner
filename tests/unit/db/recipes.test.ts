import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRecipe, deleteRecipe, forkRecipe, updateRecipe } from '@/lib/db/recipes';

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
        source_author: null,
        ingredients: input.ingredients.map((i) => ({ ...i, optional: false })),
        steps: input.steps.map((s) => ({ ...s, title: null })),
      },
    });
    // No direct table writes: atomicity lives in the database.
    expect(from).not.toHaveBeenCalled();
  });

  it('passes source_author and step titles through to the RPC', async () => {
    const { client, rpc } = mockRpc({ data: { id: 'r1' }, error: null });
    await createRecipe(
      client,
      {
        ...input,
        source_author: ' Ania Gotuje ',
        steps: [{ position: 0, title: 'Przygotuj', text: 'Ugotuj makaron' }],
      },
      'h1',
    );
    const payload = rpc.mock.calls[0][1].p_recipe;
    expect(payload.source_author).toBe('Ania Gotuje');
    expect(payload.steps).toEqual([{ position: 0, title: 'Przygotuj', text: 'Ugotuj makaron' }]);
  });

  it('sends null for a blank source_author or step title', async () => {
    const { client, rpc } = mockRpc({ data: null, error: null });
    await createRecipe(client, { ...input, source_author: '  ', steps: [{ position: 0, title: '', text: 'x' }] }, 'h1');
    const payload = rpc.mock.calls[0][1].p_recipe;
    expect(payload.source_author).toBeNull();
    expect(payload.steps[0].title).toBeNull();
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

describe('updateRecipe', () => {
  it('replaces the recipe through the update_recipe RPC in one call', async () => {
    const row = { id: 'r1', name: 'Spaghetti' };
    const { client, rpc, from } = mockRpc({ data: row, error: null });

    await expect(updateRecipe(client, 'r1', input)).resolves.toEqual(row);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('update_recipe', {
      p_recipe_id: 'r1',
      p_recipe: {
        ...input,
        visibility: 'household',
        diet_tags: [],
        allergens: [],
        source_author: null,
        ingredients: input.ingredients.map((i) => ({ ...i, optional: false })),
        steps: input.steps.map((s) => ({ ...s, title: null })),
      },
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects invalid input before calling the database', async () => {
    const { client, rpc } = mockRpc({ data: null, error: null });
    await expect(updateRecipe(client, 'r1', { ...input, ingredients: [] })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('throws the RPC error when RLS blocks the update (no silent no-op)', async () => {
    const error = { code: '42501', message: 'recipe not found or not editable' };
    const { client } = mockRpc({ data: null, error });
    await expect(updateRecipe(client, 'r1', input)).rejects.toBe(error);
  });
});

describe('forkRecipe', () => {
  const FORK = '0b6f3f4e-1f7e-4a53-9f43-2b8d0e8f6a11';

  it('forks through the fork_recipe RPC and returns the fork id', async () => {
    const { client, rpc, from } = mockRpc({ data: FORK, error: null });
    await expect(forkRecipe(client, 'r1')).resolves.toBe(FORK);
    expect(rpc).toHaveBeenCalledWith('fork_recipe', { p_recipe_id: 'r1' });
    expect(from).not.toHaveBeenCalled();
  });

  it('throws the RPC error (e.g. P0002 for a recipe the caller cannot read)', async () => {
    const error = { code: 'P0002', message: 'recipe not found' };
    const { client } = mockRpc({ data: null, error });
    await expect(forkRecipe(client, 'r1')).rejects.toBe(error);
  });

  it('rejects a response that is not a uuid', async () => {
    const { client } = mockRpc({ data: { id: FORK }, error: null });
    await expect(forkRecipe(client, 'r1')).rejects.toThrow();
  });
});

describe('deleteRecipe', () => {
  function mockDelete(result: { data: unknown; error: unknown }) {
    const select = vi.fn().mockResolvedValue(result);
    const eq = vi.fn(() => ({ select }));
    const del = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ delete: del }));
    return { client: { from } as unknown as SupabaseClient, from, eq, select };
  }

  it('returns true when a row was deleted, asking for the deleted rows back', async () => {
    const { client, from, eq, select } = mockDelete({ data: [{ id: 'r1' }], error: null });
    await expect(deleteRecipe(client, 'r1')).resolves.toBe(true);
    expect(from).toHaveBeenCalledWith('recipes');
    expect(eq).toHaveBeenCalledWith('id', 'r1');
    expect(select).toHaveBeenCalledWith('id');
  });

  it('returns false when RLS filtered the delete (0 rows), instead of reporting success', async () => {
    const { client } = mockDelete({ data: [], error: null });
    await expect(deleteRecipe(client, 'r1')).resolves.toBe(false);
  });

  it('throws the database error', async () => {
    const error = { code: '22P02', message: 'invalid input syntax for type uuid' };
    const { client } = mockDelete({ data: null, error });
    await expect(deleteRecipe(client, 'nope')).rejects.toBe(error);
  });
});
