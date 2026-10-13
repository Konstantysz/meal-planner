---
title: "Ingredient Database"
summary: "The shared ingredients table: macros per 100 g, Open Food Facts lookup and category guessing, and how rows get created."
tags: [ingredients, macros]
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
verified_commit: d219835
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
  - title: "Macro validator"
    path: src/lib/macro-validation.ts
  - title: "Ingredient input schema"
    path: src/lib/schemas.ts
  - title: "Macro range checks"
    path: supabase/migrations/0012_ingredient_macro_checks.sql
  - title: "Data-quality report"
    path: supabase/reports/data_quality.sql
  - title: "Open Food Facts disclaimer"
    path: src/components/recipes/OffDisclaimer.tsx
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
> `ingredients` is one global table, not scoped to a household. It stores nullable macros **per 100 g** and has a case-insensitive unique name. Rows come from the 40-row seed, from manual creation (macros all null), or from Open Food Facts through `/api/ingredients/lookup`. Any signed-in user can create a row; only its creator or an app admin can change it (since migration 0010). Macros must be in range (since migration 0012), and Open Food Facts results must also pass the Atwater check.

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

## Macro validation

`validateMacros` (`src/lib/macro-validation.ts`) is the one validator for ingredient macros. It returns the rules a row breaks; null values are never judged, so a macro-less ingredient is valid.

| Rule | Where it applies |
|---|---|
| Protein, fat and carbs each 0–100 g per 100 g | Save (`IngredientInputSchema`), Open Food Facts mapping, database CHECK (0012) |
| Protein + fat + carbs ≤ 101 g (1 g for label rounding) | Save, Open Food Facts mapping, database CHECK |
| kcal 0–900 per 100 g | Save, Open Food Facts mapping, database CHECK |
| kcal within 0.6–1.2× the Atwater estimate (4/9/4 kcal per gram of protein/fat/carbs), or within 10 kcal of it | Open Food Facts mapping only (`{ atwater: true }`); skipped without kcal. With kcal but a macro missing, the present macros give a lower bound only (kcal < 0.6× their estimate − 10 is rejected) |

- **Save.** `IngredientInputSchema` runs the range rules, so `POST /api/ingredients` answers 400 before the database CHECK would fire.
- **Open Food Facts.** `mapOffProduct` returns null for a product that breaks any rule, so `searchOff` drops it and the next product becomes the first result (auto-match and the backfill script take `[0]`).
- **Why Atwater stays out of the database.** Alcohol (kcal with no protein, fat or carbs) and fibre-rich spices (fibre counted in carbs) legitimately miss it. Such a row can be saved by hand; as an Open Food Facts result it is skipped. The 10 kcal slack keeps near-zero products (coffee, broth) from failing on the ratio alone.
- **Data-quality report.** `supabase/reports/data_quality.sql` is a single read-only SELECT for the SQL editor. It lists ingredients that miss the Atwater rule, macro-less ingredients used in recipes, and recipe ingredients without an amount or with a unit that cannot be converted to grams (the report's unit list mirrors `GRAMS_PER_UNIT` / `toGrams` in `src/lib/macros.ts` from PR #95: mg, g, gr, dag, dkg, kg, ml, cl, dl, l; see [[macro-calculation]]). Nothing runs it automatically.
- **Disclaimer.** `OffDisclaimer` („Dane z Open Food Facts — publicznej bazy tworzonej przez społeczność. Mogą zawierać błędy.") shows under the picker's results when any of them has `source = 'off'`, and under „Auto-mapuj składniki" in the import review.

## Invariants and gotchas

- **Per 100 g, always.** `default_unit` is free text (Open Food Facts rows get `g`, manual rows get null). The picker and the import review use it only as the initial unit, not as a conversion factor. There is no density or piece-weight data, so 1 „łyżka" can't be turned into grams.
- `lower(name)` is unique. Creating „Cebula" when „cebula" exists fails, and the picker's `createAndAdd` then silently does nothing (`if (!res.ok) return`).
- The seed isn't idempotent (no `on conflict`).
- `recipe_ingredients.ingredient_id` has no on-delete action, and there is no delete policy, so ingredients can't be deleted.

## Known gaps

- Only the creator or an app admin can update an ingredient (`ing_update`, migration 0010, [[0013-ingredient-ownership-and-app-admins]]). Seed rows and rows created before 0010 have no creator, so only an app admin can fix them. Nothing records who changed a value, only who created the row.
- Macro-less placeholders pile up from import and manual creation. The picker inserts them as soon as they are picked, even if the recipe is never saved. Their null macros count as 0, so recipe macros are understated without any warning on the detail page (the shopping list does show „brak makro"). `scripts/backfill-ingredient-macros.ts` (service-role key, `--dry-run`) re-queries Open Food Facts for them and takes the first hit as-is.
- `GET /api/ingredients` returns the whole table. The picker filters client-side.
- Rows that pass the range rules but miss the Atwater estimate stay in the table until someone runs the data-quality report and fixes them by hand. On 2026-10-13 that was „vEGGs roślinny zamiennik jajek" (298 kcal vs. 241.5, 1.23×).
- Open Food Facts is crowd-sourced. The validator catches impossible and inconsistent rows, not plausible wrong ones; the first passing product is still taken without ranking.

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

- 2026-10-13: Added macro validation: shared validator, range checks on save and in the database (migration 0012), the Atwater check for Open Food Facts results, the data-quality report and the disclaimer (#71).
- 2026-10-13: Ingredient updates limited to the creator or an app admin (migration 0010).
- 2026-10-09: Re-verified against `a7f8f52`. Corrected the `default_unit` description, the failed-`searchOff` behaviour and the prose abbreviation for Open Food Facts. Added the picker and migration sources.
- 2026-10-09: Linked the shared-catalog decision, [[0010-global-ingredient-catalog]].
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-04: Added a gap found in the 2026-10-04 smoke test.
- 2026-10-04: Created.
