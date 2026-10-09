---
title: "Ingredient Database"
summary: "The shared, crowd-sourced ingredients table: macros per 100 g, Open Food Facts lookup and category guessing, and how rows get created."
tags: [ingredients, macros]
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
  - title: "Ingredient data access"
    path: src/lib/db/ingredients.ts
  - title: "Ingredient picker"
    path: src/components/recipes/IngredientPicker.tsx
  - title: "Initial schema (table, unique name index, FK)"
    path: supabase/migrations/0001_initial.sql
  - title: "Security hardening (ingredient write policies)"
    path: supabase/migrations/0004_security_hardening.sql
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
> `ingredients` is one global table, not scoped to a household. It stores nullable macros **per 100 g** and has a case-insensitive unique name. Rows come from the 40-row seed, from manual creation (macros all null), or from Open Food Facts through `/api/ingredients/lookup`. Any signed-in user can create or edit any row.

## Context

Recipe macros, the shopping list's `incomplete` flag and import auto-matching all read this table. See [[concepts]], [[macro-calculation]] and [[ingredient-auto-match]].

## How it works

| Source | `source` | Path |
|---|---|---|
| Seed | `off` | `supabase/seed.sql` (40 rows) |
| Manual "add new" in the picker | `manual` | `IngredientPicker.createAndAdd` → `POST /api/ingredients`, all macros null, category `inne` |
| Open Food Facts candidate during import | `off` | `ImportReviewForm` → `POST /api/ingredients` with `mapOffProduct` output |
| Import fallback with no match | `manual` | Like manual: placeholder ingredient, null macros |
| `ai_estimate` | n/a | Allowed by the schema, but nothing writes it |

`searchOff(query)` calls the Open Food Facts `cgi/search.pl` endpoint with `page_size=5` and returns the products that have a name and at least one macro. On a non-OK response or a parse failure it returns `[]`; a network error propagates to the caller. `guessCategory` maps `categories_tags` keywords (vegetable, fruit, meat…) to the 11 Polish categories, with `inne` as the fallback.

## Invariants and gotchas

- **Per 100 g, always.** `default_unit` is free text (Open Food Facts rows get `g`, manual rows get null). The picker and the import review use it only as the initial unit, not as a conversion factor. There is no density or piece-weight data, so 1 „łyżka" can't be turned into grams.
- `lower(name)` is unique. Creating „Cebula" when „cebula" exists fails, and the picker's `createAndAdd` then silently does nothing (`if (!res.ok) return`).
- The seed isn't idempotent (no `on conflict`).
- `recipe_ingredients.ingredient_id` has no on-delete action, and there is no delete policy, so ingredients can't be deleted.

## Known gaps

- Any signed-in user can overwrite any ingredient's macros (`ing_update`). That is intentional, per the plan, but nothing records who changed what.
- Macro-less placeholders pile up from import and manual creation. The picker inserts them as soon as they are picked, even if the recipe is never saved. Their null macros count as 0, so recipe macros are understated without any warning on the detail page (the shopping list does show „brak makro"). `scripts/backfill-ingredient-macros.ts` (service-role key, `--dry-run`) re-queries Open Food Facts for them and takes the first hit as-is.
- `GET /api/ingredients` returns the whole table. The picker filters client-side.

## Examples

```bash
# Open Food Facts lookup through the app
curl 'http://localhost:3000/api/ingredients/lookup?q=cebula' -b cookies.txt
# Backfill null-macro rows (review the dry run first)
pnpm tsx scripts/backfill-ingredient-macros.ts --dry-run
```

## Related

- [[concepts]]
- [[macro-calculation]]
- [[ingredient-auto-match]]
- [[database-schema]]
- [[0010-global-ingredient-catalog]]

## Sources

- `src/lib/db/ingredients.ts`, `src/lib/off.ts`, `src/app/api/ingredients/**`, `src/components/recipes/IngredientPicker.tsx`
- `scripts/backfill-ingredient-macros.ts`, `supabase/seed.sql`, `supabase/migrations/0001_initial.sql`, `supabase/migrations/0004_security_hardening.sql`
- Open Food Facts search API (`world.openfoodfacts.org/cgi/search.pl`), as called in `src/lib/off.ts`

## Changelog

- 2026-10-09: Re-verified against `a7f8f52`. Corrected the `default_unit` description, the failed-`searchOff` behaviour and the prose abbreviation for Open Food Facts. Added the picker and migration sources.
- 2026-10-09: Linked the shared-catalog decision, [[0010-global-ingredient-catalog]].
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-04: Added a gap found in the 2026-10-04 smoke test.
- 2026-10-04: Created.
