'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ShoppingItem } from '@/lib/types';
import { loadShoppingList, saveShoppingList, setHave, getHaveMap } from '@/lib/offline/shopping-store';

export function useShoppingList(week: string) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [have, setHaveMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(!navigator.onLine);

  const load = useCallback(async () => {
    setLoading(true);
    const cached = await loadShoppingList(week);
    if (cached) setItems(cached);
    const haveMap = await getHaveMap(week);
    setHaveMap(haveMap);
    if (navigator.onLine) {
      const r = await fetch(`/api/shopping?week=${week}`);
      if (r.ok) {
        const fresh: ShoppingItem[] = await r.json();
        setItems(fresh);
        await saveShoppingList(week, fresh);
      }
    }
    setLoading(false);
  }, [week]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const on = () => { setOffline(false); load(); };
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [load]);

  async function toggleHave(item: ShoppingItem) {
    const key = `${item.ingredient_id}::${item.unit ?? 'none'}`;
    const next = !have[key];
    setHaveMap({ ...have, [key]: next });
    await setHave(week, item.ingredient_id, item.unit, next);
  }

  return { items, have, loading, offline, toggleHave, reload: load };
}
