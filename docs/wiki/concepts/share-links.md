---
title: "Share Links"
summary: "Read-only public links to a week plan: token generation, the public /share/[token] page, the token-checked get_shared_plan RPC, and the remaining gaps."
tags: [sharing, rls, security]
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
verified_commit: dd7dd50
sources:
  - title: "Token generator"
    path: src/lib/share-token.ts
  - title: "createShareToken"
    path: src/lib/db/households.ts
  - title: "getSharedPlan"
    path: src/lib/db/share.ts
  - title: "Share route"
    path: src/app/api/share/route.ts
  - title: "Public share page"
    path: src/app/share/[token]/page.tsx
  - title: "Settings page (link generation)"
    path: src/app/(app)/settings/page.tsx
  - title: "Week helpers"
    path: src/lib/week.ts
  - title: "Share-link RPC migration"
    path: supabase/migrations/0005_share_link_rpc.sql
---

# Share Links

> [!tldr]
> Settings → „Wygeneruj link" creates a 32-character token for the current week's plan (its Monday). `/share/[token]` is a public server page that calls the `security definer` RPC `get_shared_plan(token)`, which returns only the plan that token unlocks. Anonymous visitors have no table access at all (migration 0005).

## Context

The sharing requirement was "share with friends". The first version (migration 0002) let anyone list every token and read every shared plan; 0005 replaced it. See [[concepts]], [[rls-authorization]], [[week-plan]] and [[0008-share-link-rpc]].

## How it works

1. `generateShareToken()` takes 24 random bytes from `crypto.getRandomValues`, base64url-encodes them and cuts to 32 characters.
2. `createShareToken(supabase, planId, userId)` inserts into `share_tokens` and retries up to 5 times on error. RLS (`st_insert`, 0004) only allows a plan of the caller's household.
3. Settings: `GET /api/plans?week=<weekStartOf(today)>`, then `POST /api/share { plan_id }`, then shows `${origin}/share/${token}`. `/api/plans` also normalizes any date to its Monday (`normalizeWeekStart`).
4. `/share/[token]` (public in the proxy) calls `getSharedPlan(supabase, token)`, which calls the RPC and parses the result with `SharedPlanSchema`. `null` means an unknown token, and the page returns 404.

`get_shared_plan(p_token)` returns `{ week_start_date, slots: [{ id, date, position, label, servings, recipe: { name } | null }] }`, slots sorted by date and position. It does not return the plan id, the household id or any recipe field except the name. `execute` is granted to `anon` and `authenticated`.

## Invariants and gotchas

- **Plans start on Monday.** The `plans_week_start_monday` check constraint (0005) rejects any other `week_start_date`. Compute weeks with `weekStartOf` / `normalizeWeekStart` from `src/lib/week.ts`, not `toISOString()`.
- The share page never reads tables directly. Don't add anon `select` policies for sharing; extend the RPC instead.
- `GET /api/share/[token]` returns the same payload, but it sits behind the proxy, so anonymous callers get redirected. The page doesn't use it.
- Tokens never expire. A creator can list (`st_select`) and delete (`st_delete`) their own tokens, but no UI does that.
- Every click on „Wygeneruj link" creates a new token for the same plan.

## Known gaps

- No list of active links and no way to revoke one in the UI.
- Tokens are stored in plain text. Anyone with database access can use them. Hashing them would need a migration and a one-time re-share.

## Examples

```ts
generateShareToken(); // 32 chars from [A-Za-z0-9_-]
// → shared at `${location.origin}/share/${token}`
await getSharedPlan(supabase, token); // SharedPlan | null
```

```sql
select get_shared_plan('<token>');  -- works as anon; null for an unknown token
```

## Related

- [[concepts]]
- [[rls-authorization]]
- [[week-plan]]
- [[database-schema]]
- [[0003-share-token-rls]]
- [[0008-share-link-rpc]]

## Sources

- `src/lib/share-token.ts`, `src/lib/db/households.ts`, `src/lib/db/share.ts`, `src/lib/week.ts`
- `src/app/api/share/**`, `src/app/share/[token]/page.tsx`, `src/app/(app)/settings/page.tsx`
- `supabase/migrations/0002_share_token_rls.sql`, `0005_share_link_rpc.sql`
- Commits `a147dfd` (share links) and `07eb51c` (token-scoped RLS)

## Changelog

- 2026-10-04: Rewrote for migration 0005 (RPC, no anon table access) and the settings wrong-week fix.
- 2026-10-04: Created from legacy `sharing.md`. Added the wrong-week bug, token enumeration and the unreachable API route.
