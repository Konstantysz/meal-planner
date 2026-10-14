'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { usePlan } from '@/hooks/usePlan';
import { WeekPlanDesktop } from './WeekPlanDesktop';
import { WeekPlanMobile } from './WeekPlanMobile';
import { POSITIONS, POSITION_LABELS, type PlanRecipe } from './plan-handlers';
import { ButtonLink, Icon, Input, Sheet } from '@/components/ui';
import { freePositions } from '@/lib/plan-slots';
import { shiftWeek, weekDays, weekRange } from '@/lib/week';

export function WeekPlan({ weekStart }: { weekStart: string }) {
  const { plan, loading, error, assign, remove, update } = usePlan(weekStart);
  const [pickerFor, setPickerFor] = useState<{ date: string; position: number } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<PlanRecipe[]>([]);

  useEffect(() => {
    fetch('/api/recipes')
      .then((r) => r.json())
      .then((list) => Array.isArray(list) && setRecipes(list))
      .catch(() => {});
  }, []);

  // New slots start at 1 serving; passing the recipe lets the slot show before the server answers.
  const addRecipe = (recipeId: string, date: string, position: number) =>
    assign(
      date,
      position,
      recipeId,
      1,
      recipes.find((r) => r.id === recipeId),
    );

  async function handlePick(recipeId: string) {
    if (!pickerFor) return;
    const { date, position } = pickerFor;
    setPickerFor(null);
    await addRecipe(recipeId, date, position);
  }

  const handlers = {
    onAdd: (date: string, position: number) => setPickerFor({ date, position }),
    onRemove: remove,
    onMove: (slotId: string, date: string, position: number) => update(slotId, { date, position }),
    onServingsChange: (slotId: string, servings: number) => update(slotId, { servings }),
    onOpenMove: setMovingId,
    onDropRecipe: addRecipe,
  };

  const moving = plan?.slots.find((s) => s.id === movingId);

  return (
    <div className="lg:px-7 lg:py-5">
      <WeekNav weekStart={weekStart} />
      {error && (
        <p role="alert" className="mx-3 mb-2 lg:mx-0 rounded-block border border-line p-2 text-sm text-ink">
          {error}
        </p>
      )}
      {loading || !plan ? (
        <p className="p-4 text-muted">Ładuję plan…</p>
      ) : (
        <>
          <div className="hidden lg:block">
            <WeekPlanDesktop plan={plan} recipes={recipes} {...handlers} />
          </div>
          <div className="lg:hidden">
            <WeekPlanMobile plan={plan} {...handlers} />
          </div>
        </>
      )}
      {pickerFor && (
        <RecipePickerDialog
          date={pickerFor.date}
          recipes={recipes}
          onPick={handlePick}
          onClose={() => setPickerFor(null)}
        />
      )}
      {plan && moving && (
        <MoveDialog
          plan={plan}
          slotId={moving.id}
          onMove={(date, position) => {
            setMovingId(null);
            update(moving.id, { date, position });
          }}
          onClose={() => setMovingId(null)}
        />
      )}
    </div>
  );
}

const ARROW = 'grid size-11 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink lg:size-8';

function WeekNav({ weekStart }: { weekStart: string }) {
  return (
    <nav aria-label="Tydzień" className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 lg:px-0 lg:pt-0">
      <h2 className="font-display text-2xl font-extrabold tracking-tight tabular-nums">{weekRange(weekStart)}</h2>
      <div className="flex gap-0.5">
        <Link href={`/plan?week=${shiftWeek(weekStart, -1)}`} aria-label="Poprzedni tydzień" className={ARROW}>
          <Icon name="prev" width={18} height={18} />
        </Link>
        <Link href={`/plan?week=${shiftWeek(weekStart, 1)}`} aria-label="Następny tydzień" className={ARROW}>
          <Icon name="next" width={18} height={18} />
        </Link>
      </div>
      <ButtonLink href="/plan">Dziś</ButtonLink>
      <span className="hidden lg:ml-auto lg:block">
        <ButtonLink href="/shopping" variant="primary">
          Lista zakupów
        </ButtonLink>
      </span>
    </nav>
  );
}

function MoveDialog({
  plan,
  slotId,
  onMove,
  onClose,
}: {
  plan: NonNullable<ReturnType<typeof usePlan>['plan']>;
  slotId: string;
  onMove: (date: string, position: number) => void;
  onClose: () => void;
}) {
  const days = weekDays(plan.week_start_date);
  const free = freePositions(
    plan.slots,
    days.map((d) => format(d, 'yyyy-MM-dd')),
    POSITIONS,
  );
  const slot = plan.slots.find((s) => s.id === slotId);
  return (
    <Sheet open onClose={onClose} title={`Przenieś: ${slot?.recipe?.name ?? 'posiłek'}`}>
      <p className="mb-2 text-sm text-muted">Wybierz wolne miejsce.</p>
      <ul className="space-y-3">
        {days.map((d) => {
          const date = format(d, 'yyyy-MM-dd');
          return (
            <li key={date}>
              <div className="mb-1 text-sm font-medium">{format(d, 'EEEE d MMMM', { locale: pl })}</div>
              <div className="flex flex-wrap gap-2">
                {free[date].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onMove(date, p)}
                    className="min-h-11 rounded-control border border-line px-3 text-sm hover:bg-hover lg:min-h-9"
                  >
                    {POSITION_LABELS[p]}
                  </button>
                ))}
                {free[date].length === 0 && <span className="text-sm text-muted">brak wolnych miejsc</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

function RecipePickerDialog({
  date,
  recipes,
  onPick,
  onClose,
}: {
  date: string;
  recipes: PlanRecipe[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const filtered = recipes.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Sheet open onClose={onClose} title={`Wybierz przepis na ${date}`}>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Szukaj…"
        aria-label="Szukaj przepisu"
        className="mb-2"
      />
      <ul className="divide-y divide-line">
        {filtered.map((r) => (
          <li key={r.id}>
            <button className="min-h-11 w-full text-left" onClick={() => onPick(r.id)}>
              {r.name}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
