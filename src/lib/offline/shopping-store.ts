import { openDB, type IDBPDatabase } from 'idb';
import type { ShoppingItem } from '@/lib/types';

const DB_NAME = 'meal-planner';
const STORE = 'shopping-list';

interface DB {
  [STORE]: { key: string; value: { week: string; items: ShoppingItem[]; have: Record<string, boolean> } };
}

async function db(): Promise<IDBPDatabase<DB>> {
  return openDB<DB>(DB_NAME, 1, {
    upgrade(d) { if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'week' }); },
  });
}

export async function saveShoppingList(week: string, items: ShoppingItem[]) {
  const d = await db();
  const existing = await d.get(STORE, week);
  await d.put(STORE, { week, items, have: existing?.have ?? {} });
}

export async function loadShoppingList(week: string): Promise<ShoppingItem[] | null> {
  const d = await db();
  const row = await d.get(STORE, week);
  return row?.items ?? null;
}

export async function setHave(week: string, ingredientId: string, unit: string | null, have: boolean) {
  const d = await db();
  const row = await d.get(STORE, week);
  const key = `${ingredientId}::${unit ?? 'none'}`;
  const haveMap = row?.have ?? {};
  haveMap[key] = have;
  await d.put(STORE, { ...(row ?? {}), week, have: haveMap });
}

export async function getHaveMap(week: string): Promise<Record<string, boolean>> {
  const d = await db();
  const row = await d.get(STORE, week);
  return row?.have ?? {};
}
