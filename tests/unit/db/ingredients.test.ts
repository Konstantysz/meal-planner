import { describe, it, expect, vi } from 'vitest';
import { listIngredients, createIngredient } from '@/lib/db/ingredients';

describe('listIngredients', () => {
  it('fetches and returns ingredients ordered by name', async () => {
    const mockData = [
      { id: '1', name: 'Mąka', category: 'pieczywo', kcal_per_100g: 364, protein_per_100g: 10, fat_per_100g: 1, carbs_per_100g: 76, default_unit: 'g', source: 'off' },
      { id: '2', name: 'Cukier', category: 'inne', kcal_per_100g: 387, protein_per_100g: 0, fat_per_100g: 0, carbs_per_100g: 100, default_unit: 'g', source: 'off' },
    ];

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    };

    const result = await listIngredients(mockSupabase as any);
    expect(result).toEqual(mockData);
    expect(mockSupabase.from).toHaveBeenCalledWith('ingredients');
  });

  it('throws error when database query fails', async () => {
    const mockError = new Error('DB connection failed');
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
        }),
      }),
    };

    await expect(listIngredients(mockSupabase as any)).rejects.toThrow('DB connection failed');
  });
});

describe('createIngredient', () => {
  it('creates ingredient with valid input', async () => {
    const mockInput = {
      name: 'Mąka pszenna',
      category: 'pieczywo',
      kcal_per_100g: 364,
      protein_per_100g: 10.3,
      fat_per_100g: 1.0,
      carbs_per_100g: 76.3,
      default_unit: 'g',
      source: 'off',
    };

    const mockResult = { id: '123', ...mockInput };

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockResult, error: null }),
          }),
        }),
      }),
    };

    const result = await createIngredient(mockSupabase as any, mockInput);
    expect(result).toEqual(mockResult);
    expect(mockSupabase.from).toHaveBeenCalledWith('ingredients');
  });

  it('throws validation error on invalid input', async () => {
    const mockSupabase = { from: vi.fn() };

    await expect(
      createIngredient(mockSupabase as any, { name: 'Test' })
    ).rejects.toThrow();
  });

  it('throws error when insert fails', async () => {
    const mockInput = {
      name: 'Mąka pszenna',
      category: 'pieczywo',
      kcal_per_100g: 364,
      protein_per_100g: 10.3,
      fat_per_100g: 1.0,
      carbs_per_100g: 76.3,
      default_unit: 'g',
      source: 'off',
    };

    const mockError = new Error('Duplicate entry');
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
          }),
        }),
      }),
    };

    await expect(createIngredient(mockSupabase as any, mockInput)).rejects.toThrow('Duplicate entry');
  });
});
