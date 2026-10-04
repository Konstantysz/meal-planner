# Recipes

CRUD in `src/lib/db/recipes.ts` (`listRecipes`, `getRecipe`, `createRecipe`). API: `/api/recipes`, `/api/recipes/[id]`.

`RecipeForm.tsx` handles create; it also accepts optional `initialValues`/`readOnly` props (added beyond the original plan) so the edit page can preview existing data. **There is no update/PATCH endpoint yet** — `/recipes/[id]/edit` is a read-only preview only, not a working editor. Someone needs to define the update contract (schema + route) before edit-and-save works.

## Macros
Pure functions in `src/lib/macros.ts` (`calculateIngredientMacros`, `sumMacros`, `perServing`) and `src/lib/scaling.ts` (`scaleAmount`, `formatAmount`, `roundForUnit`). Null-safe by design: an ingredient with all-null macro fields returns `null` from `calculateIngredientMacros`; `perServing` returns `null` for `servings <= 0`.

On the recipe detail page, an ingredient only contributes to the displayed macro total if its `unit` is exactly `'g'` or `'ml'` — ingredients in other units (tablespoons, cups, "to taste") are silently treated as contributing 0, not flagged as incomplete. This matches the plan's given code; the "mark incomplete" behavior described in the plan's Review Focus is implemented at the shopping-list level (see [shopping.md](shopping.md)), not here.
