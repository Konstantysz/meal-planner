'use client';
import { useState, type ComponentProps } from 'react';
import { addDays, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { PlanWithSlots } from '@/lib/db/plans';
import { Icon, Input } from '@/components/ui';
import { computeDayMacros } from '@/lib/day-macros';
import { DayTotals } from './DayTotals';
import { PlanSlot } from './PlanSlot';
import { POSITIONS, POSITION_LABELS as LABELS, type SlotHandlers } from './plan-handlers';

type DragData = { type: 'slot'; slotId: string; name: string } | { type: 'recipe'; recipeId: string; name: string };
type DropData = { date: string; position: number };

const announcements = {
  onDragStart: () => 'Podniesiono. Strzałki zmieniają miejsce, spacja upuszcza, Esc anuluje.',
  onDragOver: ({ over }: { over: { id: string | number } | null }) =>
    over ? `Nad miejscem ${String(over.id).replace(':', ', pozycja ')}.` : 'Poza planem.',
  onDragEnd: ({ over }: { over: { id: string | number } | null }) => (over ? 'Upuszczono.' : 'Anulowano.'),
  onDragCancel: () => 'Anulowano.',
};

export function WeekPlanDesktop({
  plan,
  recipes = [],
  onAdd,
  onRemove,
  onMove,
  onServingsChange,
  onOpenMove,
  onDropRecipe,
}: { plan: PlanWithSlots; recipes?: Array<{ id: string; name: string }> } & SlotHandlers) {
  const start = new Date(plan.week_start_date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const dayMacros = computeDayMacros(plan.slots);
  const today = format(new Date(), 'yyyy-MM-dd');
  const hasTotals = days.some((d) => dayMacros[format(d, 'yyyy-MM-dd')]);
  // distance: a click on the handle or a step button is not a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const [dragging, setDragging] = useState<string | null>(null);

  function handleDragStart({ active }: DragStartEvent) {
    setDragging((active.data.current as DragData | undefined)?.name ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragging(null);
    const from = active.data.current as DragData | undefined;
    const to = over?.data.current as DropData | undefined;
    if (!from || !to) return;
    if (from.type === 'slot') onMove(from.slotId, to.date, to.position);
    else onDropRecipe(from.recipeId, to.date, to.position);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'Spacja podnosi, strzałki przesuwają, spacja upuszcza. Można też użyć przycisku Przenieś.',
        },
      }}
    >
      <div>
        <RecipePanel recipes={recipes} />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <td className="w-20 border-b border-line" />
                {days.map((d) => {
                  const isToday = format(d, 'yyyy-MM-dd') === today;
                  return (
                    <th
                      key={d.toISOString()}
                      scope="col"
                      className="border-b border-line px-1.5 pb-2 text-left align-bottom font-normal"
                    >
                      <span className={`block text-xs ${isToday ? 'font-semibold text-brand' : 'text-muted'}`}>
                        {format(d, 'EEE', { locale: pl }).replace(/\.$/, '')}
                      </span>
                      <span
                        className={`-ml-1.5 mt-0.5 grid size-9 place-items-center rounded-full font-display text-2xl font-semibold leading-none tabular-nums ${isToday ? 'bg-brand text-on-brand' : ''}`}
                      >
                        {format(d, 'd')}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {POSITIONS.map((pos) => (
                <tr key={pos}>
                  <th
                    scope="row"
                    className="w-20 border-b border-line pr-2 pt-2 text-right align-top text-xs font-normal text-muted"
                  >
                    {LABELS[pos]}
                  </th>
                  {days.map((d) => {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const slot = plan.slots.find((s) => s.date === dateStr && s.position === pos);
                    return (
                      <td key={dateStr + pos} className="h-16 min-w-28 border-b border-l border-line p-1 align-top">
                        {slot ? (
                          <DraggableSlot
                            slotId={slot.id}
                            label={LABELS[pos]}
                            position={pos}
                            recipeName={slot.recipe?.name ?? (slot.recipe_id ? 'przepis niedostępny' : null)}
                            servings={slot.servings}
                            onRemove={() => onRemove(slot.id)}
                            onMove={() => onOpenMove(slot.id)}
                            onServingsChange={(n) => onServingsChange(slot.id, n)}
                          />
                        ) : (
                          <EmptyCell date={dateStr} position={pos} onAdd={onAdd} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {hasTotals && (
              <tfoot>
                <tr>
                  <th scope="row" className="pr-2 pt-2 text-right align-top text-xs font-normal text-muted">
                    Razem
                  </th>
                  {days.map((d) => {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    return (
                      <td key={dateStr} className="border-l border-line px-1.5 pt-2 align-top">
                        <DayTotals day={dayMacros[dateStr]} />
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      {/* The overlay renders outside the scrolling table, so the dragged item is never clipped. */}
      <DragOverlay>
        {dragging && <div className="rounded-block border border-line bg-background p-2 text-sm">{dragging}</div>}
      </DragOverlay>
    </DndContext>
  );
}

function DraggableSlot({ slotId, ...slot }: { slotId: string } & Omit<ComponentProps<typeof PlanSlot>, 'dragHandle'>) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `slot:${slotId}`,
    data: { type: 'slot', slotId, name: slot.recipeName ?? '' } satisfies DragData,
  });
  return (
    <div ref={setNodeRef} className={`h-full ${isDragging ? 'opacity-40' : ''}`}>
      <PlanSlot
        {...slot}
        showLabel={false}
        dragHandle={
          <button
            type="button"
            aria-label="Przeciągnij posiłek"
            className="grid min-h-6 min-w-6 cursor-grab place-items-center rounded-control text-on-slot hover:bg-hover touch-none"
            {...attributes}
            {...listeners}
          >
            <Icon name="grip" width={16} height={16} />
          </button>
        }
      />
    </div>
  );
}

function EmptyCell({
  date,
  position,
  onAdd,
}: {
  date: string;
  position: number;
  onAdd: (date: string, position: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${date}:${position}`,
    data: { date, position } satisfies DropData,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={`Dodaj posiłek: ${LABELS[position]}, ${date}`}
      onClick={() => onAdd(date, position)}
      className={`w-full h-full text-faint hover:bg-hover hover:text-muted focus-visible:bg-hover text-xl min-h-14 rounded-block ${isOver ? 'bg-hover outline outline-2 outline-brand' : ''}`}
    >
      +
    </button>
  );
}

function RecipePanel({ recipes }: { recipes: Array<{ id: string; name: string }> }) {
  const [q, setQ] = useState('');
  const filtered = recipes.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="mb-5 rounded-block bg-side px-3 py-2" aria-label="Przepisy">
      <div className="mb-2 flex items-center gap-3">
        <h3 className="font-display text-base font-semibold">Przepisy</h3>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj…"
          aria-label="Szukaj w przepisach"
          className="max-w-xs"
        />
        <p className="text-xs text-muted">Przeciągnij przepis na puste miejsce w planie.</p>
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {filtered.map((r) => (
          <RecipeItem key={r.id} recipe={r} />
        ))}
      </ul>
    </section>
  );
}

function RecipeItem({ recipe }: { recipe: { id: string; name: string } }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe:${recipe.id}`,
    data: { type: 'recipe', recipeId: recipe.id, name: recipe.name } satisfies DragData,
  });
  return (
    <li ref={setNodeRef} className={`shrink-0 ${isDragging ? 'opacity-40' : ''}`}>
      <button
        type="button"
        className="min-h-8 cursor-grab touch-none whitespace-nowrap rounded-control border border-line bg-background px-3 text-sm hover:bg-hover"
        {...attributes}
        {...listeners}
      >
        {recipe.name}
      </button>
    </li>
  );
}
