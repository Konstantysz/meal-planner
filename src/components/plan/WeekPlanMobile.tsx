'use client';
import { addDays, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { PlanWithSlots } from '@/lib/db/plans';
import { computeDayMacros } from '@/lib/day-macros';
import { DayTotals } from './DayTotals';
import { PlanSlot } from './PlanSlot';
import type { SlotHandlers } from './plan-handlers';

// No touch drag on mobile: moving a slot goes through the "Przenieś" picker, adding through the recipe picker.
export function WeekPlanMobile({
  plan,
  onAdd,
  onRemove,
  onServingsChange,
  onOpenMove,
}: { plan: PlanWithSlots } & Pick<SlotHandlers, 'onAdd' | 'onRemove' | 'onServingsChange' | 'onOpenMove'>) {
  const start = new Date(plan.week_start_date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const dayMacros = computeDayMacros(plan.slots);

  return (
    <div className="p-3 space-y-4">
      {days.map((d) => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const slots = plan.slots.filter((s) => s.date === dateStr).sort((a, b) => a.position - b.position);
        const maxPos = slots.length > 0 ? Math.max(...slots.map((s) => s.position)) + 1 : 0;
        return (
          <section key={dateStr} className="border border-line rounded-block p-3">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="font-semibold">{format(d, 'EEEE d MMMM', { locale: pl })}</h3>
              <div className="text-right">
                <DayTotals day={dayMacros[dateStr]} />
              </div>
            </div>
            <div className="space-y-2">
              {slots.map((s) => (
                <PlanSlot
                  key={s.id}
                  label={s.label ?? `posiłek ${s.position + 1}`}
                  position={s.position}
                  recipeName={s.recipe?.name ?? (s.recipe_id ? 'przepis niedostępny' : null)}
                  servings={s.servings}
                  onRemove={() => onRemove(s.id)}
                  onMove={() => onOpenMove(s.id)}
                  onServingsChange={(n) => onServingsChange(s.id, n)}
                />
              ))}
              <button
                onClick={() => onAdd(dateStr, maxPos)}
                className="w-full text-sm text-ink border border-line rounded-control min-h-11"
              >
                + dodaj posiłek
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
