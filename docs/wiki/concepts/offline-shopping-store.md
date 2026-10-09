---
title: "Offline Shopping Store"
summary: "The IndexedDB cache behind the shopping list: what is cached, the per-device have-map, online/offline handling, and the absence of a service worker."
tags: [offline, shopping, pwa]
status: stable
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-09
last_reviewed: 2026-10-09
review_interval_days: 90
confidence: medium
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: 656711c
sources:
  - title: "IndexedDB store"
    path: src/lib/offline/shopping-store.ts
  - title: "useShoppingList hook"
    path: src/hooks/useShoppingList.ts
  - title: "PWA manifest"
    path: public/manifest.json
  - title: "Root layout"
    path: src/app/layout.tsx
---

# Offline Shopping Store

> [!tldr]
> The shopping list is the only offline-capable feature. `useShoppingList` shows the cached list from IndexedDB first, then refreshes from `/api/shopping` when online. The „mam to" have marks live **only** in IndexedDB on that device. They are never sent to the server and never shared with the household. There is no service worker.

## Context

The plan scoped offline support to the shopping list: "IndexedDB + sync when back online". The sync half was never built. See [[concepts]] and [[shopping-list-aggregation]].

## How it works

IndexedDB database `meal-planner`, version 1, object store `shopping-list` with `keyPath: 'week'`. Each row looks like `{ week, items: ShoppingItem[], have: Record<key, boolean> }`.

| Function | Behaviour |
|---|---|
| `saveShoppingList(week, items)` | Reads the row first and **keeps its `have` map** while replacing `items` |
| `loadShoppingList(week)` | `items` or null |
| `setHave(week, id, unit, have)` | Writes `have[id::unit]`, keeping `items` |
| `getHaveMap(week)` | `have` or `{}` |

`useShoppingList(week)`:

1. Loads the cached items and the have-map and shows them.
2. If `navigator.onLine`, fetches `/api/shopping`, shows the fresh list and saves it.
3. On the `online` event it reloads; on `offline` it shows the banner („Tryb offline — zmiany zsynchronizują się po powrocie online").

## Invariants and gotchas

- **Keep the read-before-write in `saveShoppingList`.** An earlier version overwrote the row and wiped every have mark on each refresh (fixed in `2f62038`).
- The have-map key is `${ingredient_id}::${unit ?? 'none'}`, the same as the aggregation key.
- The banner promises a sync that doesn't exist. Have-state is only local. The `pantry_items` table is unused.

> [!warning] Uncertain: Node version dependency
> `useShoppingList` calls `useState(!navigator.onLine)` during render, which also runs when Next pre-renders `/shopping`. `pnpm build` passes on Node 26, which has a global `navigator` (with `onLine` undefined). Node 20 has no global `navigator` (the repo runs on Node 24 in CI and per `AGENTS.md`, and Node 21+ defines one), so the pre-render would most likely throw a `ReferenceError` there. That hasn't been tested. Guard it with `typeof navigator !== 'undefined'`.

## Known gaps

- **No service worker**, so the app shell isn't cached. Offline only works if the `/shopping` page is already open, or the browser serves it from its HTTP cache.
- The have-state doesn't sync between devices or members.
- Cached weeks are never cleaned up.

## Examples

```ts
await saveShoppingList('2026-10-05', items);           // keeps existing have marks
await setHave('2026-10-05', ingredientId, 'g', true);  // "mam to"
```

## Related

- [[concepts]]
- [[shopping-list-aggregation]]
- [[architecture-overview]]

## Sources

- `src/lib/offline/shopping-store.ts`, `src/hooks/useShoppingList.ts`, `public/manifest.json`, `src/app/layout.tsx`
- Commit `2f62038` (preserve the have-map on save)

## Changelog

- 2026-10-09: Re-checked against a7f8f52: store, hook and banner code match. Terminology aligned with GLOSSARY.md (have marks). Corrected the Node version in the uncertain note (Node 24, not 22.22+). Not bumped to a7f8f52: the Node 26 / Node 20 pre-render behaviour is still untested.
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-04: Created from the offline section of legacy `shopping.md`. Added the no-sync, no-service-worker and SSR `navigator` notes.
