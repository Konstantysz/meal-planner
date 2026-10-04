---
title: "API Routes"
summary: "Every Next.js route handler under src/app/api: method, input, auth handling, what it calls and what it returns."
tags: [architecture, auth]
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
  - title: "Route handlers"
    path: src/app/api
  - title: "Proxy (session refresh and redirects)"
    path: src/proxy.ts
  - title: "Session helper"
    path: src/lib/supabase/middleware.ts
---

# API Routes

> [!tldr]
> There are 14 handlers across 11 route files. All of them use the cookie-bound Supabase server client, so **RLS decides what each one can read or write**. Logged-out requests never reach a handler: the proxy redirects them to `/login` first.

## Context

This is the lookup table for `src/app/api/**/route.ts`. See [[references]] and [[database-schema]].

> [!warning] Logged-out callers get a redirect, not a 401
> `src/proxy.ts` matches every path except static assets. Only `/login`, `/signup`, `/share/*` and `/manifest.json` are public, so `/api/*` isn't. A logged-out `fetch('/api/…')` therefore follows a redirect to the `/login` HTML page, receives status 200, and then fails on `res.json()`. The `401 unauth` branches inside the handlers can't be reached by a logged-out browser.

## Routes

| Method | Path | Input | Notes | Calls | Success |
|---|---|---|---|---|---|
| GET | `/api/recipes` | `?diet=…&exclude=…` (repeatable) | `diet` filters in SQL (`contains`); `exclude` filters allergens in JS | `listRecipes` | 200 `Recipe[]` |
| POST | `/api/recipes` | `RecipeInput` body | Resolves the caller's **first** household (`limit(1)`) | `createRecipe` | 201 `Recipe` |
| GET | `/api/recipes/[id]` | none | Any error is returned as 404 | `getRecipe` | 200 with ingredients and steps |
| DELETE | `/api/recipes/[id]` | none | Direct `supabase.delete()`. RLS allows only the author, and a non-author gets **204 with nothing deleted**. | none | 204 |
| GET | `/api/ingredients` | none | | `listIngredients` | 200 `Ingredient[]` |
| POST | `/api/ingredients` | `IngredientInput` body | Errors are a generic 400 | `createIngredient` | 201 `Ingredient` |
| GET | `/api/ingredients/lookup` | `?q=` | Proxies Open Food Facts search | `searchOff` | 200 `IngredientInput[]` |
| GET | `/api/plans` | `?week=YYYY-MM-DD` | Creates the plan if it is missing (first household) | `getOrCreatePlan`, `getWeekPlan` | 200 `PlanWithSlots` |
| POST | `/api/plans/[id]/slots` | slot body (`plan_id` is taken from the URL) | Upserts on `(plan_id, date, position)` | `upsertSlot` | 200 `PlanSlot` |
| DELETE | `/api/plans/[id]/slots/[slotId]` | none | Ignores `[id]`; RLS scopes it | `deleteSlot` | 204 |
| GET | `/api/shopping` | `?week=` | One `getRecipe` call per slot (N+1) | `getOrCreatePlan`, `getWeekPlan`, `getRecipe`, `aggregateShoppingList` | 200 `ShoppingItem[]` |
| POST | `/api/share` | `{ plan_id }` | | `createShareToken` | 200 `{ token }` |
| GET | `/api/share/[token]` | none | Unreachable when logged out (see the warning above). The UI doesn't use it. | `getWeekPlan` | 200 `PlanWithSlots` |
| POST | `/api/household/invite` | `{ household_id, user_id }` | Explicit caller-membership check, the one place that doesn't rely on RLS alone | `inviteMember` | 200 `{ ok: true }` |
| POST | `/api/import/fetch` | `{ url }` | Server-side fetch, which avoids CORS. Fetches any URL. | `fetchPage`, `cleanHtml` | 200 `{ markdown }` |
| GET | `/api/import/extract` | none | Reports `LLM_MODE` | none | 200 `{ mode: 'server' \| 'browser' }` |
| POST | `/api/import/extract` | `{ markdown }` | Ollama only. Failure → 502 | `extractRecipe(…, callOllama)` | 200 `RecipeJsonLd` |

Errors are `{ error: string }`. Most handlers return `String(e)`, which can include database error text.

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

## Sources

- `src/app/api/**/route.ts`
- `src/proxy.ts`, `src/lib/supabase/middleware.ts`

## Changelog

- 2026-10-04: Created from a full read of the route handlers and the proxy.
