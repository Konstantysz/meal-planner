---
title: "0013 Ingredient Ownership and App Admins"
summary: "An ingredient can be changed only by the user who created it or by an app admin; app admins are granted from the SQL editor only."
tags: [ingredients, rls, security]
aliases: []
status: review
owner: "@konstantysz"
created: 2026-10-13
updated: 2026-10-13
last_reviewed: null
review_interval_days: 180
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 5966c4c
sources:
  - title: "Ingredient ownership and app admins"
    path: supabase/migrations/0010_ingredient_ownership.sql
  - title: "0010 rollback"
    path: supabase/rollbacks/0010_ingredient_ownership.down.sql
  - title: "0010 verification script"
    path: supabase/checks/0010_ingredient_ownership.verify.sql
  - title: "Ingredient data access"
    path: src/lib/db/ingredients.ts
---

# 0013 Ingredient Ownership and App Admins

> [!tldr]
> Every ingredient records its creator, and only that creator or an app admin can change it. Ingredients without a creator (the seed and every row from before migration 0010) are admin-only. App admins live in a table no client can read or write. This amends [[0010-global-ingredient-catalog]]: the catalogue stays shared, but it is no longer editable by everyone.

## Context

Under [[0010-global-ingredient-catalog]] any signed-in user could update any ingredient, so one household could change the macros every other household relies on. Nothing set `ingredients.created_by`, so on 2026-10-13 all 119 live rows had no creator and no change could be attributed. The data audit of that day raised this as a bug (Konstantysz/meal-planner#70). See [[decisions]].

## Decision

**Status:** accepted (migration `0010_ingredient_ownership.sql`, issue Konstantysz/meal-planner#70).

- `ingredients.created_by` defaults to `auth.uid()`. `ing_insert` requires `created_by = auth.uid()`, so a client cannot create a row on someone else's behalf.
- `ing_update` allows the creator or an app admin, in both `using` and `with check`, so a creator cannot hand a row to someone else or orphan it.
- Rows with a null `created_by` are editable by app admins only. That covers the seed and every row created before 0010.
- App admins are rows in `app_admins (user_id)`. RLS is enabled with no policies, and `anon` and `authenticated` have no table privileges, so the app can never grant or list admins. A human adds one in the SQL editor. `is_app_admin()` (`security definer`, `authenticated` only) lets policies ask whether the caller is an admin.
- Deleting a user sets `created_by` to null (`on delete set null`): the ingredient stays and becomes admin-only.
- Reads are unchanged: `ing_select` is still public.

## Alternatives considered

- **Household-scoped ingredients** (a `household_id` on each row): stops cross-household edits, but every household duplicates the same Open Food Facts products, and the global `lower(name)` index would have to become per household. Still possible later as household-private ingredients on top of the shared catalogue, now that rows have an owner.
- **Admin flag in JWT `app_metadata`**: no extra table, but granting needs the service-role API, and a stale token keeps the old role until it refreshes. A table is checked live on every statement and is editable from the SQL editor.
- **No edits at all** (read-only catalogue): blocks fixes to placeholder ingredients, which users create without macros and need to fill in.

## Consequences

- A user can fill in or correct only the ingredients they created. Wrong values in seed or Open Food Facts rows created before 0010 need an app admin.
- At least one app admin must be added by hand after the deploy, or nobody can fix seed rows from the app (the SQL editor and the service-role backfill still can).
- The Supabase advisor lists `is_app_admin` among `security definer` functions executable by `authenticated`. That is deliberate: it only reveals whether the caller is an admin.
- Who changed a value is still not recorded, only who created the row. An audit trail is part of the data governance pass (Konstantysz/meal-planner#76).

## Related

- [[decisions]]
- [[0010-global-ingredient-catalog]]
- [[ingredient-database]]
- [[rls-authorization]]
- [[migration-history]]

## Sources

- `supabase/migrations/0010_ingredient_ownership.sql`, `supabase/rollbacks/0010_ingredient_ownership.down.sql`, `supabase/checks/0010_ingredient_ownership.verify.sql`
- `src/lib/db/ingredients.ts` (`createIngredient` sends no `created_by`)
- Live data, 2026-10-13, via the read-only Supabase MCP: 119 ingredients, all with `created_by` null

## Changelog

- 2026-10-13: Created with migration 0010.
