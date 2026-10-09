---
title: "API Routes"
summary: "Every Next.js route handler under src/app/api and the auth callback: method, input, auth handling, what it calls and what it returns."
tags: [architecture, auth]
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
  - title: "Route handlers"
    path: src/app/api
  - title: "Auth callback route"
    path: src/app/auth/callback/route.ts
  - title: "Proxy (session refresh and redirects)"
    path: src/proxy.ts
  - title: "Session helper"
    path: src/lib/supabase/middleware.ts
  - title: "Zod schemas"
    path: src/lib/schemas.ts
  - title: "Database helpers (recipes, plans, share)"
    path: src/lib/db/recipes.ts
  - title: "Share RPC and policies"
    path: supabase/migrations/0005_share_link_rpc.sql
  - title: "RLS hardening"
    path: supabase/migrations/0004_security_hardening.sql
---

# API Routes

> [!tldr]
> There are 17 handlers in 13 route files under `src/app/api`, plus the `/auth/callback` route. Every handler that touches the database uses the cookie-bound Supabase server client, so **RLS decides what it can read or write**. Logged-out requests never reach a handler: the proxy redirects them to `/login` first.

## Context

This is the lookup table for `src/app/api/**/route.ts` and `src/app/auth/callback/route.ts`. Input bodies are validated with the Zod schemas in `src/lib/schemas.ts`, inside the database helpers the handlers call. See [[references]] and [[database-schema]].

> [!warning] Logged-out callers get a redirect, not a 401
> `src/proxy.ts` matches every path except static assets and `icons/`. For a logged-out user, `src/lib/supabase/middleware.ts` redirects every path to `/login` except the auth pages (`/login`, `/signup`, `/forgot-password`), `/share/*`, `/manifest.json` and `/auth/callback`. So `/api/*` is never public. A logged-out `fetch('/api/…')` therefore follows a redirect to the `/login` HTML page, receives status 200, and then fails on `res.json()`. The `401 unauth` branches inside the handlers can't be reached by a logged-out browser.

## Routes

| Method | Path | Input | Notes | Calls | Success |
|---|---|---|---|---|---|
| GET | `/api/recipes` | `?diet=…&exclude=…` (repeatable) | `diet` filters in SQL (`contains`); `exclude` drops recipes whose `allergens` match, in JS. Error → 500. | `listRecipes` | 200 `Recipe[]` |
| POST | `/api/recipes` | `RecipeInput` body, validated by `RecipeInputSchema` in `createRecipe` | 401 without a session. Uses the caller's **first** household (`limit(1)`); none → 400 `no household`. Saves through the `save_recipe` RPC. Validation or RPC error → 400. | `createRecipe` | 201 `Recipe` |
| GET | `/api/recipes/[id]` | none | Any error, including a recipe the caller cannot read, is returned as 404 | `getRecipe` | 200 with ingredients and steps |
| DELETE | `/api/recipes/[id]` | none | Direct `supabase.from('recipes').delete()`. `rec_delete` lets only the author delete, so a non-author gets **204 with nothing deleted**. Error → 400. | none | 204 |
| GET | `/api/ingredients` | none | Error → 500 | `listIngredients` | 200 `Ingredient[]` |
| POST | `/api/ingredients` | `IngredientInput` body, validated by `IngredientInputSchema` in `createIngredient` | Any error, validation or RLS, is a generic 400 | `createIngredient` | 201 `Ingredient` |
| GET | `/api/ingredients/lookup` | `?q=` (required) | No database access. Open Food Facts search. Missing `q` → 400. A non-OK upstream response or an unparseable body gives an empty list. A network throw → 500 `Lookup failed`. Results are not saved. | `searchOff` | 200 `IngredientInput[]` |
| GET | `/api/plans` | `?week=YYYY-MM-DD` | Any date in the week is mapped to its Monday (`normalizeWeekStart`). Missing or invalid → 400. Creates the plan if it is missing, for the caller's first household; no household → 400. | `getOrCreatePlan`, `getWeekPlan` | 200 `PlanWithSlots` |
| POST | `/api/plans/[id]/slots` | slot body, validated by `PlanSlotInputSchema`; `plan_id` is taken from the URL | Upserts on `(plan_id, date, position)`. Validation or RLS error → 400. | `upsertSlot` | 200 `PlanSlot` |
| DELETE | `/api/plans/[id]/slots/[slotId]` | none | Ignores `[id]`; RLS scopes the delete. Error → 400. | `deleteSlot` | 204 |
| GET | `/api/shopping` | `?week=` (required, not normalized) | Unlike `/api/plans`, the value is used as is. A non-Monday date fails the `plans_week_start_monday` check on insert; that throw sits outside any `try`, so the response is a framework 500. One `getRecipe` call per slot that has a recipe (N+1). | `getOrCreatePlan`, `getWeekPlan`, `getRecipe`, `aggregateShoppingList` | 200 `ShoppingItem[]` |
| POST | `/api/share` | `{ plan_id }` (not validated in the route) | 401 without a session. Inserts a `share_tokens` row; `st_insert` allows it only for a plan of the caller's household. Token insert is retried up to 5 times, then fails → 400. | `createShareToken` | 200 `{ token }` |
| GET | `/api/share/[token]` | none | Unknown token → 404 `invalid token`. Unreachable when logged out (see the warning above). The UI doesn't call it: the share page (`src/app/share/[token]/page.tsx`) calls `getSharedPlan` directly. | `getSharedPlan` (`get_shared_plan` RPC) | 200 `SharedPlan` (`week_start_date`, `slots`) |
| POST | `/api/household/invite` | `{ household_id, user_id }`; `user_id` is a known uuid, there is no email lookup | 401 without a session. Missing fields → 400. `inviteMember` does an explicit caller-membership check, the only explicit check in the handlers. Not a member, or insert error → 400. | `inviteMember` | 200 `{ ok: true }` |
| POST | `/api/import/fetch` | `{ url }` | Missing or non-string `url` → 400. Server-side fetch, which avoids CORS. A non-OK upstream response or any error → 500. | `fetchPage`, `cleanHtml` | 200 `{ markdown }` |
| GET | `/api/import/extract` | none | Reports `LLM_MODE` | none | 200 `{ mode: 'server' \| 'browser' }` |
| POST | `/api/import/extract` | `{ markdown }` | Missing or non-string `markdown` → 400. Extraction always goes to Ollama (`callOllama`). Any failure → 502. | `extractRecipe(…, callOllama)` | 200 `RecipeJsonLd` |
| GET | `/auth/callback` (outside `/api`) | `?code=` | Exchanges the one-time recovery `code` for a session cookie. Success → redirect to `/reset-password`. No code or a failed exchange → redirect to `/login?error=link`. The destination is fixed, so the route is not an open redirect. | `exchangeCodeForSession` | redirect, no JSON |

Errors are `{ error: string }` JSON, except `/auth/callback`, which redirects. Most handlers return `String(e)`. `PostgrestError` extends `Error`, so that string includes the database message text.

Body parsing is not uniform. `req.json()` sits outside the `try` in `share`, `household/invite`, `import/fetch`, `import/extract` and `plans/[id]/slots`, so a malformed body gives an unhandled 500 there. `recipes` and `ingredients` POST parse inside the `try` and return 400.

> [!danger] `/api/import/fetch` fetches arbitrary URLs
> Any signed-in user can make the server fetch any URL, internal addresses included. This is a server-side request forgery (SSRF) surface. Nothing in the code restricts it to recipe sites.

## Examples

```ts
// How the client hooks call the plan API (src/hooks/usePlan.ts)
await fetch(`/api/plans/${plan.id}/slots`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ date, position, label: null, recipe_id: recipeId, servings }),
});
```

## Related

- [[references]]
- [[database-schema]]
- [[env-vars]]
- [[architecture-overview]]
- [[auth-session]]: why logged-out calls redirect
- [[rls-authorization]]: why the handlers trust RLS
- [[share-links]]: the share RPC behind `/api/share`
- [[import-pipeline]]: the flow the import routes serve

## Sources

- `src/app/api/**/route.ts`, `src/app/auth/callback/route.ts`
- `src/proxy.ts`, `src/lib/supabase/middleware.ts`
- `src/lib/schemas.ts`, `src/lib/db/*.ts`, `src/lib/supabase/server.ts`
- `supabase/migrations/0004_security_hardening.sql`, `supabase/migrations/0005_share_link_rpc.sql`

## Changelog

- 2026-10-09: Re-verified against a7f8f52. Corrected the handler count (17 in 13 route files, plus `/auth/callback`), the `/api/share/[token]` call and output, the claim that every handler uses the Supabase client, and the public path list. Added error codes, Zod validation points, the `/auth/callback` route and the unnormalized `/api/shopping` week.
- 2026-10-04: Created from a full read of the route handlers and the proxy.
