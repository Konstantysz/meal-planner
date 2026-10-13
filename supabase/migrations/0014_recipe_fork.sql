-- Recipe forks: only the saving member or an app admin changes a recipe (#75).
--   Before: rec_update let any household member edit any household recipe (0004), and ri_all /
--   rs_all let any member insert, change or delete the ingredients and steps of any household
--   recipe. rec_delete was already author-only, but a refused delete affected 0 rows silently.
--   After: rec_update and rec_delete need the author (recipes.author_id) or an app admin
--   (is_app_admin(), 0010). ri_all / rs_all are split: select keeps the old household rule,
--   insert/update/delete need the parent recipe's author or an app admin.
--   Another member who wants to change a recipe forks it: fork_recipe copies it with its recipe
--   ingredients and steps as the caller's own recipe, linked through recipes.forked_from_id.
-- Reads are unchanged (rec_select). An app admin still needs to read the recipe (rec_select:
-- household member or author) to update or delete it: RLS checks visibility before the write.
-- update_recipe (0009) already raises 42501 when RLS filters its update, so it now refuses
-- non-authors with no change to the function. save_recipe and update_recipe are not redefined.
-- Plan slots keep pointing at the recipe they were planned with: nothing rewrites them.
-- Requires app code that forks before editing someone else's recipe (same PR); old app code
-- gets a 403 on such an edit instead of saving it.
-- Columns: fork_recipe copies the recipes columns as of 0010. Open PRs add more: #92
-- (recipes.image_url, 0011) and the 0013 PR (recipes.updated_at, nullable author_id). Whichever of
-- those merges after this one must extend fork_recipe in a NEW migration (never edit this file).
-- Rollback: supabase/rollbacks/0014_recipe_fork.down.sql

-- ---------------------------------------------------------------------------
-- recipes.forked_from_id
-- ---------------------------------------------------------------------------

alter table public.recipes
  add column forked_from_id uuid references public.recipes (id) on delete set null;

-- Covers the foreign key: deleting a recipe looks up its forks to null the link.
create index recipes_forked_from_idx on public.recipes (forked_from_id);

-- ---------------------------------------------------------------------------
-- recipes: write policies
-- ---------------------------------------------------------------------------

drop policy rec_update on public.recipes;
drop policy rec_delete on public.recipes;

-- with check also keeps the recipe inside a household the caller belongs to (as in 0004), and
-- stops an author from handing the recipe to someone else (author_id must stay the caller's).
create policy rec_update on public.recipes for update to authenticated
  using (author_id = (select auth.uid()) or (select is_app_admin()))
  with check (
    is_member_of(household_id)
    and (author_id = (select auth.uid()) or (select is_app_admin()))
  );
create policy rec_delete on public.recipes for delete to authenticated
  using (author_id = (select auth.uid()) or (select is_app_admin()));

-- ---------------------------------------------------------------------------
-- recipe_ingredients / recipe_steps: reads follow the household, writes follow the author
-- ---------------------------------------------------------------------------
-- The exists() subqueries read recipes under the caller's RLS, so a write also needs the parent
-- recipe to be readable. save_recipe and update_recipe write children of a recipe the caller
-- authors (or, for an admin, may edit), so both keep working.

drop policy ri_all on public.recipe_ingredients;
drop policy rs_all on public.recipe_steps;

create policy ri_select on public.recipe_ingredients for select to authenticated
  using (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or is_member_of(r.household_id))
  ));
create policy ri_insert on public.recipe_ingredients for insert to authenticated
  with check (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or (select is_app_admin()))
  ));
create policy ri_update on public.recipe_ingredients for update to authenticated
  using (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or (select is_app_admin()))
  ))
  with check (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or (select is_app_admin()))
  ));
create policy ri_delete on public.recipe_ingredients for delete to authenticated
  using (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or (select is_app_admin()))
  ));

create policy rs_select on public.recipe_steps for select to authenticated
  using (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or is_member_of(r.household_id))
  ));
create policy rs_insert on public.recipe_steps for insert to authenticated
  with check (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or (select is_app_admin()))
  ));
create policy rs_update on public.recipe_steps for update to authenticated
  using (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or (select is_app_admin()))
  ))
  with check (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or (select is_app_admin()))
  ));
create policy rs_delete on public.recipe_steps for delete to authenticated
  using (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or (select is_app_admin()))
  ));

-- ---------------------------------------------------------------------------
-- fork_recipe
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: every step is something RLS already lets the caller do. The source recipe and
-- its children are read through rec_select / ri_select / rs_select (a recipe the caller cannot
-- read raises P0002, as if it did not exist). The copy is inserted with author_id = auth.uid() into
-- a household the caller belongs to, which rec_insert requires, and its children belong to a
-- recipe the caller authors, which ri_insert / rs_insert require. No definer rights are needed.
-- Household of the fork: the source recipe's household when the caller is a member (the normal
-- case: another member's recipe), otherwise the caller's own household (owner role first).
-- Idempotent per caller: when the caller already has a fork of this source in that household, the
-- most recent one is returned instead of creating another (repeated "Edytuj" makes no duplicates).
-- A new fork copies the recipes columns as of 0010 except id, household_id, author_id and
-- created_at; its name gets the suffix " (kopia)" (once, kept within the app's 200-character
-- limit). forked_from_id points at the source (a fork of a fork points at its direct source).
-- A recipe readable without its ingredients or steps (public_link from outside the household:
-- ri_select / rs_select hide them) would copy into an empty recipe, so that raises 22023.
create or replace function public.fork_recipe(p_recipe_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  src public.recipes;
  target_household uuid;
  new_id uuid;
  n int;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into src from recipes where id = p_recipe_id;
  if not found then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;

  if is_member_of(src.household_id) then
    target_household := src.household_id;
  else
    select household_id into target_household
    from household_members
    where user_id = (select auth.uid())
    order by (role = 'owner') desc, household_id
    limit 1;
    if target_household is null then
      raise exception 'no household' using errcode = '42501';
    end if;
  end if;

  select id into new_id
  from recipes
  where forked_from_id = src.id
    and author_id = (select auth.uid())
    and household_id = target_household
  order by created_at desc, id
  limit 1;
  if new_id is not null then
    return new_id;
  end if;

  insert into recipes (
    household_id, author_id, name, servings_base, prep_time_min, source_url,
    visibility, diet_tags, allergens, source_author, forked_from_id
  )
  values (
    target_household, (select auth.uid()),
    case when src.name like '% (kopia)' then src.name else left(src.name, 192) || ' (kopia)' end,
    src.servings_base, src.prep_time_min,
    src.source_url, src.visibility, src.diet_tags, src.allergens, src.source_author, src.id
  )
  returning id into new_id;

  insert into recipe_ingredients (recipe_id, ingredient_id, amount, unit, raw_text, position, optional)
  select new_id, ri.ingredient_id, ri.amount, ri.unit, ri.raw_text, ri.position, ri.optional
  from recipe_ingredients ri
  where ri.recipe_id = src.id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'recipe has no readable ingredients' using errcode = '22023';
  end if;

  insert into recipe_steps (recipe_id, position, text, title)
  select new_id, rs.position, rs.text, rs.title
  from recipe_steps rs
  where rs.recipe_id = src.id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'recipe has no readable steps' using errcode = '22023';
  end if;

  return new_id;
end;
$$;

revoke execute on function public.fork_recipe(uuid) from public, anon;
grant execute on function public.fork_recipe(uuid) to authenticated;
