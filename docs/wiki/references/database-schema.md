---
title: "Database Schema"
summary: "Tables, constraints, foreign-key delete behaviour, RLS policies, SQL functions, migrations and seed of the Supabase Postgres database."
tags: [database, rls]
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
  - title: "Initial schema and RLS"
    path: supabase/migrations/0001_initial.sql
  - title: "Share-token RLS policies"
    path: supabase/migrations/0002_share_token_rls.sql
  - title: "Household signup RPC"
    path: supabase/migrations/0003_household_signup_rpc.sql
  - title: "Ingredient seed"
    path: supabase/seed.sql
  - title: "Supabase CLI config"
    path: supabase/config.toml
---

# Database Schema

> [!tldr]
> There are 10 tables, all with RLS enabled. Access hangs off `is_member_of(household_id)`. Three migrations exist: the initial schema, share-token read policies, and the signup RPC. The seed loads 40 ingredients and is **not** idempotent.

## Context

This is the lookup table for the Supabase Postgres database. Project ref `tfysxpkfbumctfuxcend`; the local CLI config pins Postgres 17. See [[references]]. Shared TypeScript row types live in `src/lib/types.ts`, and they mirror these tables by hand. Nothing generates them from the schema.

## Tables

| Table | Key | Notable columns and constraints |
|---|---|---|
| `households` | `id` uuid | `name` |
| `household_members` | (`household_id`, `user_id`) | `role` ∈ {`owner`, `member`}. FK to `households` and `auth.users`, both `on delete cascade`. |
| `ingredients` | `id` uuid | `category` ∈ 11 Polish categories. `kcal/protein/fat/carbs_per_100g` are nullable numerics. `source` ∈ {`off`, `manual`, `ai_estimate`}. Unique index on `lower(name)`. |
| `recipes` | `id` uuid | `household_id` (cascade), `author_id`, `servings_base > 0`, `visibility` ∈ {`private`, `household`, `public_link`}, `diet_tags text[]`, `allergens text[]` |
| `recipe_ingredients` | `id` uuid | `recipe_id` (cascade), `ingredient_id` (**no on-delete action**), nullable `amount` and `unit`, `raw_text`, `position` |
| `recipe_steps` | `id` uuid | `recipe_id` (cascade), `position`, `text` |
| `plans` | `id` uuid | `household_id` (cascade), `week_start_date date`, `unique (household_id, week_start_date)` |
| `plan_slots` | `id` uuid | `plan_id` (cascade), `date`, `position`, `label`, `recipe_id` (**on delete set null**), `servings numeric > 0` default 1, `unique (plan_id, date, position)` |
| `pantry_items` | (`household_id`, `ingredient_id`) | `have_it boolean`. Nothing in the app uses this table yet. |
| `share_tokens` | `token` text | `plan_id` (cascade), `created_by` |

> [!warning] Delete behaviour
> Deleting an ingredient that any recipe uses fails with a foreign-key violation (`NO ACTION`). Deleting a recipe sets `plan_slots.recipe_id` to null but keeps the slot.

## Functions

| Function | Kind | Purpose |
|---|---|---|
| `is_member_of(hid uuid)` | `security definer`, `stable`, SQL | True if `auth.uid()` has a row in `household_members` for `hid`. Used by most policies. |
| `create_household_with_owner(household_name text)` | `security definer`, plpgsql | Inserts a household and an `owner` membership for `auth.uid()` in a single call, and raises if unauthenticated. `execute` is granted to `authenticated`. |

## RLS policies

Policies for the same command are OR'd together.

| Table | Policy | Command | Rule |
|---|---|---|---|
| `households` | `households_select` | select | `is_member_of(id)` |
| | `households_insert` | insert | `true` |
| | `households_update` | update | `is_member_of(id)` |
| `household_members` | `hm_select` / `hm_insert` / `hm_delete` | select / insert / delete | `user_id = auth.uid() or is_member_of(household_id)` |
| `ingredients` | `ing_select` | select | `true` (public, including anonymous) |
| | `ing_insert` / `ing_update` | insert / update | `auth.uid() is not null` (any signed-in user, any row) |
| `recipes` | `rec_select` | select | `visibility = 'public_link' or author_id = auth.uid() or is_member_of(household_id)` |
| | `rec_insert` | insert | `author_id = auth.uid() and is_member_of(household_id)` |
| | `rec_update` | update | `author_id = auth.uid() or is_member_of(household_id)` |
| | `rec_delete` | delete | `author_id = auth.uid()` |
| | `recipes_select_via_share_token` | select | the recipe is in a slot of any plan that has a share token |
| `recipe_ingredients`, `recipe_steps` | `ri_all`, `rs_all` | all | the parent recipe's author or household member |
| `plans` | `plans_all` | all | `is_member_of(household_id)` |
| | `plans_select_via_share_token` | select | a `share_tokens` row exists for the plan |
| `plan_slots` | `plan_slots_all` | all | member of the parent plan's household |
| | `plan_slots_select_via_share_token` | select | a `share_tokens` row exists for the slot's plan |
| `pantry_items` | `pantry_all` | all | `is_member_of(household_id)` |
| `share_tokens` | `st_select` | select | `true` |
| | `st_insert` | insert | `auth.uid() is not null` |
| | `st_delete` | delete | `created_by = auth.uid()` |

`ingredients` and `households` have no delete policy, so deletes on them are always denied.

## Migrations

| File | Adds |
|---|---|
| `0001_initial.sql` | All tables, indexes, RLS enablement, `is_member_of`, member and owner policies |
| `0002_share_token_rls.sql` | The three `*_select_via_share_token` policies |
| `0003_household_signup_rpc.sql` | `create_household_with_owner` |

## Seed

`supabase/seed.sql` inserts 40 common Polish ingredients with macros (`source = 'off'`). It has no `on conflict` clause, so running it a second time violates `ingredients_name_lower_idx`.

## Examples

```sql
-- Which plans can the current user see, and why?
select p.id, p.week_start_date,
       is_member_of(p.household_id) as via_membership,
       exists (select 1 from share_tokens st where st.plan_id = p.id) as via_share_token
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

- `supabase/migrations/0001_initial.sql`, `0002_share_token_rls.sql`, `0003_household_signup_rpc.sql`
- `supabase/seed.sql`, `supabase/config.toml`

## Changelog

- 2026-10-04: Created from legacy `database.md` plus a full read of the migrations. Added the policy table, functions and migration 0003.
