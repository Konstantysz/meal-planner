'use client';
import { addDays, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { PlanWithSlots } from '@/lib/db/plans';
import { PlanSlot } from './PlanSlot';
import { DayMacroSummary } from './DayMacroSummary';

export function WeekPlanMobile({
  plan, onAdd, onRemove, dayMacros,
}: {
  plan: PlanWithSlots;
  onAdd: (date: string, position: number) => void;
  onRemove: (slotId: string) => void;
  dayMacros: Record<string, import('@/lib/types').Macros | null>;
}) {
  const start = new Date(plan.week_start_date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="p-3 space-y-4">
      {days.map((d) => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const slots = plan.slots.filter((s) => s.date === dateStr).sort((a, b) => a.position - b.position);
        const maxPos = slots.length > 0 ? Math.max(...slots.map((s) => s.position)) + 1 : 0;
        return (
          <section key={dateStr} className="border rounded p-3">
            <h3 className="font-semibold mb-2">{format(d, 'EEEE d MMMM', { locale: pl })}</h3>
            <div className="space-y-2">
              {slots.map((s) => (
                <PlanSlot
                  key={s.id}
                  label={s.label ?? `posiłek ${s.position + 1}`}
                  recipeName={s.recipe?.name ?? (s.recipe_id ? 'przepis usunięty' : null)}
                  onRemove={() => onRemove(s.id)}
                />
              ))}
              <button onClick={() => onAdd(dateStr, maxPos)}
                className="w-full text-sm text-green-700 border border-dashed rounded py-1">
                + dodaj posiłek
              </button>
            </div>
            <DayMacroSummary macros={dayMacros[dateStr] ?? null} />
          </section>
        );
      })}
    </div>
  );
}
