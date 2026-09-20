'use client';
import { useCallback, useEffect, useState } from 'react';
import type { PlanWithSlots } from '@/lib/db/plans';

export function usePlan(weekStart: string) {
  const [plan, setPlan] = useState<PlanWithSlots | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/plans?week=${weekStart}`);
    if (r.ok) setPlan(await r.json());
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { reload(); }, [reload]);

  async function assign(date: string, position: number, recipeId: string | null, servings: number) {
    if (!plan) return;
    await fetch(`/api/plans/${plan.id}/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, position, label: null, recipe_id: recipeId, servings }),
    });
    await reload();
  }

  async function remove(slotId: string) {
    if (!plan) return;
    await fetch(`/api/plans/${plan.id}/slots/${slotId}`, { method: 'DELETE' });
    await reload();
  }

  return { plan, loading, assign, remove, reload };
}
