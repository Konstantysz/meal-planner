-- Manual rollback for migrations/0013_schema_integrity.sql.
-- Not picked up by `supabase db push` (outside supabase/migrations).
-- Roll back the app code first if it reads recipes.updated_at (src/lib/types.ts only types it).
-- Roll back later migrations that depend on recipes.updated_at or a nullable recipes.author_id
-- first (for example a 0014+ fork_recipe extension).
-- Loses: recipes.updated_at values. Restores: author_id NOT NULL with no on-delete action, share
-- tokens without cascade, and execute on create_household_with_owner for authenticated (0004 grants).
-- Fails, on purpose, if a recipe lost its author to an account deletion since 0013: give those rows
-- an author first (for example the household owner), then run this again.
-- Run in the SQL editor, then: supabase migration repair --status reverted 0013

begin;

-- 5. Signup RPC callable again by signed-in users (0004 state: revoked from public and anon only).
grant execute on function public.create_household_with_owner(text) to authenticated;

-- 4. Slot date rule
drop trigger plans_week_keeps_slots on public.plans;
drop trigger plan_slots_date_in_week on public.plan_slots;
drop function public.check_plan_week_keeps_slots();
drop function public.check_slot_date_in_week();

-- 3. updated_at
drop trigger recipes_set_updated_at on public.recipes;
drop function public.set_updated_at();
alter table public.recipes drop column updated_at;

-- 2. Account deletion
alter table public.share_tokens drop constraint share_tokens_created_by_fkey;
alter table public.share_tokens
  add constraint share_tokens_created_by_fkey
  foreign key (created_by) references auth.users (id);

do $$
begin
  if exists (select 1 from public.recipes where author_id is null) then
    raise exception 'recipes without an author exist (account deleted since 0013); assign an author first'
      using errcode = '23502';
  end if;
end $$;

alter table public.recipes drop constraint recipes_author_id_fkey;
alter table public.recipes
  add constraint recipes_author_id_fkey
  foreign key (author_id) references auth.users (id);
alter table public.recipes alter column author_id set not null;

-- 1. Ingredient and step rows
alter table public.recipe_steps
  drop constraint recipe_steps_text_not_blank,
  drop constraint recipe_steps_position_nonnegative,
  drop constraint recipe_steps_recipe_position_key;

alter table public.recipe_ingredients
  drop constraint recipe_ingredients_amount_positive,
  drop constraint recipe_ingredients_position_nonnegative,
  drop constraint recipe_ingredients_recipe_position_key;

commit;
