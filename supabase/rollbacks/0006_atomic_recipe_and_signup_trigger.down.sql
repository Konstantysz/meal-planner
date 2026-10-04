-- Manual rollback for migrations/0006_atomic_recipe_and_signup_trigger.sql.
-- Not picked up by `supabase db push` (outside supabase/migrations).
-- Roll back the app code first: the old AuthForm calls create_household_with_owner
-- after signUp, and the old createRecipe inserts the three tables itself.
-- Households created by the trigger or the backfill are kept: they are real
-- users' households and may already hold recipes and plans.
-- Run in the SQL editor, then: supabase migration repair --status reverted 0006

begin;

drop trigger on_auth_user_created on auth.users;
drop function public.handle_new_user();
drop function public.save_recipe(uuid, jsonb);

-- 0003 version (not idempotent).
create or replace function public.create_household_with_owner(household_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into households (name) values (household_name)
  returning id into new_household_id;

  insert into household_members (household_id, user_id, role)
  values (new_household_id, auth.uid(), 'owner');

  return new_household_id;
end;
$$;

commit;
