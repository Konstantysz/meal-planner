---
title: "0003 Share-Token RLS Policies"
summary: "Anonymous share-link reads are granted by additive select-only RLS policies that check for a share_tokens row."
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
verified_commit: 656711c
sources:
  - title: "Share-token RLS migration"
    path: supabase/migrations/0002_share_token_rls.sql
  - title: "Public share page"
    path: src/app/share/[token]/page.tsx
---

# 0003 Share-Token RLS Policies

> [!tldr]
> `/share/[token]` works for anonymous visitors because migration 0002 adds `for select` policies on `plans`, `plan_slots` and `recipes` that allow a row when a `share_tokens` row references its plan. Writes still need membership.

## Context

Anonymous visitors have no `auth.uid()`, so the member-only `for all` policies hid the shared plan and the page returned 404. See [[decisions]].

## Decision

**Status:** accepted (commit `07eb51c`).

Add narrow, additive select policies. Same-command policies are OR'd, so member access is unchanged:

- `plans_select_via_share_token`
- `plan_slots_select_via_share_token`
- `recipes_select_via_share_token` (the recipe is in a slot of a shared plan)

## Alternatives considered

_Not recorded at the time; reconstructed for comparison._

- A service-role client in the share page: simple, but it bypasses RLS entirely in a public route.
- A `security definer` function `get_shared_plan(token)`: it reveals only what the token unlocks, and it's the better option given the consequence below.

## Consequences

- No privileged key in the app.
- **The policies check that _some_ token exists, not that the caller holds it.** Combined with `st_select using (true)`, which makes all tokens readable, anyone can enumerate shared plans. This decision should be superseded by the function approach (see [[share-links#Known gaps]]).

## Related

- [[decisions]]
- [[share-links]]
- [[rls-authorization]]

## Sources

- `supabase/migrations/0002_share_token_rls.sql`, `src/app/share/[token]/page.tsx`, commit `07eb51c`

## Changelog

- 2026-10-04: Recorded retroactively, including the enumeration consequence.
