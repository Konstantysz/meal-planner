import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekPlanMobile } from '@/components/plan/WeekPlanMobile';
import { WeekPlanDesktop } from '@/components/plan/WeekPlanDesktop';
import type { PlanWithSlots } from '@/lib/db/plans';

const plan = {
  id: 'p1',
  week_start_date: '2026-10-05',
  slots: [{ id: 's1', date: '2026-10-05', position: 0, label: null, recipe_id: 'r1', recipe: null }],
} as unknown as PlanWithSlots;

const props = { plan, onAdd: () => {}, onRemove: () => {}, dayMacros: {} };

describe.each([
  ['WeekPlanMobile', WeekPlanMobile],
  ['WeekPlanDesktop', WeekPlanDesktop],
])('%s with unreadable recipe', (_name, Component) => {
  it('shows neutral "przepis niedostępny" text', () => {
    render(<Component {...props} />);
    expect(screen.getByText('przepis niedostępny')).toBeTruthy();
    expect(screen.queryByText('przepis usunięty')).toBeNull();
  });
});
