---
title: "Recipe Management"
summary: "Recipe create (atomic save_recipe RPC), edit (atomic update_recipe RPC, author or app admin), fork (fork_recipe RPC) for everyone else, list with diet/allergen filters, detail and delete."
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
verified_commit: 68dcc28
sources:
  - title: "Recipe data access"
    path: src/lib/db/recipes.ts
  - title: "save_recipe RPC"
    path: supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql
  - title: "save_recipe RPC with optional flag"
    path: supabase/migrations/0007_recipe_ingredient_optional.sql
  - title: "update_recipe RPC"
    path: supabase/migrations/0009_update_recipe_rpc.sql
  - title: "fork_recipe RPC and author-only recipe writes"
    path: supabase/migrations/0014_recipe_fork.sql
  - title: "Fork route"
    path: src/app/api/recipes/[id]/fork/route.ts
  - title: "Fork button"
    path: src/components/recipes/ForkEditButton.tsx
  - title: "Edit access"
    path: src/lib/recipe-access.ts
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
  - title: "Recipe list and filters"
    path: src/components/recipes/RecipeList.tsx
  - title: "Detail page"
    path: src/app/(app)/recipes/[id]/page.tsx
  - title: "Edit page"
    path: src/app/(app)/recipes/[id]/edit/page.tsx
  - title: "Recipe actions"
    path: src/components/recipes/RecipeActions.tsx
---

# Recipe Management

> [!tldr]
> Recipes are created through `POST /api/recipes`, by hand (`RecipeForm`) or through import (`ImportReviewForm`). Both send a `RecipeInput`, which needs at least one ingredient and one step. The list filters by diet tags (in SQL) and excluded allergens (in JS). Only the member who saved a recipe (`author_id`) or an app admin edits it in place, through `PUT /api/recipes/[id]`, which replaces the recipe's fields, ingredients and steps in one transaction. Anyone else edits a [[0015-recipe-forks|fork]]: „Edytuj" copies the recipe first and opens the copy. Refused edits and deletes answer 403.

## Context

Recipes are the core entity. Plans and shopping lists are derived from them. See [[concepts]].

## How it works

| Operation | UI | API → lib |
|---|---|---|
| Create | `/recipes/new` → `RecipeForm` (or [[import-pipeline]]) | `POST /api/recipes` → `createRecipe` |
| List | `/recipes` → `RecipeList` + `RecipeFilters` | `GET /api/recipes?diet=&exclude=` → `listRecipes` |
| Detail | `/recipes/[id]` (server component) | `getRecipe` directly |
| Edit | `/recipes/[id]/edit` → `RecipeForm` with `recipeId` | `PUT /api/recipes/[id]` → `updateRecipe` |
| Fork | `RecipeActions` „Edytuj" (or „Utwórz kopię i edytuj" on the edit page) → `ForkEditButton` | `POST /api/recipes/[id]/fork` → `forkRecipe` |
| Delete | `RecipeActions` „Usuń" (author or app admin only) | `DELETE /api/recipes/[id]` → `deleteRecipe` |

`createRecipe(supabase, input, householdId)` validates against `RecipeInputSchema`, then makes **one** call: `rpc('save_recipe', { p_household_id, p_recipe })` (migration 0006, redefined in 0007). The function inserts the recipe, its ingredients and its steps in one transaction, so a failure leaves nothing behind. It is `security invoker`, so `rec_insert`, `ri_insert` and `rs_insert` (`ri_all` and `rs_all` before 0014) still apply, and the author is always `auth.uid()` (an `author_id` in the payload is ignored). It also rejects a recipe without ingredients or steps (`22023`). Each ingredient object may carry `optional`; a missing value is stored as `false`.

`updateRecipe(supabase, id, input)` validates the same `RecipeInputSchema`, then calls `rpc('update_recipe', { p_recipe_id, p_recipe })` (migration 0009). In one transaction it updates the recipe's columns (`author_id`, `household_id` and `created_at` never change), deletes all of its ingredient and step rows and inserts the submitted ones, so adding, removing and reordering need no diffing (row ids are not stable across an edit; nothing references them). It is `security invoker` like `save_recipe`, so `rec_update` and the `ri_*` / `rs_*` write policies decide. An `UPDATE` that RLS filters affects 0 rows and raises nothing, so the function raises `42501` when no row was updated; the route turns that into **403** (400 for an invalid body or a known client database error with a fixed message, 401 when signed out, 500 with a generic message for anything else, logged server-side). Since migration 0014 only the author or an app admin passes `rec_update`, so another member's call raises `42501` too.

### Who edits, and forks

`canEditRecipe(recipe, userId, isAdmin)` (`src/lib/recipe-access.ts`) mirrors the 0014 policies: the author or an app admin (`isAppAdmin`, the `is_app_admin` RPC). The detail and edit pages compute it server-side; it only picks the UI, RLS enforces the rule.

- Author or app admin: `RecipeActions` shows the „Edytuj" link to `/recipes/[id]/edit` and „Usuń".
- Anyone else: `RecipeActions` shows „Edytuj" as `ForkEditButton` and no „Usuń". The click calls `POST /api/recipes/[id]/fork`, then opens `/recipes/<fork>/edit`. Opening `/recipes/[id]/edit` directly shows „Utwórz kopię i edytuj" instead of the form: forking is a write, so it waits for a click rather than running on page load.

`forkRecipe(supabase, id)` calls `rpc('fork_recipe', { p_recipe_id })` (migration 0014) and returns the new id. In one transaction the function copies the recipe's columns (name, servings, prep time, source URL, source author, visibility, diets, allergens), its recipe ingredients (with `optional`) and its steps (with titles) into a new recipe authored by the caller, with `forked_from_id` pointing at the source. The fork goes into the source's household when the caller is a member (the normal case), otherwise into the caller's own household. It is `security invoker`: the reads and inserts are ones RLS already allows. A recipe the caller cannot read raises `P0002` (404); 401 when signed out, 500 with a generic message otherwise. The original is never changed, and plan slots keep pointing at the recipe they were planned with. The detail page of a fork shows „Kopia innego przepisu." with a link to the original (while it exists; deleting it sets `forked_from_id` to null).

`deleteRecipe(supabase, id)` deletes with `.select('id')` and reports whether a row went. `rec_delete` hides recipes the caller may not delete, so 0 rows means refused (or unknown id) and the route answers **403** instead of 204.

### Edit form

The edit form is `RecipeForm` with `recipeId` set (`recipeToFormValues` maps `getRecipe` output to it). It edits the name, servings, time, `source_author` („Autor przepisu"), diets, allergens, ingredient rows (add, remove, move up/down, optional) and steps (add, remove, move up/down, optional title). Positions are renumbered from list order on submit; steps with blank text are dropped. `source_url` and `visibility` are carried through unchanged (no field edits them).

Filtering:

- `diet`: `contains('diet_tags', diet)`. A recipe must have **all** the selected diets.
- `exclude`: rows are fetched first and then filtered in JS (`!r.allergens.some(...)`).

Ingredients are added through `IngredientPicker`. It searches the full ingredient list client-side (2 or more characters, top 8), and it can create a placeholder ingredient with null macros („+ Dodaj nowy składnik"). That ingredient is inserted **immediately**, not when the recipe is saved, so it stays in the global catalog even if the recipe is never saved. Its null macros count as 0 in the recipe totals. Each picked row has an „opcjonalny" checkbox that sets `optional` (new rows default to `false`). See [[ingredient-database]].

## Invariants and gotchas

- `servings_base` must be an integer above 0 (Zod, plus a DB check). This is what keeps `perServing` from dividing by zero for stored recipes. See [[macro-calculation]].
- `visibility` defaults to `household`. No UI offers `private` or `public_link`.
- The diet and allergen values are Polish slugs without diacritics (`wegetarianska`, `mieso`), duplicated in `types.ts`, `schemas.ts`, `RecipeForm` and `RecipeFilters`. Change all four together.
- The detail page shows servings and prep time (when set) as two bordered chips under the title (plain `<li>` with the `rounded-control border-line` tokens, not the interactive `Chip` primitive). Visual treatment is left to the redesign.
- The detail page shows `formatAmount(amount, unit)` followed by `raw_text`. Manual entries set `raw_text` to the ingredient name.
- Each ingredient row has an `optional` flag (the „opcjonalny" checkbox in `IngredientPicker`, migration 0007). Optional rows are left out of the recipe macros and labelled „(opcjonalnie)" on the detail page. The shopping list does **not** treat them differently. Import does not tick the box: the extractor drops the „ewentualne dodatki" label, so the user ticks it by hand.

## Known gaps

- **Edits are last-write-wins.** `update_recipe` replaces everything with no version precondition and `recipes` has no `updated_at`, so two sessions editing the same recipe (the author on two devices, or the author and an app admin) silently overwrite each other. Accepted for now; a fix needs an `updated_at` column plus a mismatch error mapped to 409.
- An author who has left the household cannot edit their old recipe: `rec_update` USING passes but WITH CHECK (`is_member_of`) fails, so the RPC raises `42501` (403). Covered by check 9 in the 0009 verify script.
- A fork does not follow later changes to its original, and nothing merges a fork back. Forks of forks point at their direct source.
- An app admin edits only recipes they can read (a household they belong to): `rec_select` is unchanged.
- No pagination. `listRecipes` returns every visible recipe.
- A failed save shows the raw Zod error JSON (e.g. `too_small` on `steps`) instead of a Polish message.

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
- [[0015-recipe-forks]]
- [[rls-authorization]]

## Sources

- `src/lib/db/recipes.ts`, `src/lib/schemas.ts`, `src/app/api/recipes/**`
- `src/components/recipes/*`, `src/app/(app)/recipes/**`
- `supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql`, `supabase/migrations/0007_recipe_ingredient_optional.sql`, `supabase/migrations/0009_update_recipe_rpc.sql`, `supabase/migrations/0014_recipe_fork.sql`
- `src/lib/recipe-access.ts`, `src/lib/db/app-admins.ts`

## Changelog

- 2026-10-13: Recipe forks (migration 0014, issue #75): only the author or an app admin edits or deletes in place; others fork via `POST /api/recipes/[id]/fork`. A refused delete now answers 403; removed the silent-delete gap. Live results pending.
- 2026-10-13: Added editing (`update_recipe` RPC, migration 0009, `PUT /api/recipes/[id]`, editable `RecipeForm`); removed the no-update gap. Live results pending.
- 2026-10-09: Re-verified against a7f8f52; added the `optional` ingredient flag (migration 0007, picker checkbox, detail-page macro exclusion), and noted that `save_recipe` is redefined there.
- 2026-10-05: Documented the `optional` ingredient flag (0007).
- 2026-10-04: Create goes through the `save_recipe` RPC (0006); removed the non-transactional gap. Noted that picker-created ingredients persist even when the save fails.
- 2026-10-04: Created from legacy `recipes.md`. Added filters, delete behaviour and the duplicated enum lists.
