---
title: "Macro Calculation"
summary: "How kcal/protein/fat/carbs are computed from per-100g ingredient data into per-serving recipe values, which ingredients are left out and why, and how an incomplete macro total is shown."
tags: [macros, recipes]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-13
last_reviewed: 2026-10-09
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 1933f3c
sources:
  - title: "Macro functions"
    path: src/lib/macros.ts
  - title: "Recipe detail page"
    path: src/app/(app)/recipes/[id]/page.tsx
  - title: "Macro summary component"
    path: src/components/recipes/MacroSummary.tsx
  - title: "Recipe macro panel"
    path: src/components/recipes/RecipeMacroPanel.tsx
  - title: "Day totals"
    path: src/lib/day-macros.ts
  - title: "Macro tests"
    path: tests/unit/macros.test.ts
  - title: "Recipe view macro tests"
    path: tests/unit/recipe-macros-view.test.tsx
---

# Macro Calculation

> [!tldr]
> Macros are stored per 100 g on ingredients and computed per serving for recipes, never stored. `recipeMacros` counts the non-optional ingredients it can weigh and lists the rest with a reason (no macros, no amount, unit not convertible to grams), so an unknown part is never counted as 0. The recipe page and the plan's day totals label such an incomplete macro total „makra niepełne".

## Context

The plan's rule was "macros per 100 g in the ingredient database, per serving in recipes". Until #73 a macro-less ingredient, a missing amount and any unit other than `g` or `ml` (even `kg`) silently added 0, so totals looked confident but came out far too low. See [[concepts]] and [[ingredient-database]]. Terms are in the [[glossary]].

## How it works

All functions are in `src/lib/macros.ts` and are pure:

| Function | Behaviour |
|---|---|
| `hasMacros(ing)` | True if any of the four per-100g fields is non-null. The shopping list uses the same test for „(brak makro)". |
| `calculateIngredientMacros(ing, grams)` | `null` if **all four** per-100g fields are null. Otherwise each field is `(value ?? 0) * grams / 100`. |
| `sumMacros(list)` | Adds the list up and skips `null` entries. An empty or all-null list gives `{0,0,0,0}`. |
| `perServing(total, servings)` | `null` if `servings <= 0`, otherwise each field divided by `servings`. |
| `toGrams(amount, unit)` | Grams for a mass or volume multiple, `null` for any other unit (see the table below). Case, surrounding spaces and one trailing dot (`kg.`) are ignored; inflected forms fall back to `normalizeUnit` (`gramów` → `g`, `litra` → `l`). |
| `recipeMacros(ingredients, servings)` | `{ total, perServing, complete, leftOut }` for a recipe (see below). |

`toGrams` factors:

| Unit | mg | g, gr | dag, dkg | kg | ml | cl | dl | l |
|---|---|---|---|---|---|---|---|---|
| grams per unit | 0.001 | 1 | 10 | 1000 | 1 | 10 | 100 | 1000 |

`toGrams` is a separate converter on purpose: `normalizeUnit` (`src/lib/import/unit.ts`) maps model output onto stored units and is measured by the import evals (see [[ingredient-auto-match]]), so `toGrams` only calls it as a fallback and never changes it.

### `recipeMacros`

For each recipe ingredient, in order:

1. Optional (`optional`): skipped and not reported, so the totals describe the base recipe (see [[recipe-management]]).
2. No ingredient row, or a macro-less ingredient (`!hasMacros`): left out with reason `no_macros`.
3. No amount: left out with `no_amount`.
4. `toGrams` returns null (łyżka, szklanka, szt, …): left out with `unit`.
5. Otherwise counted with `calculateIngredientMacros`.

The result:

- `total`: the sum of the counted ingredients for the whole base recipe.
- `perServing`: `total / servings`, or `null` when nothing was counted or `servings <= 0`.
- `complete`: true when at least one ingredient was counted and none was left out.
- `leftOut`: `{ name, reason }` per left-out ingredient. `name` is the ingredient's name, else the recipe ingredient's `raw_text`, else „składnik" (blank strings are skipped).

A total with `complete: false` is an **incomplete macro total**: a lower bound, not a value.

### Where it is shown

- **Recipe page** (`src/app/(app)/recipes/[id]/page.tsx`): `RecipeMacroPanel` shows the per-serving `MacroSummary`. When anything was left out, the heading reads „Makro per porcja (co najmniej):", and a „makra niepełne" badge lists „Nie wliczono:" with each name and its reason („brak makro składnika", „jednostki nie da się przeliczyć na gramy", „brak ilości").
- **Plan day totals** (`computeDayMacros`, `src/lib/day-macros.ts`): per-serving macros from `recipeMacros` times planned servings, summed per day. An incomplete day shows „≥" before the kcal and „makra niepełne" (see [[week-plan#Day macro totals]]).
- `MacroSummary` renders `null` as „brak danych makro", which now happens when nothing in the recipe could be counted. Otherwise it shows `kcal · B · T · W`.

## Invariants and gotchas

- **Volume is weighed as water: 1 ml = 1 g** for every ingredient, so `100 ml` of oil counts as 100 g. Per-ingredient density is #74.
- **Unknown is not zero.** A left-out ingredient never adds 0 to a total that is shown as complete; it makes the total an incomplete macro total.
- **A partly filled ingredient counts.** An ingredient with only some macro fields counts the missing fields as 0 and is not reported (`hasMacros` is true).
- **Optional recipe ingredients are skipped silently.** They are listed on the page with „(opcjonalnie)" but never appear in `leftOut`.
- **Consistent with the shopping list.** `no_macros` uses the same `hasMacros` test as the shopping list's incomplete shopping item, so an ingredient marked „(brak makro)" there is the one left out here. Unit and amount reasons apply only to macros; the shopping list still sums the item in its own unit. It never converts units (a `kg` line and a `g` line of the same ingredient stay separate items), because it computes no macros, so `toGrams` does not apply there.
- Review Focus #1 (zero servings) is handled by `perServing` returning null, and the DB check `servings_base > 0` prevents it for stored recipes anyway.

## Known gaps

- No conversion for household units (łyżka, łyżeczka, szklanka, szt → grams); those ingredients are left out and reported. Per-ingredient density for volume is #74.
- Day totals don't name the left-out ingredients or recipes; only the recipe page does.
- PR #93 (recipe detail redesign, not merged) adds its own all-or-nothing `recipePerServing`; it should adopt `recipeMacros` instead.

## Examples

```ts
toGrams(0.2, 'kg'); // → 200
toGrams(2, 'łyżka'); // → null
recipeMacros(
  [
    { amount: 200, unit: 'g', optional: false, ingredients: { name: 'ryż', kcal_per_100g: 350, protein_per_100g: 7, fat_per_100g: 1, carbs_per_100g: 78 } },
    { amount: 2, unit: 'łyżka', optional: false, ingredients: { name: 'oliwa', kcal_per_100g: 900, protein_per_100g: 0, fat_per_100g: 100, carbs_per_100g: 0 } },
  ],
  2,
);
// → { total: { kcal: 700, … }, perServing: { kcal: 350, … }, complete: false,
//     leftOut: [{ name: 'oliwa', reason: 'unit' }] }
```

## Related

- [[concepts]]
- [[ingredient-database]]
- [[amount-scaling]]
- [[recipe-management]]
- [[shopping-list-aggregation]]
- [[week-plan]]
- [[0006-macros-per-100g]]

## Sources

- `src/lib/macros.ts`, `tests/unit/macros.test.ts`
- `src/app/(app)/recipes/[id]/page.tsx`, `src/components/recipes/RecipeMacroPanel.tsx`, `src/components/recipes/MacroSummary.tsx`, `tests/unit/recipe-macros-view.test.tsx`
- `src/lib/day-macros.ts`, `src/components/plan/DayTotals.tsx`, `tests/unit/day-macros.test.tsx`

## Changelog

- 2026-10-13: Unknown is not zero (#73): `toGrams` (mg, g/gr, dag/dkg, kg, ml, cl, dl, l, trailing dot, `normalizeUnit` fallback), `recipeMacros` with `complete` and `leftOut`, the „makra niepełne" badge on the recipe page and labelled partial day totals. Removed the "non-gram units count as 0" and "0 kcal instead of no data" gotchas.
- 2026-10-13: Documented per-day totals in the plan (#44).
- 2026-10-09: Re-verified against a7f8f52. Documented the optional-ingredient exclusion (`ri.optional`) and dividing by `servings_base`. Reworded the unit-conversion gap and the macro-less wording. Verified claims otherwise unchanged.
- 2026-10-05: Optional ingredients are excluded from recipe macros.
- 2026-10-04: Created from the macros section of legacy `recipes.md`. Added the "0 kcal instead of no data" gotcha.
