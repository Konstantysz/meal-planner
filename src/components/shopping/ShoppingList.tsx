'use client';
import { useShoppingList } from '@/hooks/useShoppingList';
import { ButtonLink, EmptyState } from '@/components/ui';
import { CategoryGroup } from './CategoryGroup';

/**
 * Offline banner copy states what the code does (see docs/wiki/concepts/offline-shopping-store.md):
 * the last saved list is shown and have marks are written on this device. Nothing is synced.
 */
export const OFFLINE_NOTICE =
  'Brak połączenia — widzisz ostatnio zapisaną listę. Zaznaczenia „mam to" zostają na tym urządzeniu.';

export function ShoppingList({ week }: { week: string }) {
  const { items, have, loading, offline, toggleHave } = useShoppingList(week);
  if (loading && items.length === 0) return <p className="text-muted">Ładuję…</p>;

  const grouped = items.reduce<Record<string, typeof items>>((acc, it) => {
    (acc[it.category] ??= []).push(it);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {offline && (
        <p role="status" className="rounded-block border border-line bg-side p-3 text-sm">
          {OFFLINE_NOTICE}
        </p>
      )}
      {items.length === 0 ? (
        <EmptyState
          message={
            offline
              ? 'Nie ma zapisanej listy na tym urządzeniu. Otwórz Zakupy z połączeniem, żeby ją pobrać.'
              : 'Lista jest pusta. Zaplanuj posiłki, a składniki pojawią się tutaj.'
          }
          action={
            offline ? undefined : (
              <ButtonLink href="/plan" variant="outline">
                Przejdź do planu
              </ButtonLink>
            )
          }
        />
      ) : (
        Object.entries(grouped).map(([cat, list]) => (
          <CategoryGroup key={cat} category={cat} items={list} have={have} onToggle={toggleHave} />
        ))
      )}
    </div>
  );
}
