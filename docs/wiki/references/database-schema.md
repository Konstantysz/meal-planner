---
title: "Database Schema"
summary: "Tables, constraints, foreign-key delete behaviour, RLS policies, SQL functions, migrations and seed of the Supabase Postgres database."
tags: [database, rls]
status: review
owner: "@konstantysz"
created: 2026-10-04
updated: 2026-10-05
last_reviewed: null
review_interval_days: 180
confidence: high
llm_generated: true
llm_model: "claude-opus-5-5"
human_reviewed: false
verified_commit: 5561f57
sources:
  - title: "Initial schema and RLS"
    path: supabase/migrations/0001_initial.sql
  - title: "Share-token RLS policies"
    path: supabase/migrations/0002_share_token_rls.sql
  - title: "Household signup RPC"
    path: supabase/migrations/0003_household_signup_rpc.sql
  - title: "Security hardening"
    path: supabase/migrations/0004_security_hardening.sql
  - title: "0004 rollback"
    path: supabase/rollbacks/0004_security_hardening.down.sql
  - title: "0004 verification script"
    path: supabase/checks/0004_security_hardening.verify.sql
  - title: "Share-link RPC"
    path: supabase/migrations/0005_share_link_rpc.sql
  - title: "Atomic recipe save and signup trigger"
    path: supabase/migrations/0006_atomic_recipe_and_signup_trigger.sql
  - title: "Optional ingredient flag"
    path: supabase/migrations/0007_recipe_ingredient_optional.sql
  - title: "Ingredient seed"
    path: supabase/seed.sql
  - title: "Supabase CLI config"
    path: supabase/config.toml
---

# Database Schema

> [!tldr]
> There are 10 tables, all with RLS enabled. Access hangs off `is_member_of(household_id)`. Seven migrations exist: the initial schema, share-token read policies (dropped in 0005), the signup RPC, security hardening (0004), the share-link RPC (0005), the atomic recipe save plus signup trigger (0006), and the optional-ingredient flag (0007). Full history with reasons: [[migration-history]]. Member policies apply to `authenticated` only; `anon` reads share links only through `get_shared_plan`. The seed loads 40 ingredients and is **not** idempotent.

## Context

This is the lookup table for the Supabase Postgres database. Project ref `tfysxpkfbumctfuxcend` (name "meal-planner", region eu-west-1, per the legacy wiki); the local CLI config pins Postgres 17. See [[references]]. Shared TypeScript row types live in `src/lib/types.ts`, and they mirror these tables by hand. Nothing generates them from the schema.

## Tables

| Table | Key | Notable columns and constraints |
|---|---|---|
| `households` | `id` uuid | `name` |
| `household_members` | (`household_id`, `user_id`) | `role` ∈ {`owner`, `member`}. FK to `households` and `auth.users`, both `on delete cascade`. |
| `ingredients` | `id` uuid | `category` ∈ 11 Polish categories. `kcal/protein/fat/carbs_per_100g` are nullable numerics. `source` ∈ {`off`, `manual`, `ai_estimate`}. Unique index on `lower(name)`. |
| `recipes` | `id` uuid | `household_id` (cascade), `author_id`, `servings_base > 0`, `visibility` ∈ {`private`, `household`, `public_link`}, `diet_tags text[]`, `allergens text[]` |
| `recipe_ingredients` | `id` uuid | `recipe_id` (cascade), `ingredient_id` (**no on-delete action**), nullable `amount` and `unit`, `raw_text`, `position`, `optional` (boolean, default false; excluded from recipe macros) |
| `recipe_steps` | `id` uuid | `recipe_id` (cascade), `position`, `text` |
| `plans` | `id` uuid | `household_id` (cascade), `week_start_date date`, `unique (household_id, week_start_date)`, check `plans_week_start_monday` (ISO weekday 1, since 0005) |
| `plan_slots` | `id` uuid | `plan_id` (cascade), `date`, `position`, `label`, `recipe_id` (**on delete set null**), `servings numeric > 0` default 1, `unique (plan_id, date, position)` |
| `pantry_items` | (`household_id`, `ingredient_id`) | `have_it boolean`. Nothing in the app uses this table yet. |
| `share_tokens` | `token` text | `plan_id` (cascade), `created_by` |

> [!warning] Delete behaviour
> Deleting an ingredient that any recipe uses fails with a foreign-key violation (`NO ACTION`). Deleting a recipe sets `plan_slots.recipe_id` to null but keeps the slot.

## Functions

| Function | Kind | Purpose |
|---|---|---|
| `is_member_of(hid uuid)` | `security definer`, `stable`, SQL, `search_path = public` | True if `auth.uid()` has a row in `household_members` for `hid`. Used by most policies. `execute` is granted to `authenticated` only (0004). |
| `is_owner_of(hid uuid)` | `security definer`, `stable`, SQL, `search_path = public` | True if `auth.uid()` is the household's `owner`. Used by `hm_delete`. `authenticated` only. Added in 0004. |
| `create_household_with_owner(household_name text)` | `security definer`, plpgsql | Returns the caller's owned household, or creates one with an `owner` membership; raises if unauthenticated. Idempotent since 0006. Kept for compatibility: the app no longer calls it. `authenticated` only. |
| `handle_new_user()` | trigger function, `security definer`, plpgsql | Run by trigger `on_auth_user_created` (after insert on `auth.users`). Creates the household (email local part, fallback „Moje gospodarstwo") and the `owner` row. No role can execute it directly. Added in 0006. |
| `save_recipe(p_household_id uuid, p_recipe jsonb)` | `security invoker`, plpgsql, returns `recipes` | Inserts recipe, ingredients and steps in one transaction; author is `auth.uid()`; raises `22023` without ingredients or steps. RLS applies. `authenticated` only. Added in 0006; stores each ingredient's `optional` flag (missing = false) since 0007. |
| `get_shared_plan(p_token text)` | `security definer`, `stable`, SQL, `search_path = public` | Returns the plan a share token unlocks as JSON (week, slots, recipe names), or null. `execute` for `anon` and `authenticated`. Added in 0005. See [[share-links]]. |

`rls_auto_enable()` also lives in `public`, but Supabase creates it (event trigger `ensure_rls`), not our migrations. 0004 revokes `execute` on it from `anon` and `authenticated`.

## RLS policies

Policies for the same command are OR'd together. Since 0004, every policy except `ing_select` is `to authenticated` (0005 removed the share-token ones), and `auth.uid()` is written as `(select auth.uid())` so it is evaluated once per statement.

| Table | Policy | Command | Rule |
|---|---|---|---|
| `households` | `households_select` | select | `is_member_of(id)` |
| | `households_update` | update | `is_member_of(id)`, same check |
| `household_members` | `hm_select` | select | `user_id = auth.uid() or is_member_of(household_id)` |
| | `hm_insert` | insert | `is_member_of(household_id) and role = 'member'` (only a member invites, never as owner) |
| | `hm_delete` | delete | a member removes themselves (`role = 'member'`), or the owner removes someone else |
| `ingredients` | `ing_select` | select | `true` (public, including anonymous) |
| | `ing_insert` / `ing_update` | insert / update | any `authenticated` user, any row |
| `recipes` | `rec_select` | select | `visibility = 'public_link' or author_id = auth.uid() or is_member_of(household_id)` (authenticated only) |
| | `rec_insert` | insert | `author_id = auth.uid() and is_member_of(household_id)` |
| | `rec_update` | update | using: author or member. check: `is_member_of(household_id)` (can't move a recipe out to a foreign household) |
| | `rec_delete` | delete | `author_id = auth.uid()` |
| `recipe_ingredients`, `recipe_steps` | `ri_all`, `rs_all` | all | the parent recipe's author or household member |
| `plans` | `plans_all` | all | `is_member_of(household_id)` |
| `plan_slots` | `plan_slots_all` | all | member of the parent plan's household |
| `pantry_items` | `pantry_all` | all | `is_member_of(household_id)` |
| `share_tokens` | `st_select` | select | `created_by = auth.uid()` (0005; was `true`) |
| | `st_insert` | insert | `created_by = auth.uid()` and the plan belongs to the caller's household |
| | `st_delete` | delete | `created_by = auth.uid()` |

`ingredients` and `households` have no delete policy, and `households` has no insert policy, so those are always denied through the API.

## Indexes on foreign keys

0004 added covering indexes for every foreign key that lacked one: `household_members(user_id)`, `ingredients(created_by)`, `pantry_items(ingredient_id)`, `plan_slots(recipe_id)`, `recipe_ingredients(ingredient_id)`, `recipes(author_id)`, `share_tokens(created_by)`, `share_tokens(plan_id)`.

## Migrations

| File | Adds |
|---|---|
| `0001_initial.sql` | All tables, indexes, RLS enablement, `is_member_of`, member and owner policies |
| `0002_share_token_rls.sql` | The three `*_select_via_share_token` policies (dropped in 0005) |
| `0003_household_signup_rpc.sql` | `create_household_with_owner` |
| `0004_security_hardening.sql` | Tightened member, invite and share-token policies, `is_owner_of`, function grants, FK indexes. Rollback: `supabase/rollbacks/0004_security_hardening.down.sql`. Check: `supabase/checks/0004_security_hardening.verify.sql`. |
| `0005_share_link_rpc.sql` | `get_shared_plan`, drops the anon share policies, narrows `st_select`, deletes empty non-Monday plans, adds `plans_week_start_monday`. Rollback: `supabase/rollbacks/0005_share_link_rpc.down.sql`. Check: `supabase/checks/0005_share_link_rpc.verify.sql`. |
| `0006_atomic_recipe_and_signup_trigger.sql` | `on_auth_user_created` trigger + `handle_new_user`, household backfill, idempotent `create_household_with_owner`, `save_recipe`. Rollback: `supabase/rollbacks/0006_atomic_recipe_and_signup_trigger.down.sql`. Check: `supabase/checks/0006_atomic_recipe_and_signup_trigger.verify.sql`. |
| `0007_recipe_ingredient_optional.sql` | `recipe_ingredients.optional`; `save_recipe` stores it. Rollback: `supabase/rollbacks/0007_recipe_ingredient_optional.down.sql`. Check: `supabase/checks/0007_recipe_ingredient_optional.verify.sql`. |

## Seed

`supabase/seed.sql` inserts 40 common Polish ingredients with macros (`source = 'off'`). It has no `on conflict` clause, so running it a second time violates `ingredients_name_lower_idx`.

## Examples

```sql
-- Which plans can the current user see, and why?
select p.id, p.week_start_date,
       is_member_of(p.household_id) as via_membership
from plans p;
```

## Related

- [[references]]
- [[api-routes]]: which routes touch which tables
- [[env-vars]]
- [[rls-authorization]]: the model and its loose spots
- [[household-model]]
- [[apply-migration]]

## Sources

- `supabase/migrations/0001_initial.sql`, `0002_share_token_rls.sql`, `0003_household_signup_rpc.sql`, `0004_security_hardening.sql`, `0005_share_link_rpc.sql`, `0006_atomic_recipe_and_signup_trigger.sql`, `0007_recipe_ingredient_optional.sql`
- `supabase/seed.sql`, `supabase/config.toml`
- Supabase security and performance advisors, run 2026-10-04

## Changelog

- 2026-10-05: Documented migration 0007 (`recipe_ingredients.optional`).
- 2026-10-04: Documented migration 0006 (signup trigger, `save_recipe`, idempotent signup RPC).
- 2026-10-04: Documented migration 0005 (`get_shared_plan`, share policies removed, Monday constraint).
- 2026-10-04: Documented migration 0004 (policies, `is_owner_of`, grants, FK indexes).
- 2026-10-04: Created from legacy `database.md` plus a full read of the migrations. Added the policy table, functions and migration 0003.
