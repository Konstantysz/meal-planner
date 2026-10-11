---
title: "Spec Drift"
summary: "Where the code differs from the original spec (docs/plans/architecture_plan_document.md): planned but not built, built differently, and built but not planned."
tags: [spec]
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
verified_commit: 656711c
sources:
  - title: "Architecture plan"
    path: docs/plans/architecture_plan_document.md
  - title: "Package manifest"
    path: package.json
  - title: "Proxy"
    path: src/proxy.ts
  - title: "Next.js 16 proxy docs (bundled)"
    path: node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
---

# Spec Drift

> [!tldr]
> Don't treat the 3,820-line original spec as the truth about the code. The code runs on Next.js 16, the Gemini fallback is paused, ingredient auto-matching exists, and several planned modules (`components/ui/`, `lib/ics.ts`, `lib/db/pantry.ts`, `hooks/useRecipes.ts`, drag and drop) were never built.

## Context

The app was built task by task from the original spec (`docs/plans/architecture_plan_document.md`), which is written in Polish. Fixes and later features then moved the code away from it. The build ledger that recorded those rulings (`.superpowers/sdd/…/progress.md`) is not present in this checkout. This page and the [[decisions]] pages replace it. See [[references]].

## Planned but not built

| Plan item | Reality |
|---|---|
| `src/components/ui/` (button, input, select, checkbox, dialog) | Doesn't exist. Components use Tailwind classes inline. |
| `src/lib/ics.ts` (calendar export) | Doesn't exist. No task in the plan actually specifies it. |
| `src/lib/db/pantry.ts` and server-side pantry | Doesn't exist. The `pantry_items` table is unused. The Have mark (UI „mam to”) lives only in IndexedDB on each device. |
| `src/hooks/useRecipes.ts` | Doesn't exist. `RecipeList` fetches directly. |
| Drag and drop in the plan (`@dnd-kit/*`) | The packages are installed but never imported. |
| Task 9 SQL test for `ON DELETE SET NULL` | No SQL tests exist. |
| Review Focus #5 label „dane niepełne" and per-day macro sums | The shopping list shows „(brak makro)". Per-day sums are a stub. |
| `pnpm build` produces a PWA | A manifest only, with no service worker. |
| Zero-cost Gemini Flash fallback | Paused. `callGemini` exists but no route calls it. |

## Built differently

| Area | Plan | Code |
|---|---|---|
| Framework | Next.js 15 | Next.js `16.3.5`, React 19.2. Middleware is now `src/proxy.ts` (Next 16 renamed Middleware to Proxy). The helper file is still called `src/lib/supabase/middleware.ts`. |
| Tailwind | `tailwind.config.ts` | Tailwind 4 through `@tailwindcss/postcss`, with no config file |
| Next config | `next.config.js` | `next.config.ts` (empty) |
| Signup | `signUp()` only | The household is created by the `on_auth_user_created` trigger (migration 0006). `create_household_with_owner` (migration 0003) is kept, but no client code calls it. |
| Share links for anonymous visitors | Relied on the `share_tokens` select policy | Needed migration 0002's token-scoped select policies |
| Household invite | `inviteMember(email)` | `inviteMember(householdId, userId, callerId)`, with no email lookup |
| Import review | Manual ingredient mapping | An „Auto-mapuj składniki" button: parse the line, auto-match locally, then fall back to Open Food Facts, then create a placeholder ingredient. Servings come from `parseYield`. |
| LLM routing | WebLLM, with Gemini as fallback | Two exclusive LLM modes chosen by `LLM_MODE`: browser (WebLLM) or server (Ollama) |
| HTML cleaning | Strip noise, pick a content selector | Also strips media and comments, keeps only the text of links, crops to the ingredients section and replaces quote characters |
| Seed | The plan shows 20 of 40 rows | All 40 rows are present |
| Original spec location | It says it was saved to `docs/superpowers/plans/2026-09-20-meal-planner-mvp.md` | It lives at `docs/plans/architecture_plan_document.md` |

## Built but not planned

- `scripts/backfill-ingredient-macros.ts`: a one-off OFF backfill for ingredients without macros.
- `scripts/bench-llm.ts` (`pnpm bench:llm`): a browser vs. server extraction benchmark.
- `scripts/eval-ingredients.ts` (`pnpm eval:ingredients`): scores the model's ingredient structuring against a corpus.
- `src/lib/import/{auto-match,match-ingredient,unit,yield,ollama}.ts`.
- Recipe delete (`RecipeActions`, `DELETE /api/recipes/[id]`) and a read-only edit preview.

## Leftover scaffold

- `src/app/page.tsx` (`/`) is still the create-next-app landing page, and the manifest's `start_url` is `/`.
- `src/app/layout.tsx` metadata is still "Create Next App", with `lang="en"`.

> [!warning] Uncertain
> Whether signed-in users reach the `/` landing page depends on the redirects in `updateSession` (`src/lib/supabase/middleware.ts`, used by `src/proxy.ts`). Not traced in full, so the earlier claim that logged-in users see it was removed.

## Examples

```bash
# Confirm a planned module still doesn't exist before building on the plan
git ls-files src/lib/ics.ts src/lib/db/pantry.ts src/hooks/useRecipes.ts src/components/ui
```

## Related

- [[references]]
- [[database-schema]]
- [[test-coverage]]
- [[known-gaps]]
- [[architecture-overview]]

## Sources

- Original spec, `docs/plans/architecture_plan_document.md` (File Structure, Global Constraints, Tasks 1–18, Self-Review)
- `package.json`, `src/proxy.ts`, and the bundled Next.js proxy guide
- Git history from `4954655` to `656711c`

## Changelog

- 2026-10-09: Re-verified against a7f8f52 and corrected: signup now goes through the `on_auth_user_created` trigger (no client RPC call), the root `README.md` is no longer boilerplate, the build ledger is not "gitignored" (no ignore rule exists), HTML cleaning keeps link text, and the `/` scaffold claim is marked uncertain. Terminology aligned with GLOSSARY.md (Have mark, LLM mode, Open Food Facts, auto-match).
- 2026-10-09: Terminology aligned with GLOSSARY.md.
- 2026-10-04: Created.
