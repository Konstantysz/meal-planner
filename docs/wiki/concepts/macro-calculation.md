---
title: "Macro Calculation"
summary: "How kcal/protein/fat/carbs are computed from per-100g ingredient data into per-serving recipe values, and the null-safety rules."
tags: [macros, recipes]
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
  - title: "Macro functions"
    path: src/lib/macros.ts
  - title: "Recipe detail page"
    path: src/app/(app)/recipes/[id]/page.tsx
  - title: "Macro summary component"
    path: src/components/recipes/MacroSummary.tsx
  - title: "Macro tests"
    path: tests/unit/macros.test.ts
---

# Macro Calculation

> [!tldr]
> Macros are stored per 100 g on ingredients and computed per serving for recipes, never stored. Only ingredients measured in `g` or `ml` count toward the total; any other unit silently contributes 0. `perServing` returns null for 0 or fewer servings.

## Context

The plan's rule was "macros per 100 g in the ingredient database, per serving in recipes". See [[concepts]] and [[ingredient-database]]. Abbreviations are in the [[glossary]].

## How it works

All functions are in `src/lib/macros.ts` and are pure:

| Function | Behaviour |
|---|---|
| `calculateIngredientMacros(ing, grams)` | `null` if **all four** per-100g fields are null. Otherwise each field is `(value ?? 0) * grams / 100`. |
| `sumMacros(list)` | Adds the list up and skips `null` entries. An empty or all-null list gives `{0,0,0,0}`. |
| `perServing(total, servings)` | `null` if `servings <= 0`, otherwise each field divided by `servings` |

The recipe detail page combines them, dividing by the recipe's base servings (`servings_base`):

```ts
const total = sumMacros(recipe.ingredients.map((ri) => {
  if (!ri.ingredients || ri.optional) return null;
  const grams = ri.unit === 'g' || ri.unit === 'ml' ? (ri.amount ?? 0) : 0;
  return calculateIngredientMacros(ri.ingredients, grams);
}));
const per = perServing(total, recipe.servings_base);
```

`MacroSummary` renders `null` as „brak danych makro". Otherwise it shows `kcal · B · T · W`.

## Invariants and gotchas

- **`ml` is treated as `g`.** There's no density conversion.
- **Non-gram units count as 0, not as "unknown".** „2 łyżki oliwy" adds nothing, and nothing flags the total as partial.
- **A macro-less ingredient is skipped; it doesn't zero the total.** An ingredient with only some macros counts the missing fields as 0.
- **Optional recipe ingredients are skipped.** The detail page returns null for `ri.optional`, so they add nothing to the total, although they are listed on the page with „(opcjonalnie)".
- A recipe where nothing has macros shows **„0 kcal · B 0.0 …"**, not „brak danych makro", because `sumMacros` returns zeros and `servings_base` is always above 0.
- Review Focus #1 (zero servings) is handled by `perServing` returning null, and the DB check `servings_base > 0` prevents it for stored recipes anyway.

## Known gaps

- No unit conversion (łyżka, szklanka, szt → grams). Recipes that use those units count as 0, so their totals come out low. The import parser recognises these units (`src/lib/import/parse-ingredient.ts`), but nothing converts them.
- No "incomplete" flag at the recipe level. The plan's Review Focus #5 marking exists only on the shopping list (see [[shopping-list-aggregation]]).
- Per-day totals in the plan are a stub (see [[week-plan#Known gaps]]).

## Examples

```ts
calculateIngredientMacros({ kcal_per_100g: 884, protein_per_100g: 0, fat_per_100g: 100, carbs_per_100g: 0 }, 20);
// → { kcal: 176.8, protein: 0, fat: 20, carbs: 0 }
perServing({ kcal: 800, protein: 40, fat: 30, carbs: 90 }, 0); // → null
```

## Related

- [[concepts]]
- [[ingredient-database]]
- [[amount-scaling]]
- [[recipe-management]]
- [[shopping-list-aggregation]]
- [[0006-macros-per-100g]]

## Sources

- `src/lib/macros.ts`, `tests/unit/macros.test.ts`
- `src/app/(app)/recipes/[id]/page.tsx`, `src/components/recipes/MacroSummary.tsx`

## Changelog

- 2026-10-09: Re-verified against a7f8f52. Documented the optional-ingredient exclusion (`ri.optional`) and dividing by `servings_base`. Reworded the unit-conversion gap and the macro-less wording. Verified claims otherwise unchanged.
- 2026-10-04: Created from the macros section of legacy `recipes.md`. Added the "0 kcal instead of no data" gotcha.
