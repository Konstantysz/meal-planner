---
title: "Share Links"
summary: "Read-only public links to a week plan: token generation, the public /share/[token] page, the token-scoped RLS policies, and their gaps."
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
verified_commit: 656711c
sources:
  - title: "Token generator"
    path: src/lib/share-token.ts
  - title: "createShareToken"
    path: src/lib/db/households.ts
  - title: "Share route"
    path: src/app/api/share/route.ts
  - title: "Public share page"
    path: src/app/share/[token]/page.tsx
  - title: "Settings page (link generation)"
    path: src/app/(app)/settings/page.tsx
  - title: "Share-token RLS"
    path: supabase/migrations/0002_share_token_rls.sql
---

# Share Links

> [!tldr]
> Settings → „Wygeneruj link" creates a 32-character token for a plan. `/share/[token]` is a public server page that renders the plan read-only. Anonymous reads work through migration 0002's select-only policies. Two problems: **the settings page shares the wrong week on any day but Monday**, and **every token is publicly listable**.

## Context

The sharing requirement was "share with friends". See [[concepts]], [[rls-authorization]] and [[week-plan]].

## How it works

1. `generateShareToken()` takes 24 random bytes from `crypto.getRandomValues`, base64url-encodes them and cuts to 32 characters.
2. `createShareToken(supabase, planId, userId)` inserts into `share_tokens` and retries up to 5 times on error.
3. Settings: `GET /api/plans?week=<today>`, then `POST /api/share { plan_id }`, then shows `${origin}/share/${token}`.
4. `/share/[token]` (public in the proxy) looks up the token with `maybeSingle()` and returns 404 if it's missing. Otherwise it calls `getWeekPlan` and lists the slots sorted by date and position.

RLS (migration 0002) adds `for select` policies so the anonymous role can read `plans` and `plan_slots` with a token, and `recipes` that sit in such a plan. Mutations still need membership.

## Invariants and gotchas

- **Wrong week:** settings uses `new Date().toISOString().slice(0, 10)` (today, in UTC), while `/plan` uses the Monday. Unless today is Monday, `getOrCreatePlan` creates a new, empty plan keyed by today's date, and that's what gets shared.
- `GET /api/share/[token]` exists but sits behind the proxy, so anonymous callers get redirected. The page doesn't use it; it queries Supabase directly.
- Tokens never expire. A user can delete their own tokens (`st_delete`), but no UI does that.
- Shared pages show recipe **names** only, not ingredients or steps, even though RLS would allow reading the recipe rows.

## Known gaps

- **Token enumeration:** `st_select using (true)` lets anyone with the public anon key list every token, and so read every shared plan and its recipes. A fix would be a `security definer` function `get_shared_plan(token)` that replaces the open select.
- The wrong-week bug above. The fix is to reuse `startOfWeek(…, { weekStartsOn: 1 })` in settings.
- No list of active links and no way to revoke one.

## Examples

```ts
generateShareToken(); // 32 chars from [A-Za-z0-9_-]
// → shared at `${location.origin}/share/${token}`
```

## Related

- [[concepts]]
- [[rls-authorization]]
- [[week-plan]]
- [[database-schema]]

## Sources

- `src/lib/share-token.ts`, `src/lib/db/households.ts`, `src/app/api/share/**`, `src/app/share/[token]/page.tsx`
- `src/app/(app)/settings/page.tsx`, `supabase/migrations/0002_share_token_rls.sql`
- Commits `a147dfd` (share links) and `07eb51c` (token-scoped RLS)

## Changelog

- 2026-10-04: Created from legacy `sharing.md`. Added the wrong-week bug, token enumeration and the unreachable API route.
