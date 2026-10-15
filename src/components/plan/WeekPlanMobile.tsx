'use client';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { PlanWithSlots } from '@/lib/db/plans';
import { computeDayMacros } from '@/lib/day-macros';
import { DayTotals } from './DayTotals';
import { PlanSlot } from './PlanSlot';
import { weekDays } from '@/lib/week';
import { slotProps, type SlotHandlers } from './plan-handlers';

// No touch drag on mobile: moving a slot goes through the "Przenieś" picker, adding through the recipe picker.
export function WeekPlanMobile({
  plan,
  onAdd,
  ...handlers
}: { plan: PlanWithSlots } & Pick<SlotHandlers, 'onAdd' | 'onRemove' | 'onServingsChange' | 'onOpenMove'>) {
  const days = weekDays(plan.week_start_date);
  const dayMacros = computeDayMacros(plan.slots);

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="px-3 pb-3">
      {days.map((d) => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const isToday = dateStr === today;
        const slots = plan.slots.filter((s) => s.date === dateStr).sort((a, b) => a.position - b.position);
        const maxPos = slots.length > 0 ? Math.max(...slots.map((s) => s.position)) + 1 : 0;
        return (
          <section key={dateStr} className="grid grid-cols-[3rem_1fr] gap-x-2.5 border-b border-line py-2.5">
            <h3 className="grid content-start justify-items-center">
              <span className="sr-only">{format(d, 'EEEE d MMMM', { locale: pl })}</span>
              <span aria-hidden="true" className="grid justify-items-center">
                <span className={`text-xs ${isToday ? 'font-semibold text-brand' : 'text-muted'}`}>
                  {format(d, 'EEE', { locale: pl }).replace(/\.$/, '')}
                </span>
                <span
                  className={`grid size-9 place-items-center rounded-full font-display text-[22px] font-semibold leading-none tabular-nums ${isToday ? 'bg-brand text-on-brand' : ''}`}
                >
                  {format(d, 'd')}
                </span>
              </span>
            </h3>
            <div className="min-w-0 space-y-1.5">
              {slots.map((s) => (
                <PlanSlot
                  key={s.id}
                  label={s.label ?? `posiłek ${s.position + 1}`}
                  position={s.position}
                  {...slotProps(s, handlers)}
                />
              ))}
              <button
                onClick={() => onAdd(dateStr, maxPos)}
                className="min-h-11 w-full rounded-block px-2 text-left text-sm text-muted hover:bg-hover"
              >
                + dodaj posiłek
              </button>
              <DayTotals day={dayMacros[dateStr]} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
