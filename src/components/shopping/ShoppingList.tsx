'use client';
import { useShoppingList } from '@/hooks/useShoppingList';
import { CategoryGroup } from './CategoryGroup';

export function ShoppingList({ week }: { week: string }) {
  const { items, have, loading, offline, toggleHave } = useShoppingList(week);
  if (loading && items.length === 0) return <p className="p-4">Ładuję…</p>;

  const grouped = items.reduce<Record<string, typeof items>>((acc, it) => {
    (acc[it.category] ??= []).push(it);
    return acc;
  }, {});

  return (
    <div className="p-4 pb-24">
      {offline && <div className="bg-amber-100 text-amber-900 text-sm p-2 rounded mb-3">Tryb offline — zmiany zsynchronizują się po powrocie online</div>}
      {Object.entries(grouped).map(([cat, list]) => (
        <CategoryGroup key={cat} category={cat} items={list} have={have} onToggle={toggleHave} />
      ))}
    </div>
  );
}
