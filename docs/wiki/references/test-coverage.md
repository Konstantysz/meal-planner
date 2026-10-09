---
title: "Test Coverage Map"
summary: "Which modules have unit tests, which do not, and which Review Focus edge cases are pinned by which test file."
tags: [testing]
status: stable
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-09
last_reviewed: 2026-10-09
review_interval_days: 180
confidence: high
llm_generated: true
llm_model: "claude-haiku-5-5"
human_reviewed: true
verified_commit: a7f8f52
sources:
  - title: "Unit tests"
    path: tests/unit
  - title: "Vitest config"
    path: vitest.config.ts
  - title: "Architecture plan (Review Focus)"
    path: docs/plans/architecture_plan_document.md
---

# Test Coverage Map

> [!tldr]
> There are 25 test files and 148 unit tests, all passing (`pnpm test` at a7f8f52). Coverage is strong for pure logic and the import pipeline. It is absent for most `src/lib/db/*` reads and plan writes, the offline store, the Supabase client helpers, most API routes and all UI except `ImportDialog`. There are no end-to-end or SQL/RLS tests.

## Context

`AGENTS.md` says most exported functions in `src/lib/` have a unit test. The gaps are listed below. Coverage percentage isn't measured, since no coverage script or provider is configured. Function-level mapping was checked by searching each exported name in `tests/unit/` at a7f8f52. See [[references]].

## Covered

| Module | Test file | Tests |
|---|---|---|
| `src/lib/macros.ts` | `tests/unit/macros.test.ts` | 7 |
| `src/lib/scaling.ts` | `tests/unit/scaling.test.ts` | 6 |
| `src/lib/shopping-list.ts` | `tests/unit/shopping-list.test.ts` | 4 |
| `src/lib/share-token.ts` | `tests/unit/share-token.test.ts` | 2 |
| `src/lib/off.ts` | `tests/unit/off.test.ts` | 13 |
| `src/lib/schemas.ts` | `tests/unit/schemas.test.ts` (`RecipeJsonLdSchema` only) | 3 |
| `src/lib/week.ts` | `tests/unit/week.test.ts` (`weekStartOf`, `normalizeWeekStart`) | 11 (includes a 6-case `it.each`) |
| `src/lib/db/ingredients.ts` | `tests/unit/db/ingredients.test.ts` (`listIngredients`, `createIngredient`) | 5 |
| `src/lib/db/recipes.ts` | `tests/unit/db/recipes.test.ts` (`createRecipe` only) | 3 |
| `src/lib/db/share.ts` | `tests/unit/db/share.test.ts` (`getSharedPlan`) | 4 |
| `src/lib/import/clean.ts` | `tests/unit/import/clean.test.ts` (real HTML fixtures) | 10 |
| `src/lib/import/extract.ts` | `tests/unit/import/extract.test.ts` | 4 |
| `src/lib/import/schema.ts` | `tests/unit/import/schema.test.ts` | 3 |
| `src/lib/import/engine.ts` | `tests/unit/import/engine.test.ts` (web-llm and `Worker` mocked) | 3 |
| `src/lib/import/ollama.ts` | `tests/unit/import/ollama.test.ts` | 2 |
| `src/lib/import/parse-ingredient.ts` | `tests/unit/import/parse-ingredient.test.ts` | 19 |
| `src/lib/import/match-ingredient.ts` | `tests/unit/import/match-ingredient.test.ts` | 6 |
| `src/lib/import/auto-match.ts` | `auto-match.test.ts` + `auto-match.leczo.test.ts` (real 10-line list) | 11 |
| `src/lib/import/yield.ts` | `tests/unit/import/yield.test.ts` (`it.each` table) | 14 |
| `src/app/api/import/extract/route.ts` | `tests/unit/import/extract-route.test.ts` | 4 |
| `src/app/auth/callback/route.ts` | `tests/unit/auth-callback.test.ts` | 4 |
| `src/components/import/ImportDialog.tsx` | `tests/unit/import/ImportDialog.test.tsx` | 5 |
| `scripts/wiki-check.ts` | `tests/unit/wiki-check.test.ts` | 4 |

## Not covered

| Module | Why it matters |
|---|---|
| `src/lib/db/plans.ts` | `getOrCreatePlan`, `getWeekPlan`, `upsertSlot`, `deleteSlot`. Upsert conflict key, `getOrCreatePlan` race |
| `src/lib/db/recipes.ts` | `listRecipes`, `getRecipe`. `getRecipe` is called once per slot by `/api/shopping`. |
| `src/lib/db/households.ts` | `createShareToken`, `inviteMember`. The explicit membership check in `inviteMember`, token retry |
| `src/lib/offline/shopping-store.ts` | `saveShoppingList`, `loadShoppingList`, `setHave`, `getHaveMap`. Preserving the have-map on save. A regression here once silently wiped user state. |
| `src/lib/supabase/middleware.ts` | `updateSession`. Public-path list and redirects |
| `src/lib/supabase/client.ts` | `createClient`. Not referenced by any test. |
| `src/lib/supabase/server.ts` | `createServerSupabase`. Referenced only inside a `vi.mock` in `auth-callback.test.ts`, never exercised. |
| `src/lib/import/fetch.ts` | `fetchPage`. Thin I/O wrapper with the `Fetch failed` error path. |
| `src/lib/import/gemini.ts` | `callGemini`. Thin I/O wrapper; no route calls it while the Gemini fallback is paused. |
| `src/lib/import/engine.ts` | `hasWebGpu`. Referenced only in `ImportDialog.test.tsx`. |
| `src/lib/import/worker.ts` | No exports. A side-effect module that binds the web-llm handler to `self.onmessage`. Needs a real browser. |
| `src/lib/schemas.ts` | Not functions, but untested: `IngredientInputSchema`, `RecipeIngredientInputSchema`, `RecipeInputSchema`, `PlanSlotInputSchema`, `SharedPlanSchema`. These are the write-path validators. |
| All other API routes and UI components | No route or component tests |
| RLS policies and SQL | No database tests at all |

## Review Focus cases

These are the five edge cases the original spec singled out as able to break the app.

| # | Case | Pinned by | Status |
|---|---|---|---|
| 1 | Recipe with zero servings or no ingredients | `macros.test.ts` (`perServing` with 0 and −1) | covered |
| 2 | Same ingredient in two units | `shopping-list.test.ts` | covered |
| 3 | Import of a page with no recipe | `extract.test.ts` (garbage, missing `name`) | covered |
| 4 | Slot pointing at an unavailable recipe | none. The plan specified an SQL FK test, but none exists. | **not covered** |
| 5 | Ingredient without macros | `macros.test.ts` (null), `shopping-list.test.ts` (`incomplete`) | covered |

## Examples

```bash
pnpm test                                   # all 148
pnpm vitest run tests/unit/import           # one folder
pnpm vitest run -t "different units"        # by test name
```

## Related

- [[references]]
- [[database-schema]]
- [[known-gaps]]
- [[write-unit-tests]]

## Sources

- `tests/unit/**`, `vitest.config.ts`, and a `pnpm test` run at a7f8f52 (25 files, 148 tests passed on Node 22.23.2).
- The Review Focus section of the original spec (`docs/plans/architecture_plan_document.md`).

## Changelog

- 2026-10-09: Re-verified against a7f8f52 (src and tests unchanged since). Per-row counts corrected: scaling 8 to 6, clean 8 to 10, parse-ingredient 13 to 19. `table` cells replaced with counts (week 11, db/recipes 3, db/share 4, yield 14). Added the `auth/callback` route row (4). Totals re-confirmed: 25 files, 148 tests.
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-09: Counts updated to 25 files and 148 tests. Not-covered list rewritten per exported symbol (db/recipes, db/plans, db/households, offline store, supabase helpers, import fetch/gemini/engine/worker, schemas). AGENTS.md convention reworded to point here.
- 2026-10-04: Created.
