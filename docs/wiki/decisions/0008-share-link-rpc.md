---
title: "0008 Share Links via a Token-Checked RPC"
summary: "Anonymous share-link reads go through the security definer function get_shared_plan(token) instead of anon select policies; supersedes 0003."
tags: [sharing, rls, security]
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
verified_commit: dd7dd50
sources:
  - title: "Share-link RPC migration"
    path: supabase/migrations/0005_share_link_rpc.sql
  - title: "getSharedPlan"
    path: src/lib/db/share.ts
  - title: "Verification script"
    path: supabase/checks/0005_share_link_rpc.verify.sql
---

# 0008 Share Links via a Token-Checked RPC

> [!tldr]
> `/share/[token]` reads the plan through `get_shared_plan(token)`, a `security definer` function that returns only what that token unlocks. `anon` has no `select` policy on `share_tokens`, `plans`, `plan_slots` or `recipes`. Supersedes [[0003-share-token-rls]].

## Context

Decision 0003 let anonymous visitors read plans through select policies that checked whether _some_ token existed for a plan, and `st_select using (true)` made every token listable. Together, anyone with the public anon key could enumerate every shared plan and its recipes. See [[decisions]].

## Decision

**Status:** accepted (migration 0005).

- Add `get_shared_plan(p_token text) returns jsonb`: `security definer`, `stable`, `search_path = public`, `execute` for `anon` and `authenticated` only.
- Return only what the share page renders: the week, and per slot its date, position, label, servings and recipe name. No ids except the slot id.
- Drop `plans_select_via_share_token`, `plan_slots_select_via_share_token` and `recipes_select_via_share_token`. Narrow `st_select` to the token's creator.
- Parse the RPC result with Zod (`SharedPlanSchema`) at the boundary, like every other external input.

## Alternatives considered

- Keep the policies, but check the token from a request header (`current_setting('request.headers')`): works with PostgREST, but couples RLS to a transport detail and still exposes whole rows.
- A service-role client in the share page: simple, but it bypasses RLS entirely in a public route.

## Consequences

- Token enumeration and plan enumeration are closed. Checked by `supabase/checks/0005_share_link_rpc.verify.sql`.
- Showing more on the share page (ingredients, steps) means extending the RPC's JSON, not adding policies.
- The RPC bypasses RLS by design. Every field it returns is public to whoever holds the link.

## Related

- [[decisions]]
- [[0003-share-token-rls]]
- [[share-links]]
- [[rls-authorization]]

## Sources

- `supabase/migrations/0005_share_link_rpc.sql`, `src/lib/db/share.ts`, `src/app/share/[token]/page.tsx`

## Changelog

- 2026-10-04: Created with migration 0005.
