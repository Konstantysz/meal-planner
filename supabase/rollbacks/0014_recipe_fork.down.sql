-- Manual rollback for migrations/0014_recipe_fork.sql.
-- Not picked up by `supabase db push` (outside supabase/migrations).
-- Roll back the app code first: the fork button and POST /api/recipes/[id]/fork call fork_recipe,
-- which this drops.
-- Loses recipes.forked_from_id (the fork -> original links). Forks made since 0014 stay as ordinary
-- recipes of the member who forked them.
-- Run in the SQL editor, then: supabase migration repair --status reverted 0014

begin;

drop function public.fork_recipe(uuid);

-- 0004 policies: any household member edits a recipe and its ingredients and steps.
drop policy rec_update on public.recipes;
drop policy rec_delete on public.recipes;

create policy rec_update on recipes for update to authenticated
  using (author_id = (select auth.uid()) or is_member_of(household_id))
  with check (is_member_of(household_id));
create policy rec_delete on recipes for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy ri_select on public.recipe_ingredients;
drop policy ri_insert on public.recipe_ingredients;
drop policy ri_update on public.recipe_ingredients;
drop policy ri_delete on public.recipe_ingredients;
drop policy rs_select on public.recipe_steps;
drop policy rs_insert on public.recipe_steps;
drop policy rs_update on public.recipe_steps;
drop policy rs_delete on public.recipe_steps;

create policy ri_all on recipe_ingredients for all to authenticated
  using (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or is_member_of(r.household_id))
  ))
  with check (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or is_member_of(r.household_id))
  ));

create policy rs_all on recipe_steps for all to authenticated
  using (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or is_member_of(r.household_id))
  ))
  with check (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or is_member_of(r.household_id))
  ));

drop index public.recipes_forked_from_idx;
alter table public.recipes drop column forked_from_id;

commit;
