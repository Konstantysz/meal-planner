-- 1. Household on signup, in the database.
--    Before: AuthForm called create_household_with_owner right after signUp().
--    With email confirmation on there is no session yet, the RPC raised
--    "not authenticated", and the user was left without a household forever.
--    After: a trigger on auth.users creates the household + owner row for
--    every new user, whatever the client does.
-- 2. create_household_with_owner becomes idempotent (returns the caller's
--    existing household), so the old client code can't create a second one
--    while old and new code overlap. Kept for compatibility; nothing new calls it.
-- 3. save_recipe: recipe + ingredients + steps in one transaction.
--    Before: three separate inserts from createRecipe; a failure after the
--    first left an orphan recipe without ingredients or steps.
--    SECURITY INVOKER: RLS still decides (rec_insert, ri_all, rs_all).
--
-- Requires app code that calls save_recipe and no longer calls
-- create_household_with_owner after signUp (same PR).
-- Rollback: supabase/rollbacks/0006_atomic_recipe_and_signup_trigger.down.sql

-- ---------------------------------------------------------------------------
-- 1. Signup trigger
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into households (name)
  values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'Moje gospodarstwo'))
  returning id into new_household_id;

  insert into household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'owner');

  return new;
end;
$$;

-- Only the trigger calls it.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: users who signed up while confirmation broke the RPC.
do $$
declare
  u record;
  hid uuid;
begin
  for u in
    select id, email from auth.users au
    where not exists (select 1 from household_members hm where hm.user_id = au.id)
  loop
    insert into households (name)
    values (coalesce(nullif(split_part(u.email, '@', 1), ''), 'Moje gospodarstwo'))
    returning id into hid;
    insert into household_members (household_id, user_id, role) values (hid, u.id, 'owner');
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Idempotent signup RPC (compatibility)
-- ---------------------------------------------------------------------------

create or replace function public.create_household_with_owner(household_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  new_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select household_id into existing_id
  from household_members
  where user_id = auth.uid() and role = 'owner'
  limit 1;
  if existing_id is not null then
    return existing_id;
  end if;

  insert into households (name) values (household_name)
  returning id into new_household_id;

  insert into household_members (household_id, user_id, role)
  values (new_household_id, auth.uid(), 'owner');

  return new_household_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Atomic recipe save
-- ---------------------------------------------------------------------------

-- p_recipe is RecipeInputSchema output (validated by Zod in createRecipe):
-- { name, servings_base, prep_time_min, source_url, visibility, diet_tags,
--   allergens, ingredients: [{ingredient_id, amount, unit, raw_text, position}],
--   steps: [{position, text}] }. The author is always auth.uid().
create or replace function public.save_recipe(p_household_id uuid, p_recipe jsonb)
returns public.recipes
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved public.recipes;
begin
  if coalesce(jsonb_array_length(p_recipe -> 'ingredients'), 0) = 0
     or coalesce(jsonb_array_length(p_recipe -> 'steps'), 0) = 0 then
    raise exception 'recipe needs at least one ingredient and one step'
      using errcode = '22023';
  end if;

  insert into recipes (
    household_id, author_id, name, servings_base, prep_time_min,
    source_url, visibility, diet_tags, allergens
  )
  values (
    p_household_id,
    auth.uid(),
    p_recipe ->> 'name',
    (p_recipe ->> 'servings_base')::int,
    (p_recipe ->> 'prep_time_min')::int,
    p_recipe ->> 'source_url',
    coalesce(p_recipe ->> 'visibility', 'household'),
    coalesce(array(select jsonb_array_elements_text(p_recipe -> 'diet_tags')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_recipe -> 'allergens')), '{}')
  )
  returning * into saved;

  insert into recipe_ingredients (recipe_id, ingredient_id, amount, unit, raw_text, position)
  select saved.id, i.ingredient_id, i.amount, i.unit, i.raw_text, i.position
  from jsonb_to_recordset(p_recipe -> 'ingredients')
    as i(ingredient_id uuid, amount numeric, unit text, raw_text text, position int);

  insert into recipe_steps (recipe_id, position, text)
  select saved.id, s.position, s.text
  from jsonb_to_recordset(p_recipe -> 'steps') as s(position int, text text);

  return saved;
end;
$$;

revoke execute on function public.save_recipe(uuid, jsonb) from public, anon;
grant execute on function public.save_recipe(uuid, jsonb) to authenticated;
