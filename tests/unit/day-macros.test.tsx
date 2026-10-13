import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { computeDayMacros, type DaySlotInput, type PlannedRecipeIngredient } from '@/lib/day-macros';
import { DayTotals } from '@/components/plan/DayTotals';

const oil = { kcal_per_100g: 900, protein_per_100g: 0, fat_per_100g: 100, carbs_per_100g: 0 };
const rice = { kcal_per_100g: 350, protein_per_100g: 7, fat_per_100g: 1, carbs_per_100g: 78 };

const ing = (
  ingredients: PlannedRecipeIngredient['ingredients'],
  amount: number | null,
  unit: string | null = 'g',
  optional = false,
): PlannedRecipeIngredient => ({ amount, unit, optional, ingredients });

// 200 g rice + 20 g oil for 2 servings: total 880 kcal, so 440 kcal per serving.
const ricePlate = [ing(rice, 200), ing(oil, 20)];

const slot = (
  over: Partial<DaySlotInput> & { ingredients?: PlannedRecipeIngredient[]; base?: number },
): DaySlotInput => ({
  date: '2026-10-05',
  recipe_id: 'r1',
  servings: 1,
  recipe: { servings_base: over.base ?? 2, ingredients: over.ingredients ?? ricePlate },
  ...over,
});

describe('computeDayMacros', () => {
  it('returns nothing for an empty week or slots without recipes', () => {
    expect(computeDayMacros([])).toEqual({});
    expect(computeDayMacros([slot({ recipe_id: null, recipe: null })])).toEqual({});
  });

  it('scales per-serving macros by the planned servings', () => {
    const one = computeDayMacros([slot({ servings: 1 })])['2026-10-05'];
    const three = computeDayMacros([slot({ servings: 3 })])['2026-10-05'];
    expect(one.macros.kcal).toBeCloseTo(440);
    expect(three.macros.kcal).toBeCloseTo(1320);
    expect(three.macros.protein).toBeCloseTo(3 * 7);
    expect(three.incomplete).toBe(false);
  });

  it('sums several slots per day and keeps days apart', () => {
    const days = computeDayMacros([
      slot({}),
      slot({ servings: 2 }),
      slot({ date: '2026-10-06', ingredients: [ing(oil, 10)], base: 1 }),
    ]);
    expect(days['2026-10-05'].macros.kcal).toBeCloseTo(440 + 880);
    expect(days['2026-10-06'].macros.kcal).toBeCloseTo(90);
  });

  it('marks the day incomplete when one slot has incomplete data, keeping the rest of the sum', () => {
    const days = computeDayMacros([slot({}), slot({ ingredients: [ing(oil, 2, 'łyżka'), ing(rice, 100)] })]);
    expect(days['2026-10-05']).toMatchObject({ incomplete: true, known: true });
    expect(days['2026-10-05'].macros.kcal).toBeCloseTo(440 + 175);
  });

  it('counts kg and l like g and ml', () => {
    const day = computeDayMacros([slot({ ingredients: [ing(rice, 0.2, 'kg'), ing(oil, 0.02, 'l')] })])['2026-10-05'];
    expect(day.macros.kcal).toBeCloseTo(440);
    expect(day.incomplete).toBe(false);
  });

  it('marks the day incomplete for an unavailable recipe, zero servings_base or zero servings', () => {
    const unavailable = computeDayMacros([slot({ recipe: null })])['2026-10-05'];
    expect(unavailable).toMatchObject({ incomplete: true, known: false });
    expect(unavailable.macros.kcal).toBe(0);
    expect(computeDayMacros([slot({ base: 0 })])['2026-10-05'].incomplete).toBe(true);
    expect(computeDayMacros([slot({ servings: 0 })])['2026-10-05'].incomplete).toBe(true);
  });
});

describe('DayTotals', () => {
  it('renders nothing for a day without recipes', () => {
    const { container } = render(<DayTotals day={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows rounded totals', () => {
    render(<DayTotals day={computeDayMacros([slot({})])['2026-10-05']} />);
    expect(screen.getByText('440 kcal')).toBeTruthy();
    expect(screen.getByText('B 7 · T 11 · W 78')).toBeTruthy();
  });

  it('shows „brak danych makro" when no slot added macros', () => {
    render(<DayTotals day={computeDayMacros([slot({ recipe: null })])['2026-10-05']} />);
    expect(screen.getByText('brak danych makro')).toBeTruthy();
  });

  it('labels a partial sum as a lower bound', () => {
    render(<DayTotals day={computeDayMacros([slot({}), slot({ recipe: null })])['2026-10-05']} />);
    expect(screen.getByText('≥ 440 kcal')).toBeTruthy();
    expect(screen.getByText('makra niepełne')).toBeTruthy();
  });

  it('does not label a complete sum', () => {
    render(<DayTotals day={computeDayMacros([slot({})])['2026-10-05']} />);
    expect(screen.queryByText('makra niepełne')).toBeNull();
  });
});
