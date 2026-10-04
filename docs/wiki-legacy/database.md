# Database

Supabase Postgres, project ref `tfysxpkfbumctfuxcend` (name "meal-planner", region eu-west-1). Migration: `supabase/migrations/0001_initial.sql`. Seed: `supabase/seed.sql` (40 ingredients, applied live).

## Tables
households, household_members, ingredients, recipes, recipe_ingredients, recipe_steps, plans, plan_slots, pantry_items, share_tokens. RLS enabled on all.

## Key constraints
- `plans` has `unique(household_id, week_start_date)`.
- `plan_slots` has `unique(plan_id, date, position)`; `recipe_id` FK is `on delete set null` (a deleted recipe nulls the slot's recipe_id rather than deleting the slot — verified in migration SQL, not yet live-tested since no users exist).
- `ingredients.name` has a case-insensitive unique index (`lower(name)`).
- `recipe_ingredients.ingredient_id` FK has no explicit `ON DELETE` (defaults to `NO ACTION` — deleting a referenced ingredient will fail with a FK violation).

## RLS design notes
- `ingredients` is public-read, any-authenticated-write (crowd-sourced reference data, no per-row ownership enforced — intentional plan design, not a bug).
- `recipes` update policy allows any household member to update any household recipe (including reassigning `author_id`), not just the author. Matches plan spec.
- New households need a `household_members` row (role 'owner') created in the same flow or the creator won't pass `is_member_of()` — handled client-side in signup (see [auth.md](auth.md)), not enforced by a trigger.

## Known gaps (deferred, not blocking)
- `createRecipe`'s 3-step insert (recipe → recipe_ingredients → recipe_steps) isn't transactional — a failure after the recipe row commits can orphan it with no ingredients/steps.
- No idempotency on seed.sql (`on conflict` missing) — re-running it will violate the unique index.
