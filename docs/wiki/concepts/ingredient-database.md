---
title: "Ingredient Database"
summary: "The shared, crowd-sourced ingredients table: macros per 100 g, Open Food Facts lookup and category guessing, and how rows get created."
tags: [ingredients, macros]
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
  - title: "Ingredient data access"
    path: src/lib/db/ingredients.ts
  - title: "Open Food Facts client"
    path: src/lib/off.ts
  - title: "Ingredient routes"
    path: src/app/api/ingredients/route.ts
  - title: "OFF lookup route"
    path: src/app/api/ingredients/lookup/route.ts
  - title: "Macro backfill script"
    path: scripts/backfill-ingredient-macros.ts
  - title: "Seed"
    path: supabase/seed.sql
  - title: "Open Food Facts"
    url: "https://world.openfoodfacts.org"
    accessed: 2026-10-04
---

# Ingredient Database

> [!tldr]
> `ingredients` is one global table, not scoped to a household. It stores nullable macros **per 100 g** and has a case-insensitive unique name. Rows come from the 40-row seed, from manual creation (macros all null), or from Open Food Facts (OFF) through `/api/ingredients/lookup`. Any signed-in user can create or edit any row.

## Context

Recipe macros, the shopping list's `incomplete` flag and import auto-matching all read this table. See [[concepts]], [[macro-calculation]] and [[ingredient-auto-match]].

## How it works

| Source | `source` | Path |
|---|---|---|
| Seed | `off` | `supabase/seed.sql` (40 rows) |
| Manual "add new" in the picker | `manual` | `IngredientPicker.createAndAdd` → `POST /api/ingredients`, all macros null, category `inne` |
| OFF candidate during import | `off` | `ImportReviewForm` → `POST /api/ingredients` with `mapOffProduct` output |
| Import fallback with no match | `manual` | Like manual: bare name, null macros |
| `ai_estimate` | n/a | Allowed by the schema, but nothing writes it |

`searchOff(query)` calls the OFF `cgi/search.pl` endpoint with `page_size=5` and returns the products that have a name and at least one macro. On a non-OK response or a parse failure it returns `[]`. `guessCategory` maps OFF `categories_tags` keywords (vegetable, fruit, meat…) to the 11 Polish categories, with `inne` as the fallback.

## Invariants and gotchas

- **Per 100 g, always.** `default_unit` (`g`/`ml`) is a hint for the picker, not a conversion factor. There is no density or piece-weight data, so 1 „łyżka" can't be turned into grams.
- `lower(name)` is unique. Creating „Cebula" when „cebula" exists fails, and the picker's `createAndAdd` then silently does nothing (`if (!res.ok) return`).
- The seed isn't idempotent (no `on conflict`).
- `recipe_ingredients.ingredient_id` has no on-delete action, and there is no delete policy, so ingredients can't be deleted.

## Known gaps

- Any signed-in user can overwrite any ingredient's macros (`ing_update`). That is intentional, per the plan, but nothing records who changed what.
- Macro-less placeholders pile up from import and manual creation. `scripts/backfill-ingredient-macros.ts` (service-role key, `--dry-run`) re-queries OFF for them and takes the first hit as-is.
- `GET /api/ingredients` returns the whole table. The picker filters client-side.

## Examples

```bash
# OFF lookup through the app
curl 'http://localhost:3000/api/ingredients/lookup?q=cebula' -b cookies.txt
# Backfill null-macro rows (review the dry run first)
pnpm tsx scripts/backfill-ingredient-macros.ts --dry-run
```

## Related

- [[concepts]]
- [[macro-calculation]]
- [[ingredient-auto-match]]
- [[database-schema]]

## Sources

- `src/lib/db/ingredients.ts`, `src/lib/off.ts`, `src/app/api/ingredients/**`
- `scripts/backfill-ingredient-macros.ts`, `supabase/seed.sql`
- Open Food Facts search API (`world.openfoodfacts.org/cgi/search.pl`), as called in `src/lib/off.ts`

## Changelog

- 2026-10-04: Created.
