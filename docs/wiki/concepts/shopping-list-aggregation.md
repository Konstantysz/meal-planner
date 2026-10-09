---
title: "Shopping List Aggregation"
summary: "How the week's slots become a shopping list: per-slot scaling, grouping by ingredient and unit, the incomplete flag, sorting, and the N+1 API."
tags: [shopping, macros]
status: stable
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-09
last_reviewed: 2026-10-09
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: a7f8f52
sources:
  - title: "Aggregation"
    path: src/lib/shopping-list.ts
  - title: "Shopping route"
    path: src/app/api/shopping/route.ts
  - title: "Shopping UI"
    path: src/components/shopping/ShoppingItem.tsx
  - title: "Aggregation tests"
    path: tests/unit/shopping-list.test.ts
---

# Shopping List Aggregation

> [!tldr]
> `aggregateShoppingList` scales each slot's ingredients by `servings / servings_base` and groups them by `ingredient_id::unit`. **The same ingredient in two units gives two shopping items and is never summed.** A shopping item is `incomplete` if any contributing ingredient lacks macros. The API loads each slot's recipe one by one (N+1).

## Context

Review Focus #2 (mixed units) and #5 (missing macros) both apply here. See [[concepts]], [[week-plan]] and [[offline-shopping-store]].

## How it works

`GET /api/shopping?week=`:

1. Resolves the household, then `getOrCreatePlan` and `getWeekPlan`.
2. For each slot with a `recipe_id`, calls `getRecipe` **sequentially** and maps it into a `PlannedRecipe`. `has_macros` is `hasMacros(ingredients)` from `src/lib/macros.ts`: true if any of the four per-100g fields is non-null.
3. Runs `aggregateShoppingList(planned)`.

`aggregateShoppingList`:

- `factor = servings / base_servings`, or 1 if `base_servings <= 0`.
- `key = ${ingredient_id}::${unit ?? 'none'}`.
- Amounts are summed. A null amount doesn't erase a known total. `raw_amounts` collects every `raw_text`.
- `incomplete` latches: once one contributor lacks macros it stays true.
- Sorted by `category`, then `ingredient_name` (`localeCompare`).

The UI (`ShoppingList` → `CategoryGroup` → `ShoppingItem`) groups shopping items by category with Polish headings. It shows the total rounded to 2 decimals, or `raw_amounts.join(' + ')` when the total is null, and marks incomplete items „(brak makro)".

## Invariants and gotchas

- **Never sum across units.** That is intentional and tested (`does NOT sum same ingredient in different units`). „2 łyżki oliwy" and „100 ml oliwy" stay as two shopping items.
- The have-checkbox key uses the same `ingredient_id::unit` format. If you change the grouping key, change it in `shopping-store.ts`, `useShoppingList.ts` and `CategoryGroup.tsx` too.
- Slots whose recipe is RLS-hidden make `getRecipe` throw, which turns the whole response into an unhandled error (500).

## Known gaps

- `/shopping` is statically pre-rendered, so its `week` is fixed at build time. See [[week-plan#Known gaps]].
- N+1 queries: one `getRecipe` per slot. A `Promise.all` or a single joined query would fix it.
- Servings are always 1 per slot (see [[week-plan#Invariants and gotchas]]).
- No unit conversion (`kg` vs `g` stay separate shopping items).

## Examples

```ts
aggregateShoppingList([
  { recipe_id: 'a', servings: 2, base_servings: 4, ingredients: [
    { ingredient_id: 'oil', ingredient_name: 'oliwa', category: 'tluszcze', amount: 2, unit: 'łyżka', raw_text: '2 łyżki', has_macros: true },
    { ingredient_id: 'oil', ingredient_name: 'oliwa', category: 'tluszcze', amount: 100, unit: 'ml', raw_text: '100 ml', has_macros: true },
  ] },
]); // → two shopping items: 1 łyżka and 50 ml
```

## Related

- [[concepts]]
- [[week-plan]]
- [[offline-shopping-store]]
- [[macro-calculation]]
- [[0007-units-never-summed]]

## Sources

- `src/lib/shopping-list.ts`, `tests/unit/shopping-list.test.ts`, `src/app/api/shopping/route.ts`, `src/components/shopping/*`

## Changelog

- 2026-10-09: `has_macros` now uses `hasMacros` (all four fields), closing the #15 mismatch. Removed the gotcha.
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-09: Verified against a7f8f52 (`has_macros` in `src/app/api/shopping/route.ts`, sequential `getRecipe` per slot). Linked the has_macros mismatch to #15.
- 2026-10-04: Created from legacy `shopping.md`. Added the has_macros mismatch and the RLS-hidden recipe failure.
