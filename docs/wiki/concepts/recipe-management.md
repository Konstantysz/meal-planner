---
title: "Recipe Management"
summary: "Recipe create, list with diet/allergen filters, detail, delete, and the read-only edit page; the non-transactional insert."
tags: [recipes, ui]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 90
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 656711c
sources:
  - title: "Recipe data access"
    path: src/lib/db/recipes.ts
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
> Recipes are created through `POST /api/recipes`, by hand (`RecipeForm`) or through import (`ImportReviewForm`). Both send a `RecipeInput`, which needs at least one ingredient and one step. The list filters by diet tags (in SQL) and excluded allergens (in JS). **There is no update**: the edit page is a read-only preview. Delete works only for the author.

## Context

Recipes are the core entity. Plans and shopping lists are derived from them. See [[concepts]].

## How it works

| Operation | UI | API → lib |
|---|---|---|
| Create | `/recipes/new` → `RecipeForm` (or [[import-pipeline]]) | `POST /api/recipes` → `createRecipe` |
| List | `/recipes` → `RecipeList` + `RecipeFilters` | `GET /api/recipes?diet=&exclude=` → `listRecipes` |
| Detail | `/recipes/[id]` (server component) | `getRecipe` directly |
| Edit | `/recipes/[id]/edit`, `RecipeForm readOnly` | none (no save) |
| Delete | `RecipeActions` „Usuń" | `DELETE /api/recipes/[id]` |

`createRecipe` validates against `RecipeInputSchema`, then runs **three separate inserts**: `recipes`, then `recipe_ingredients`, then `recipe_steps`.

Filtering:

- `diet`: `contains('diet_tags', diet)`. A recipe must have **all** the selected diets.
- `exclude`: rows are fetched first and then filtered in JS (`!r.allergens.some(...)`).

Ingredients are added through `IngredientPicker`. It searches the full ingredient list client-side (2 or more characters, top 8), and it can create a bare ingredient with null macros („+ Dodaj nowy składnik"). See [[ingredient-database]].

## Invariants and gotchas

- `servings_base` must be an integer above 0 (Zod, plus a DB check). This is what keeps `perServing` from dividing by zero for stored recipes. See [[macro-calculation]].
- `visibility` defaults to `household`. No UI offers `private` or `public_link`.
- The diet and allergen values are Polish slugs without diacritics (`wegetarianska`, `mieso`), duplicated in `types.ts`, `schemas.ts`, `RecipeForm` and `RecipeFilters`. Change all four together.
- The detail page shows `formatAmount(amount, unit)` followed by `raw_text`. Manual entries set `raw_text` to the ingredient name.

## Known gaps

- **No update endpoint.** The edit page says „Zapis zmian nie jest jeszcze wspierany". Building one needs an update schema and has to decide how to replace ingredients and steps.
- **Non-transactional create.** If the ingredient or step insert fails, the `recipes` row stays behind with no children. The fix is a Postgres RPC that does all three inserts.
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

## Changelog

- 2026-10-04: Created from legacy `recipes.md`. Added filters, delete behaviour and the duplicated enum lists.
