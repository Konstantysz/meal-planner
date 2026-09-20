'use client';
import { useEffect, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { usePlan } from '@/hooks/usePlan';
import { WeekPlanDesktop } from './WeekPlanDesktop';
import { WeekPlanMobile } from './WeekPlanMobile';
import { calculateIngredientMacros, sumMacros } from '@/lib/macros';
import type { Macros } from '@/lib/types';

export function WeekPlan({ weekStart }: { weekStart: string }) {
  const { plan, loading, assign, remove, reload } = usePlan(weekStart);
  const [isDesktop, setIsDesktop] = useState(false);
  const [pickerFor, setPickerFor] = useState<{ date: string; position: number } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  async function handlePick(recipeId: string) {
    if (!pickerFor) return;
    await assign(pickerFor.date, pickerFor.position, recipeId, 1);
    setPickerFor(null);
  }

  if (loading || !plan) return <p className="p-4">Ładuję plan…</p>;

  const dayMacros: Record<string, Macros | null> = {};
  for (const slot of plan.slots) {
    if (!slot.recipe) continue;
    // szczegóły przepisu nie są tu w pełni dostępne; pobierz per slot asynchronicznie w przyszłej iteracji
    dayMacros[slot.date] = dayMacros[slot.date] ?? null;
  }

  const commonProps = { plan, onAdd: (d: string, p: number) => setPickerFor({ date: d, position: p }), onRemove: remove };

  return (
    <div>
      <div className="p-3 flex justify-between items-center">
        <button onClick={() => reload()}>Odśwież</button>
        <h2 className="font-semibold">Tydzień od {weekStart}</h2>
      </div>
      {isDesktop
        ? <WeekPlanDesktop {...commonProps} />
        : <WeekPlanMobile {...commonProps} dayMacros={dayMacros} />}
      {pickerFor && (
        <RecipePickerDialog
          date={pickerFor.date}
          onPick={handlePick}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}

function RecipePickerDialog({
  date, onPick, onClose,
}: { date: string; onPick: (id: string) => void; onClose: () => void }) {
  const [recipes, setRecipes] = useState<Array<{ id: string; name: string }>>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/recipes').then((r) => r.json()).then(setRecipes).catch(() => {});
  }, []);

  const filtered = recipes.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl md:rounded-xl w-full md:max-w-md p-4 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-2">Wybierz przepis na {date}</h3>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj…"
          className="w-full border rounded px-3 py-2 mb-2" />
        <ul className="divide-y">
          {filtered.map((r) => (
            <li key={r.id}>
              <button className="w-full text-left py-2" onClick={() => onPick(r.id)}>{r.name}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
