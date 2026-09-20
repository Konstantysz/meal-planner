'use client';
import { addDays, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { PlanWithSlots } from '@/lib/db/plans';
import { PlanSlot } from './PlanSlot';

const POSITIONS = [0, 1, 2, 3, 4];
const LABELS = ['śniadanie', 'lunch', 'obiad', 'przekąska', 'kolacja'];

export function WeekPlanDesktop({
  plan, onAdd, onRemove,
}: {
  plan: PlanWithSlots;
  onAdd: (date: string, position: number) => void;
  onRemove: (slotId: string) => void;
}) {
  const start = new Date(plan.week_start_date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border p-2"></th>
            {days.map((d) => (
              <th key={d.toISOString()} className="border p-2 text-sm">
                {format(d, 'EEE d.MM', { locale: pl })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {POSITIONS.map((pos) => (
            <tr key={pos}>
              <td className="border p-2 text-xs text-gray-500">{LABELS[pos]}</td>
              {days.map((d) => {
                const dateStr = format(d, 'yyyy-MM-dd');
                const slot = plan.slots.find((s) => s.date === dateStr && s.position === pos);
                return (
                  <td key={dateStr + pos} className="border p-1 align-top w-32">
                    {slot ? (
                      <PlanSlot
                        label={LABELS[pos]}
                        recipeName={slot.recipe?.name ?? (slot.recipe_id ? 'przepis usunięty' : null)}
                        onRemove={() => onRemove(slot.id)}
                      />
                    ) : (
                      <button onClick={() => onAdd(dateStr, pos)}
                        className="w-full h-full text-gray-300 hover:text-green-600 text-xl">+</button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
