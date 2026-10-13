---
title: "Recipe Management"
summary: "Recipe create (atomic save_recipe RPC), edit (atomic update_recipe RPC), list with diet/allergen filters, detail and delete."
tags: [recipes, ui]
status: stable
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-13
last_reviewed: 2026-10-09
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: a7f8f52
sources:
  - title: "Recipe data access"
    path: src/lib/db/recipes.ts
  - title: "save_recipe RPC"
    path: supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql
  - title: "save_recipe RPC with optional flag"
    path: supabase/migrations/0007_recipe_ingredient_optional.sql
  - title: "update_recipe RPC"
    path: supabase/migrations/0009_update_recipe_rpc.sql
  - title: "Recipe input schema"
    path: src/lib/schemas.ts
  - title: "Recipes routes"
    path: src/app/api/recipes/route.ts
  - title: "Recipe by id route"
    path: src/app/api/recipes/[id]/route.ts
  - title: "Recipe form"
    path: src/components/recipes/RecipeForm.tsx
  - title: "Steps editor (shared by RecipeForm and ImportReviewForm)"
    path: src/components/recipes/StepsEditor.tsx
  - title: "Ingredient picker"
    path: src/components/recipes/IngredientPicker.tsx
  - title: "Recipe list and filters"
    path: src/components/recipes/RecipeList.tsx
  - title: "Detail page"
    path: src/app/(app)/recipes/[id]/page.tsx
  - title: "Edit page"
    path: src/app/(app)/recipes/[id]/edit/page.tsx
  - title: "Recipe actions"
    path: src/components/recipes/RecipeActions.tsx
  - title: "Recipe card (list cover)"
    path: src/components/recipes/RecipeCard.tsx
  - title: "Collapsible step cards"
    path: src/components/recipes/StepCards.tsx
  - title: "Ingredients with servings scaling"
    path: src/components/recipes/ScalableIngredients.tsx
  - title: "Cover colour from plan slots"
    path: src/lib/recipe-cover.ts
  - title: "Form validation messages"
    path: src/lib/recipe-form-errors.ts
---

# Recipe Management

> [!tldr]
> Recipes are created through `POST /api/recipes`, by hand (`RecipeForm`) or through import (`ImportReviewForm`). Both send a `RecipeInput`, which needs at least one ingredient and one step. The list filters by diet tags (in SQL) and excluded allergens (in JS). They are edited through `PUT /api/recipes/[id]`, which replaces the recipe's fields, ingredients and steps in one transaction and answers 403 when RLS blocks it. Delete works only for the author.

## Context

Recipes are the core entity. Plans and shopping lists are derived from them. See [[concepts]].

## How it works

| Operation | UI | API → lib |
|---|---|---|
| Create | `/recipes/new` → `RecipeForm` (or [[import-pipeline]]) | `POST /api/recipes` → `createRecipe` |
| List | `/recipes` → `RecipeList` (`RecipeCard` shelf) + `RecipeFilters` | `GET /api/recipes?diet=&exclude=` → `listRecipes` |
| Detail | `/recipes/[id]` (server component) | `getRecipe` directly |
| Edit | `/recipes/[id]/edit` → `RecipeForm` with `recipeId` | `PUT /api/recipes/[id]` → `updateRecipe` |
| Delete | `RecipeActions` „Usuń" | `DELETE /api/recipes/[id]` |

`createRecipe(supabase, input, householdId)` validates against `RecipeInputSchema`, then makes **one** call: `rpc('save_recipe', { p_household_id, p_recipe })` (migration 0006, redefined in 0007). The function inserts the recipe, its ingredients and its steps in one transaction, so a failure leaves nothing behind. It is `security invoker`, so `rec_insert`, `ri_all` and `rs_all` still apply, and the author is always `auth.uid()` (an `author_id` in the payload is ignored). It also rejects a recipe without ingredients or steps (`22023`). Each ingredient object may carry `optional`; a missing value is stored as `false`.

`updateRecipe(supabase, id, input)` validates the same `RecipeInputSchema`, then calls `rpc('update_recipe', { p_recipe_id, p_recipe })` (migration 0009). In one transaction it updates the recipe's columns (`author_id`, `household_id` and `created_at` never change), deletes all of its ingredient and step rows and inserts the submitted ones, so adding, removing and reordering need no diffing (row ids are not stable across an edit; nothing references them). It is `security invoker` like `save_recipe`, so `rec_update`, `ri_all` and `rs_all` decide. An `UPDATE` that RLS filters affects 0 rows and raises nothing, so the function raises `42501` when no row was updated; the route turns that into **403** (400 for an invalid body, 401 when signed out). Any member of the household may edit its recipes (`rec_update`), not only the author.

The edit form is `RecipeForm` with `recipeId` set (`recipeToFormValues` maps `getRecipe` output to it). It edits the name, servings, time, `source_author` („Autor przepisu"), diets, allergens, ingredient rows (add, remove, move up/down, optional) and steps (add, remove, move up/down, optional title; the step list is the shared `StepsEditor`, which `ImportReviewForm` also uses, see [[import-pipeline]]). Positions are renumbered from list order on submit; steps with blank text are dropped. `source_url` and `visibility` are carried through unchanged (no field edits them).

The list is a Steam-style shelf (design brief, [[design-brief]]): a grid of `RecipeCard`s, 2 columns at 390 px up to 5 at 1280 px. Each card has a 3:4 cover (the name set large on the slot colour, the time on top) over a hairline-separated block with the source author, servings, diet chips, allergen chips („zawiera: …") and the macros per serving. `listRecipes` returns `RecipeListItem`: the recipe plus `macros_per_serving` (`recipeMacrosPerServing`, [[macro-calculation]]) and `cover_position` (`coverPosition`: the slot position the recipe is most often planned in, the most recent on a tie, null when never planned, which the cover shows as `hover`). It reads `plan_slots` for that once, grouped per recipe, limited to the last 180 days and 1000 rows (newest first, so the cap drops the oldest); a failed read is thrown, so the list fails with the rest of the request. The cover is `relative overflow-hidden` so a photo (#43) can fill it later without a layout change; there is no image column yet. The page shows a skeleton while loading, and empty states with one action for no recipes, no match for the filters, no match for the search, and a failed load.

The detail page is a Notion-style page: a colour band (same `cover_position`), the title, „Edytuj" and „Usuń", prominent servings and time chips, diet and allergen chips, the macros per serving („brak danych makro" when `recipeMacrosPerServing` returns null), and „Źródło" (only an http or https `source_url` becomes a link; `RecipeInputSchema` rejects other schemes) with the `source_author` next to it (the author alone reads „Źródło: autor" when there is no URL). `ScalableIngredients` scales the amounts with a servings stepper (display only, the per-serving macros do not change). `StepCards` shows each step with a title as a native `<details>` (first titled step open, „Rozwiń wszystkie" / „Zwiń wszystkie"); a step without a title is a plain numbered card. `loading.tsx` shows a skeleton.

Filtering:

- `diet`: `contains('diet_tags', diet)`. A recipe must have **all** the selected diets.
- `exclude`: rows are fetched first and then filtered in JS (`!r.allergens.some(...)`).

Ingredients are added through `IngredientPicker`. It searches the full ingredient list client-side (2 or more characters, top 8), and it can create a placeholder ingredient with null macros („+ Dodaj nowy składnik"). That ingredient is inserted **immediately**, not when the recipe is saved, so it stays in the global catalog even if the recipe is never saved. Its null macros count as 0 in the recipe totals. Each picked row has an „opcjonalny" checkbox that sets `optional` (new rows default to `false`). See [[ingredient-database]].

## Invariants and gotchas

- `servings_base` must be an integer above 0 (Zod, plus a DB check). This is what keeps `perServing` from dividing by zero for stored recipes. See [[macro-calculation]].
- `visibility` defaults to `household`. No UI offers `private` or `public_link`.
- The diet and allergen values are Polish slugs without diacritics (`wegetarianska`, `mieso`), duplicated in `types.ts`, `schemas.ts`, `RecipeForm` and `RecipeFilters`. Change all four together.
- Diet and allergen slugs are shown through `DIET_LABELS` / `ALLERGEN_LABELS` (`src/lib/recipe-labels.ts`), which restore the Polish diacritics. A recipe's `allergens` mean it contains them; the „Wyklucz" filter hides recipes that do.
- The create/edit form parses the payload with `RecipeInputSchema` before sending and shows one Polish message per field (`recipeFieldErrors`); `noValidate` is set so the browser's own messages do not preempt them. A 400 from the API carries Zod `issues` that map the same way.
- The detail page shows `formatAmount(amount, unit)` followed by `raw_text`. Manual entries set `raw_text` to the ingredient name.
- Each ingredient row has an `optional` flag (the „opcjonalny" checkbox in `IngredientPicker`, migration 0007). Optional rows are left out of the recipe macros and labelled „(opcjonalnie)" on the detail page. The shopping list does **not** treat them differently. Import does not tick the box: the extractor drops the „ewentualne dodatki" label, so the user ticks it by hand.

## Known gaps

- **A non-author delete silently does nothing** (RLS filters the delete, and the API returns 204). See [[rls-authorization#Invariants and gotchas]].
- No pagination. `listRecipes` returns every visible recipe.

## Examples

```json
{
  "name": "Zupa pomidorowa", "servings_base": 4, "prep_time_min": 30,
  "source_url": null, "visibility": "household",
  "diet_tags": ["wegetarianska"], "allergens": [],
  "ingredients": [{ "ingredient_id": "<uuid>", "amount": 500, "unit": "g", "raw_text": "pomidor", "position": 0 }],
  "steps": [{ "position": 0, "text": "Pokrój pomidory." }]
}
```

## Related

- [[concepts]]
- [[macro-calculation]]
- [[ingredient-database]]
- [[import-pipeline]]
- [[api-routes]]

## Sources

- `src/lib/db/recipes.ts`, `src/lib/schemas.ts`, `src/app/api/recipes/**`
- `src/components/recipes/*`, `src/app/(app)/recipes/**`
- `supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql`, `supabase/migrations/0007_recipe_ingredient_optional.sql`, `supabase/migrations/0009_update_recipe_rpc.sql`

## Changelog

- 2026-10-13: Recipe list as cover cards and detail as a Notion-style page with collapsible titled steps and ingredient scaling; form shows field-level messages instead of raw Zod JSON (#39).
- 2026-10-13: Step editing extracted into `StepsEditor` and reused by the import review form.
- 2026-10-13: Added editing (`update_recipe` RPC, migration 0009, `PUT /api/recipes/[id]`, editable `RecipeForm`); removed the no-update gap. Live results pending.
- 2026-10-09: Re-verified against a7f8f52; added the `optional` ingredient flag (migration 0007, picker checkbox, detail-page macro exclusion), and noted that `save_recipe` is redefined there.
- 2026-10-05: Documented the `optional` ingredient flag (0007).
- 2026-10-04: Create goes through the `save_recipe` RPC (0006); removed the non-transactional gap. Noted that picker-created ingredients persist even when the save fails.
- 2026-10-04: Created from legacy `recipes.md`. Added filters, delete behaviour and the duplicated enum lists.
