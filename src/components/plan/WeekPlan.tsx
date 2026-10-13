'use client';
import { useEffect, useState } from 'react';
import { addDays, format, parse } from 'date-fns';
import { pl } from 'date-fns/locale';
import { usePlan } from '@/hooks/usePlan';
import { WeekPlanDesktop } from './WeekPlanDesktop';
import { WeekPlanMobile } from './WeekPlanMobile';
import { POSITIONS, POSITION_LABELS } from './plan-handlers';
import { ButtonLink, Icon, Input, Sheet } from '@/components/ui';
import { freePositions } from '@/lib/plan-slots';
import { shiftWeek } from '@/lib/week';

type Recipe = { id: string; name: string };

export function WeekPlan({ weekStart }: { weekStart: string }) {
  const { plan, loading, error, assign, remove, update } = usePlan(weekStart);
  const [pickerFor, setPickerFor] = useState<{ date: string; position: number } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    fetch('/api/recipes')
      .then((r) => r.json())
      .then((list) => Array.isArray(list) && setRecipes(list))
      .catch(() => {});
  }, []);

  async function handlePick(recipeId: string) {
    if (!pickerFor) return;
    const { date, position } = pickerFor;
    setPickerFor(null);
    await assign(date, position, recipeId, 1);
  }

  const handlers = {
    onAdd: (date: string, position: number) => setPickerFor({ date, position }),
    onRemove: remove,
    onMove: (slotId: string, date: string, position: number) => update(slotId, { date, position }),
    onServingsChange: (slotId: string, servings: number) => update(slotId, { servings }),
    onOpenMove: setMovingId,
    onDropRecipe: (recipeId: string, date: string, position: number) => assign(date, position, recipeId, 1),
  };

  const moving = plan?.slots.find((s) => s.id === movingId);

  return (
    <div>
      <WeekNav weekStart={weekStart} />
      {error && (
        <p role="alert" className="mx-3 mb-2 rounded-block border border-line p-2 text-sm text-ink">
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

function weekRange(weekStart: string): string {
  const from = parse(weekStart, 'yyyy-MM-dd', new Date());
  const to = addDays(from, 6);
  const sameMonth = from.getMonth() === to.getMonth();
  const start = format(from, sameMonth ? 'd' : 'd MMM', { locale: pl });
  return `${start} – ${format(to, 'd MMM yyyy', { locale: pl })}`;
}

function WeekNav({ weekStart }: { weekStart: string }) {
  return (
    <nav aria-label="Tydzień" className="flex flex-wrap items-center gap-2 p-3">
      <ButtonLink href={`/plan?week=${shiftWeek(weekStart, -1)}`} aria-label="Poprzedni tydzień" className="px-2">
        <Icon name="prev" width={18} height={18} />
      </ButtonLink>
      <ButtonLink href={`/plan?week=${shiftWeek(weekStart, 1)}`} aria-label="Następny tydzień" className="px-2">
        <Icon name="next" width={18} height={18} />
      </ButtonLink>
      <ButtonLink href="/plan">Dziś</ButtonLink>
      <h2 className="font-display text-lg font-semibold tabular-nums">{weekRange(weekStart)}</h2>
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
  const start = parse(plan.week_start_date, 'yyyy-MM-dd', new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
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
                {free[date].length === 0 && <span className="text-sm text-faint">brak wolnych miejsc</span>}
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
  recipes: Recipe[];
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
