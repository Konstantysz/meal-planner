import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRecipe, updateRecipe, listRecipes, getRecipeCoverPosition } from '@/lib/db/recipes';

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

  it('rejects a blank source_author or step title', async () => {
    const { client, rpc } = mockRpc({ data: null, error: null });
    await expect(createRecipe(client, { ...input, source_author: '  ' }, 'h1')).rejects.toThrow();
    await expect(
      createRecipe(client, { ...input, steps: [{ position: 0, title: '', text: 'x' }] }, 'h1'),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
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

// Chainable fake of the query builder: every step returns itself, awaiting it yields `result`.
function fakeQuery(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const m of ['select', 'order', 'contains', 'not', 'eq']) q[m] = vi.fn(() => q);
  return q;
}

describe('listRecipes', () => {
  const ing = { kcal_per_100g: 100, protein_per_100g: 10, fat_per_100g: 5, carbs_per_100g: 20 };
  const row = (id: string, extra: object = {}) => ({
    id,
    name: id,
    servings_base: 2,
    allergens: [],
    recipe_ingredients: [{ amount: 200, unit: 'g', optional: false, ingredients: ing }],
    ...extra,
  });

  function client(recipes: unknown, slots: { data: unknown; error: unknown }) {
    const from = vi.fn((table: string) =>
      table === 'recipes' ? fakeQuery({ data: recipes, error: null }) : fakeQuery(slots),
    );
    return { from } as unknown as SupabaseClient;
  }

  it('adds per-serving macros and the cover position, and drops the ingredient rows', async () => {
    const slots = {
      data: [
        { recipe_id: 'a', position: 2, date: '2026-10-01' },
        { recipe_id: 'a', position: 2, date: '2026-10-02' },
        { recipe_id: 'b', position: 0, date: '2026-10-02' },
      ],
      error: null,
    };
    const out = await listRecipes(client([row('a'), row('c')], slots));
    expect(out[0].macros_per_serving?.kcal).toBe(100);
    expect(out[0].cover_position).toBe(2);
    expect(out[1].cover_position).toBeNull();
    expect(out[0]).not.toHaveProperty('recipe_ingredients');
  });

  it('filters excluded allergens', async () => {
    const out = await listRecipes(client([row('a', { allergens: ['gluten'] }), row('b')], { data: [], error: null }), {
      exclude: ['gluten'],
    });
    expect(out.map((r) => r.id)).toEqual(['b']);
  });

  it('still lists recipes (without colour) when the plan slots cannot be read', async () => {
    const out = await listRecipes(client([row('a')], { data: null, error: { message: 'denied' } }));
    expect(out).toHaveLength(1);
    expect(out[0].cover_position).toBeNull();
  });

  it('throws when the recipes query fails', async () => {
    const from = vi.fn(() => fakeQuery({ data: null, error: new Error('boom') }));
    await expect(listRecipes({ from } as unknown as SupabaseClient)).rejects.toThrow('boom');
  });
});

describe('getRecipeCoverPosition', () => {
  it('reads the slot colour position of one recipe', async () => {
    const from = vi.fn(() => fakeQuery({ data: [{ recipe_id: 'a', position: 3, date: '2026-10-01' }], error: null }));
    await expect(getRecipeCoverPosition({ from } as unknown as SupabaseClient, 'a')).resolves.toBe(3);
  });
});
