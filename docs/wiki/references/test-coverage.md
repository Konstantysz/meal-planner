---
title: "Test Coverage Map"
summary: "Which modules have unit tests, which do not, and which Review Focus edge cases are pinned by which test file."
tags: [testing]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-04
last_reviewed: null
review_interval_days: 180
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 656711c
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
> There are 21 test files and 120 unit tests, all passing. That includes the 4 `wiki-check` tests added with this wiki. Coverage is strong for pure logic and the import pipeline. It is absent for most `src/lib/db/*`, the offline store, most API routes and all UI except `ImportDialog`. There are no end-to-end or SQL/RLS tests.

## Context

`AGENTS.md` says every function in `src/lib/` has a unit test. That isn't true yet; the gaps are listed below. Coverage percentage isn't measured, since no coverage script or provider is configured. See [[references]].

## Covered

| Module | Test file | Tests |
|---|---|---|
| `src/lib/macros.ts` | `tests/unit/macros.test.ts` | 7 |
| `src/lib/scaling.ts` | `tests/unit/scaling.test.ts` | 8 |
| `src/lib/shopping-list.ts` | `tests/unit/shopping-list.test.ts` | 4 |
| `src/lib/share-token.ts` | `tests/unit/share-token.test.ts` | 2 |
| `src/lib/off.ts` | `tests/unit/off.test.ts` | 13 |
| `src/lib/schemas.ts` | `tests/unit/schemas.test.ts` | 3 |
| `src/lib/db/ingredients.ts` | `tests/unit/db/ingredients.test.ts` | 5 |
| `src/lib/import/clean.ts` | `tests/unit/import/clean.test.ts` (real HTML fixtures) | 8 |
| `src/lib/import/extract.ts` | `tests/unit/import/extract.test.ts` | 4 |
| `src/lib/import/schema.ts` | `tests/unit/import/schema.test.ts` | 3 |
| `src/lib/import/engine.ts` | `tests/unit/import/engine.test.ts` (web-llm and `Worker` mocked) | 3 |
| `src/lib/import/ollama.ts` | `tests/unit/import/ollama.test.ts` | 2 |
| `src/lib/import/parse-ingredient.ts` | `tests/unit/import/parse-ingredient.test.ts` | 13 |
| `src/lib/import/match-ingredient.ts` | `tests/unit/import/match-ingredient.test.ts` | 6 |
| `src/lib/import/auto-match.ts` | `auto-match.test.ts` + `auto-match.leczo.test.ts` (real 10-line list) | 11 |
| `src/lib/import/yield.ts` | `tests/unit/import/yield.test.ts` (`it.each` table) | table |
| `src/app/api/import/extract/route.ts` | `tests/unit/import/extract-route.test.ts` | 4 |
| `src/components/import/ImportDialog.tsx` | `tests/unit/import/ImportDialog.test.tsx` | 5 |
| `scripts/wiki-check.ts` | `tests/unit/wiki-check.test.ts` | 4 |

## Not covered

| Module | Why it matters |
|---|---|
| `src/lib/db/recipes.ts` | The non-transactional 3-step insert in `createRecipe` |
| `src/lib/db/plans.ts` | Upsert conflict key, `getOrCreatePlan` race |
| `src/lib/db/households.ts` | The explicit membership check in `inviteMember`, token retry |
| `src/lib/offline/shopping-store.ts` | Preserving the have-map on save. A regression here once silently wiped user state. |
| `src/lib/supabase/middleware.ts` | Public-path list and redirects |
| `src/lib/import/fetch.ts`, `gemini.ts`, `worker.ts` | Thin I/O wrappers. `worker.ts` needs a real browser. |
| All other API routes and UI components | No route or component tests |
| RLS policies and SQL | No database tests at all |

## Review Focus cases

These are the five edge cases the original plan singled out as able to break the app.

| # | Case | Pinned by | Status |
|---|---|---|---|
| 1 | Recipe with zero servings or no ingredients | `macros.test.ts` (`perServing` with 0 and −1) | covered |
| 2 | Same ingredient in two units | `shopping-list.test.ts` | covered |
| 3 | Import of a page with no recipe | `extract.test.ts` (garbage, missing `name`) | covered |
| 4 | Slot pointing at a deleted recipe | none. The plan specified an SQL FK test, but none exists. | **not covered** |
| 5 | Ingredient without macros | `macros.test.ts` (null), `shopping-list.test.ts` (`incomplete`) | covered |

## Examples

```bash
pnpm test                                   # all 120
pnpm vitest run tests/unit/import           # one folder
pnpm vitest run -t "different units"        # by test name
```

## Related

- [[references]]
- [[database-schema]]
- [[known-gaps]]

## Sources

- `tests/unit/**`, `vitest.config.ts`, and a `pnpm test` run on the `docs/wiki` branch (based on 656711c).
- The Review Focus section of `docs/plans/architecture_plan_document.md`.

## Changelog

- 2026-10-04: Created.
