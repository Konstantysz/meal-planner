'use client';
import { useEffect, useState } from 'react';
import { usePlan } from '@/hooks/usePlan';
import { WeekPlanDesktop } from './WeekPlanDesktop';
import { WeekPlanMobile } from './WeekPlanMobile';
import { Input, Sheet } from '@/components/ui';
import type { Macros } from '@/lib/types';

export function WeekPlan({ weekStart }: { weekStart: string }) {
  const { plan, loading, assign, remove, reload } = usePlan(weekStart);
  const [pickerFor, setPickerFor] = useState<{ date: string; position: number } | null>(null);

  async function handlePick(recipeId: string) {
    if (!pickerFor) return;
    await assign(pickerFor.date, pickerFor.position, recipeId, 1);
    setPickerFor(null);
  }

  if (loading || !plan) return <p className="p-4 text-muted">Ładuję plan…</p>;

  const dayMacros: Record<string, Macros | null> = {};
  for (const slot of plan.slots) {
    if (!slot.recipe) continue;
    // szczegóły przepisu nie są tu w pełni dostępne; pobierz per slot asynchronicznie w przyszłej iteracji
    dayMacros[slot.date] = dayMacros[slot.date] ?? null;
  }

  const commonProps = {
    plan,
    onAdd: (d: string, p: number) => setPickerFor({ date: d, position: p }),
    onRemove: remove,
  };

  return (
    <div>
      <div className="p-3 flex justify-between items-center">
        <button onClick={() => reload()}>Odśwież</button>
        <h2 className="font-semibold">Tydzień od {weekStart}</h2>
      </div>
      <div className="hidden lg:block">
        <WeekPlanDesktop {...commonProps} />
      </div>
      <div className="lg:hidden">
        <WeekPlanMobile {...commonProps} dayMacros={dayMacros} />
      </div>
      {pickerFor && <RecipePickerDialog date={pickerFor.date} onPick={handlePick} onClose={() => setPickerFor(null)} />}
    </div>
  );
}

function RecipePickerDialog({
  date,
  onPick,
  onClose,
}: {
  date: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [recipes, setRecipes] = useState<Array<{ id: string; name: string }>>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/recipes')
      .then((r) => r.json())
      .then(setRecipes)
      .catch(() => {});
  }, []);

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
