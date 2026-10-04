---
title: "RLS Authorization"
summary: "Postgres Row Level Security is the app's authorization boundary: the membership model, what each role can do, and the known permissive spots."
tags: [rls, security, database]
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
verified_commit: 19a988a
sources:
  - title: "Initial RLS policies"
    path: supabase/migrations/0001_initial.sql
  - title: "Share-token policies"
    path: supabase/migrations/0002_share_token_rls.sql
  - title: "Security hardening"
    path: supabase/migrations/0004_security_hardening.sql
  - title: "Agent orientation (RLS convention)"
    path: AGENTS.md
---

# RLS Authorization

> [!tldr]
> Route handlers don't check permissions; Postgres RLS does. Access is "member of the row's household", tested by `is_member_of()`. Ingredients are crowd-sourced (any signed-in user can edit any row). Since migration 0004, member policies apply to `authenticated` only, and invites, member removal and token creation are locked down. Still loose: tokens are publicly listable, and any member can edit any household recipe.

## Context

Every query runs as the user, through the anon key and the session cookie (see [[auth-session]]), so a missing or loose policy is a real hole. The full policy list is in [[database-schema#RLS policies]]. This page explains the model and its risks. See [[concepts]].

## How it works

```mermaid
flowchart TD
  U["auth.uid()"] --> HM[household_members]
  HM -->|is_member_of| H[households]
  H --> R[recipes] --> RI[recipe_ingredients] & RS[recipe_steps]
  H --> P[plans] --> PS[plan_slots]
  H --> PI[pantry_items]
  ST[share_tokens] -.select-only.-> P & PS & R
```

- `is_member_of(hid)` is `security definer`, so it can read `household_members` without hitting that table's own policies recursively. `is_owner_of(hid)` works the same way. Both pin `search_path` and only `authenticated` can execute them.
- Member policies are `to authenticated`. `anon` reaches data only through the share-token policies and `ing_select`. A policy that applies to `anon` must not call `is_member_of`: `anon` has no `execute` on it, so the query would fail instead of returning no rows.
- Child tables (`recipe_ingredients`, `recipe_steps`, `plan_slots`) check access through their parent with `exists (…)`.
- Same-command policies are OR'd. The share-token policies **add** anonymous read paths alongside the member policies. See [[share-links]].

## Where the code adds checks anyway

- `inviteMember` checks caller membership explicitly (see [[household-model]]).
- `POST /api/recipes`, `/api/plans` and `/api/shopping` resolve the household server-side, so the client can't choose one.

## Invariants and gotchas

- **An RLS-filtered write isn't an error.** A delete or update that RLS hides affects 0 rows and returns no error. `DELETE /api/recipes/[id]` from a non-author returns 204 and deletes nothing, and the UI then navigates away as if it had worked.
- **An RLS-hidden join returns null.** `getWeekPlan` embeds `recipe:recipes(…)`. If the recipe isn't visible, `slot.recipe` is null while `slot.recipe_id` is set, which is why the UI shows „przepis usunięty". See [[week-plan]].
- When adding a table, enable RLS **and** write policies in the same migration. A table with RLS enabled and no policies denies everything, which fails safe but is confusing.

## Known gaps

| Policy | Looseness | Impact |
|---|---|---|
| `st_select using (true)` | Anyone holding the anon key can list **all** share tokens | Every shared plan, and every recipe in it, can be enumerated |
| `rec_update` | Author **or** any member | Any member can edit any household recipe, including `author_id` (as the plan specified). Since 0004 a recipe can't be moved into a foreign household. |
| `ing_update` | Any signed-in user, any row | Anyone can change any ingredient's macros (intentional crowd-sourcing) |
| `rec_select` `visibility = 'public_link'` | Readable by any signed-in user without membership | No UI sets `public_link`, so this is latent. Since 0004 `anon` can't read it. |

Fixed in 0004: `hm_insert` (self-join, even as owner), `hm_delete` (any member could remove anyone, including the owner), `households_insert` (open to `anon`), `st_insert` (a token for any plan, which exposed that plan through the share-token policies), and `anon` execute on the `security definer` functions.

## Examples

```sql
-- Reproduce the token-enumeration gap with the anon role
set role anon;
select token, plan_id from share_tokens;  -- returns every token
```

## Related

- [[concepts]]
- [[database-schema]]
- [[household-model]]
- [[share-links]]
- [[0001-rls-is-the-authz-boundary]]
- [[0003-share-token-rls]]

## Sources

- `supabase/migrations/0001_initial.sql`, `0002_share_token_rls.sql`, `0004_security_hardening.sql`
- `AGENTS.md`: "RLS is the authorization boundary"

## Changelog

- 2026-10-04: Updated for migration 0004. Moved the fixed gaps out of the table and added the `anon` / `is_member_of` rule.
- 2026-10-04: Created from the RLS notes in legacy `database.md`. Added the token-enumeration, self-join and silent-delete findings.
