---
title: "Recipe Management"
summary: "Recipe create (atomic save_recipe RPC), edit (atomic update_recipe RPC), list with diet/allergen filters, detail and delete."
tags: [recipes, ui]
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
verified_commit: 5ddfe28
sources:
  - title: "Recipe data access"
    path: src/lib/db/recipes.ts
  - title: "save_recipe RPC"
    path: supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql
  - title: "save_recipe RPC with optional flag"
    path: supabase/migrations/0007_recipe_ingredient_optional.sql
  - title: "update_recipe RPC"
    path: supabase/migrations/0009_update_recipe_rpc.sql
  - title: "Recipe photo URL"
    path: supabase/migrations/0011_recipe_image_url.sql
  - title: "Photo layer"
    path: src/components/recipes/RecipePhoto.tsx
  - title: "Allowed image hosts"
    path: src/lib/image-hosts.ts
  - title: "Schema integrity (row rules, account deletion, updated_at)"
    path: supabase/migrations/0013_schema_integrity.sql
  - title: "Recipe input schema"
    path: src/lib/schemas.ts
  - title: "Recipes routes"
    path: src/app/api/recipes/route.ts
  - title: "Recipe by id route"
    path: src/app/api/recipes/[id]/route.ts
  - title: "Recipe form"
    path: src/components/recipes/RecipeForm.tsx
  - title: "Ingredient picker"
    path: src/components/recipes/IngredientPicker.tsx
  - title: "Step list editor"
    path: src/components/recipes/StepsEditor.tsx
  - title: "Recipe list and filters"
    path: src/components/recipes/RecipeList.tsx
  - title: "Detail page"
    path: src/app/(app)/recipes/[id]/page.tsx
  - title: "Edit page"
    path: src/app/(app)/recipes/[id]/edit/page.tsx
  - title: "Recipe cards, cover and tags"
    path: src/components/recipes/RecipeCard.tsx
  - title: "Collapsible steps"
    path: src/components/recipes/RecipeSteps.tsx
  - title: "Scaled ingredients"
    path: src/components/recipes/RecipeIngredients.tsx
  - title: "Field-level validation messages"
    path: src/lib/recipe-errors.ts
  - title: "Recipe actions"
    path: src/components/recipes/RecipeActions.tsx
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
| List | `/recipes` → `RecipeList` + `RecipeFilters`, one `RecipeCard` per recipe | `GET /api/recipes?diet=&exclude=` → `listRecipes` |
| Detail | `/recipes/[id]` (server component) | `getRecipe` directly |
| Edit | `/recipes/[id]/edit` → `RecipeForm` with `recipeId` | `PUT /api/recipes/[id]` → `updateRecipe` |
| Delete | `RecipeActions` „Usuń" | `DELETE /api/recipes/[id]` |

`createRecipe(supabase, input, householdId)` validates against `RecipeInputSchema`, then makes **one** call: `rpc('save_recipe', { p_household_id, p_recipe })` (migration 0006, redefined in 0007). The function inserts the recipe, its ingredients and its steps in one transaction, so a failure leaves nothing behind. It is `security invoker`, so `rec_insert`, `ri_all` and `rs_all` still apply, and the author is always `auth.uid()` (an `author_id` in the payload is ignored). It also rejects a recipe without ingredients or steps (`22023`). Each ingredient object may carry `optional`; a missing value is stored as `false`.

`updateRecipe(supabase, id, input)` validates the same `RecipeInputSchema`, then calls `rpc('update_recipe', { p_recipe_id, p_recipe })` (migration 0009). In one transaction it updates the recipe's columns (`author_id`, `household_id` and `created_at` never change), deletes all of its ingredient and step rows and inserts the submitted ones, so adding, removing and reordering need no diffing (row ids are not stable across an edit; nothing references them). It is `security invoker` like `save_recipe`, so `rec_update`, `ri_all` and `rs_all` decide. An `UPDATE` that RLS filters affects 0 rows and raises nothing, so the function raises `42501` when no row was updated; the route turns that into **403** (400 for an invalid body or a known client database error with a fixed message, 401 when signed out, 500 with a generic message for anything else, logged server-side). Any member of the household may edit its recipes (`rec_update`), not only the author.

The edit form is `RecipeForm` with `recipeId` set (`recipeToFormValues` maps `getRecipe` output to it). It edits the name, servings, time, `source_author` („Autor przepisu"), diets, allergens, ingredient rows (add, remove, move up/down, optional) and steps (add, remove, move up/down, optional title). Positions are renumbered from list order on submit; steps with blank text are dropped. It also edits the photo URL („Zdjęcie (adres URL)"); a blank value clears it. `source_url` and `visibility` are carried through unchanged (no field edits them).

Photo: `recipes.image_url` (0011) is a hotlinked https URL on a host from `IMAGE_HOSTS` in `src/lib/image-hosts.ts`; `RecipeInputSchema` rejects other hosts and `next.config.ts` allows the same hosts for `next/image`. The detail page shows it in a 16:9 band above the title with a „Zdjęcie: <host>" credit (host of the photo URL), and the band (`RecipePhotoBand`) renders nothing when the URL fails to load. `update_recipe` sets `image_url` to null when the payload omits it, so editing clients send the stored value. Reasoning: [[0014-recipe-photos-hotlinked]]. The list cards do not show the photo yet; `RecipePhoto` is the layer for the redesigned cover ([[design-brief]]).

Filtering:

- `diet`: `contains('diet_tags', diet)`. A recipe must have **all** the selected diets.
- `exclude`: rows are fetched first and then filtered in JS (`!r.allergens.some(...)`).

Ingredients are added through `IngredientPicker`. It searches the full ingredient list client-side (2 or more characters, top 8), and it can create a placeholder ingredient with null macros („+ Dodaj nowy składnik"). That ingredient is inserted **immediately**, not when the recipe is saved, so it stays in the global catalog even if the recipe is never saved. Its null macros count as 0 in the recipe totals. Each picked row has an „opcjonalny" checkbox that sets `optional` (new rows default to `false`). See [[ingredient-database]].

## Invariants and gotchas

- `servings_base` must be an integer above 0 (Zod, plus a DB check). This is what keeps `perServing` from dividing by zero for stored recipes. See [[macro-calculation]].
- **Row rules (migration 0013).** Ingredient and step positions are unique per recipe and `>= 0`, an ingredient `amount` is null or `> 0`, and step text must contain a non-space character. The database enforces them (unique and check constraints) and `RecipeInputSchema` mirrors them, so a bad body is a 400 before the RPC runs. The forms renumber positions from list order and drop blank steps. An amount of 0 or less is sent as null („no amount", `positiveAmountOrNull` in `src/lib/scaling.ts`): auto-match maps the import model's amount that way, and `RecipeForm` and `ImportReviewForm` map a typed amount on submit. Only a direct API caller sending 0 gets a 400.
- **`updated_at`** is set to `now()` by a database trigger on every update of the recipe row, whatever the client sends. `update_recipe` always updates that row, so every edit moves it; a direct write to `recipe_ingredients` or `recipe_steps` alone does not.
- **Deleting the account that saved a recipe** keeps the recipe in its household with `author_id` null (migration 0013). Members still see and edit it (`rec_select`, `rec_update` pass on membership).
- `visibility` defaults to `household`. No UI offers `private` or `public_link`.
- The diet and allergen values are Polish slugs without diacritics (`wegetarianska`, `mieso`), duplicated in `types.ts`, `schemas.ts`, `RecipeForm` and `RecipeFilters`. Change all four together.
- **List cards** (`RecipeCard`): a 3:4 `RecipeCover` (name set large, prep time on top), then source author (when set), servings, per-serving macros, and diet and allergen tags. The cover has a `photo` slot, so a future image fills it without a layout change; its tint is `hover` until covers take the colour of the most-planned slot position (see [[design-brief]]). The grid is 2 columns on mobile and up to 5 on wide screens (the brief's horizontal shelves are not built). The filters are `Chip` toggles. States: skeleton covers while loading, „Brak przepisów. Dodaj pierwszy." with one action, a message for no filter match, for no search match and for a failed fetch.
- `listRecipes` also selects each recipe's ingredient macro columns and returns `RecipeListItem` (`Recipe` plus `macros_per_serving`, from `toListItem` and `recipePerServing`). `WeekPlan` reads the same endpoint and ignores the extra field.
- **Per-serving macros** use the rule of the day totals ([[week-plan]]): when any counted ingredient lacks data (a non-gram unit, no macros, or none counted) the value is null and the UI shows „brak danych makro". The detail page used to show a partial sum.
- **Detail page**: cover band, title, servings and prep time as large tags (plain `RecipeTag`, not the interactive `Chip`), diet and allergen tags, a property list („Na porcję"; „Autor" with the „Źródło" link next to it), then ingredients beside steps on wide screens (one column on mobile).
- `RecipeIngredients` shows `formatAmount(amount, unit)` followed by `raw_text`, with a servings stepper that scales amounts from `servings_base` through `scaleAmount`. Macros per serving do not change with it. Manual entries set `raw_text` to the ingredient name.
- `RecipeSteps` renders each step as a `<details>` card. A step with a title shows it in the summary and its text when open; a step without one is a numbered card whose text is the summary (two lines closed). The first step starts open; „Rozwiń wszystkie" / „Zwiń wszystkie" toggles all (hidden for a single step).
- Each ingredient row has an `optional` flag (the „opcjonalny" checkbox in `IngredientPicker`, migration 0007). Optional rows are left out of the recipe macros and labelled „(opcjonalnie)" on the detail page. The shopping list does **not** treat them differently. Import does not tick the box: the extractor drops the „ewentualne dodatki" label, so the user ticks it by hand.

## Known gaps

- **A non-author delete silently does nothing** (RLS filters the delete, and the API returns 204). See [[rls-authorization#Invariants and gotchas]].
- **Edits are last-write-wins.** `update_recipe` replaces everything with no version precondition, so two household members editing the same recipe silently overwrite each other. `recipes.updated_at` exists since migration 0013; the fix still needs `update_recipe` to compare it and a mismatch error mapped to 409.
- **A recipe whose author's account was deleted cannot be deleted** through the API: `rec_delete` allows only `author_id = auth.uid()`, and `author_id` is null. Only the SQL editor can remove it.
- An author who has left the household cannot edit their old recipe: `rec_update` USING passes but WITH CHECK (`is_member_of`) fails, so the RPC raises `42501` (403). Covered by check 9 in the verify script.
- No pagination. `listRecipes` returns every visible recipe.

## Validation messages

`POST /api/recipes` and `PUT /api/recipes/[id]` answer an invalid body with 400 `{ error: 'nieprawidłowe dane przepisu', fields }`, where `fields` maps a form field (`name`, `servings_base`, `prep_time_min`, `source_author`, `ingredients`, `steps`, ...) to one Polish message from `recipeFieldErrors`. `RecipeForm` shows each message under its field; an issue inside an item (`steps.0.text`) is reported on the list field. Duplicate positions (the 0013 row rules, only reachable from a direct API call) report „Składniki mają powtórzone pozycje" / „Kroki mają powtórzone pozycje"; an amount of 0 or less reports its row („Popraw składnik nr N"). `ImportReviewForm` joins the `fields` messages into one line, or shows a status message when there are none.

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
- [[0014-recipe-photos-hotlinked]]
- [[api-routes]]
- [[design-brief]]
- [[week-plan]]

## Sources

- `src/lib/db/recipes.ts`, `src/lib/schemas.ts`, `src/app/api/recipes/**`
- `src/components/recipes/*`, `src/app/(app)/recipes/**`
- `supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql`, `supabase/migrations/0007_recipe_ingredient_optional.sql`, `supabase/migrations/0009_update_recipe_rpc.sql`

## Changelog

- 2026-10-13: `recipeFieldErrors` reports duplicate positions as such instead of „Dodaj co najmniej jeden …".
- 2026-10-13: Recipe list and detail as cards with collapsible, titled steps, scaling and field-level form errors (#39); removed the raw-Zod-JSON gap.
- 2026-10-13: Added the recipe photo (`image_url`, migration 0011, `RecipePhoto`, form field, detail band). Status set to `review` for the edit.
- 2026-10-13: Import and the forms now send an amount of 0 or less as null instead of failing the save.
- 2026-10-13: Documented the row rules, `updated_at` and account-deletion behaviour from migration 0013 (#72), and the matching `RecipeInputSchema` checks; the last-write-wins gap now only lacks the version check; added the author-less recipe delete gap.
- 2026-10-13: Step editing extracted into `StepsEditor`, shared with the import review form (#35).
- 2026-10-13: Added editing (`update_recipe` RPC, migration 0009, `PUT /api/recipes/[id]`, editable `RecipeForm`); removed the no-update gap. Live results pending.
- 2026-10-09: Re-verified against a7f8f52; added the `optional` ingredient flag (migration 0007, picker checkbox, detail-page macro exclusion), and noted that `save_recipe` is redefined there.
- 2026-10-05: Documented the `optional` ingredient flag (0007).
- 2026-10-04: Create goes through the `save_recipe` RPC (0006); removed the non-transactional gap. Noted that picker-created ingredients persist even when the save fails.
- 2026-10-04: Created from legacy `recipes.md`. Added filters, delete behaviour and the duplicated enum lists.
