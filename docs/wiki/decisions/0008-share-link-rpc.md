---
title: "0008 Share Links via a Token-Checked RPC"
summary: "Anonymous share-link reads go through the security definer function get_shared_plan(token) instead of anon select policies; supersedes 0003."
tags: [sharing, rls, security]
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
- Return the week and, per slot, its id, date, position, label, servings and recipe name. No other ids. The share page renders the date, label, position and recipe name; it does not render `servings`.
- Drop `plans_select_via_share_token`, `plan_slots_select_via_share_token` and `recipes_select_via_share_token`. Narrow `st_select` to the token's creator.
- Parse the RPC result with Zod (`SharedPlanSchema`) at the boundary, like every other external input.

## Alternatives considered

> [!warning] Uncertain
> No record of these alternatives exists in the repo or in commit `0b33ca3`. The header-based variant and the service-role client are not verifiable from code. The header variant is mentioned only in this page.

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

- `supabase/migrations/0005_share_link_rpc.sql`, `src/lib/db/share.ts` (`getSharedPlan`, Zod-parsed), `src/app/share/[token]/page.tsx`, `src/app/api/share/[token]/route.ts`
- Tests: `tests/unit/db/share.test.ts`; verification script `supabase/checks/0005_share_link_rpc.verify.sql`

## Changelog

- 2026-10-09: Re-verified against `a7f8f52`. Corrected the returned fields (`servings` is not rendered). The alternatives section is marked uncertain, so `verified_commit` stays at `dd7dd50`.
- 2026-10-04: Created with migration 0005.
