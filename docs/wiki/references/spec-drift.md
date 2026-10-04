---
title: "Spec Drift"
summary: "Where the code differs from docs/plans/architecture_plan_document.md: planned but not built, built differently, and built but not planned."
tags: [spec]
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
> Don't treat the 3,820-line plan as the truth about the code. The code runs on Next.js 16, the Gemini fallback is paused, ingredient auto-matching exists, and several planned modules (`components/ui/`, `lib/ics.ts`, `lib/db/pantry.ts`, `hooks/useRecipes.ts`, drag and drop) were never built.

## Context

The app was built task by task from `docs/plans/architecture_plan_document.md`, which is written in Polish. Fixes and later features then moved the code away from it. The build ledger that recorded those rulings (`.superpowers/sdd/…/progress.md`) is gitignored and not present in this checkout. This page and the [[decisions]] pages replace it. See [[references]].

## Planned but not built

| Plan item | Reality |
|---|---|
| `src/components/ui/` (button, input, select, checkbox, dialog) | Doesn't exist. Components use Tailwind classes inline. |
| `src/lib/ics.ts` (calendar export) | Doesn't exist. No task in the plan actually specifies it. |
| `src/lib/db/pantry.ts` and server-side pantry | Doesn't exist. The `pantry_items` table is unused. "Mam to" state lives only in IndexedDB on each device. |
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
| Signup | `signUp()` only | Also calls the `create_household_with_owner` RPC (migration 0003) |
| Share links for anonymous visitors | Relied on the `share_tokens` select policy | Needed migration 0002's token-scoped select policies |
| Household invite | `inviteMember(email)` | `inviteMember(householdId, userId, callerId)`, with no email lookup |
| Import review | Manual ingredient mapping | An „Auto-mapuj składniki" button: parse the line, match locally, then fall back to OFF, then create a placeholder. Servings come from `parseYield`. |
| LLM routing | WebLLM, with Gemini as fallback | Two exclusive modes chosen by `LLM_MODE`: browser (WebLLM) or server (Ollama) |
| HTML cleaning | Strip noise, pick a content selector | Also strips media, links and comments, crops to the ingredients section and replaces quote characters |
| Seed | The plan shows 20 of 40 rows | All 40 rows are present |
| Plan file location | It says it was saved to `docs/superpowers/plans/2026-09-20-meal-planner-mvp.md` | It lives at `docs/plans/architecture_plan_document.md` |

## Built but not planned

- `scripts/backfill-ingredient-macros.ts`: a one-off OFF backfill for ingredients without macros.
- `scripts/bench-llm.ts` (`pnpm bench:llm`): a browser vs. server extraction benchmark.
- `src/lib/import/{auto-match,match-ingredient,parse-ingredient,yield,ollama}.ts`.
- Recipe delete (`RecipeActions`, `DELETE /api/recipes/[id]`) and a read-only edit preview.

## Leftover scaffold

- `src/app/page.tsx` (`/`) is still the create-next-app landing page. Logged-in users who open `/` see it, and the manifest's `start_url` is `/`.
- `src/app/layout.tsx` metadata is still "Create Next App", with `lang="en"`.
- The root `README.md` is create-next-app boilerplate.

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

- `docs/plans/architecture_plan_document.md` (File Structure, Global Constraints, Tasks 1–18, Self-Review)
- `package.json`, `src/proxy.ts`, and the bundled Next.js proxy guide
- Git history from `4954655` to `656711c`

## Changelog

- 2026-10-04: Created.
