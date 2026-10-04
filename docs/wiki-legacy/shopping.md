# Shopping list

Pure aggregation: `src/lib/shopping-list.ts` (`aggregateShoppingList`). Groups by `${ingredient_id}::${unit}` — the **same ingredient in two different units produces two separate list lines**, never summed together (this is intentional, not a bug — see plan's Review Focus #2). An ingredient missing macro data sets `incomplete: true` on its shopping-list line, and that flag latches true (OR, never reset false).

## Offline store
`src/lib/offline/shopping-store.ts` wraps `idb` (IndexedDB). `saveShoppingList` preserves the existing pantry have-map on every save (it used to silently wipe it — fixed; if you touch this file again, keep the read-before-write pattern). `setHave`/`getHaveMap` manage the "mam to" (have it) checkbox state per ingredient+unit key, independent of the cached item list.

## API
`GET /api/shopping?week=` aggregates via `getOrCreatePlan` → `getWeekPlan` → `getRecipe` per slot (N+1 query pattern — acceptable for MVP scale, worth batching with `Promise.all` if this becomes slow) → `aggregateShoppingList`.
