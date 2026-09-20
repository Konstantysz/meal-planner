-- Atomically create a household and its owner membership row.
-- Fixes a chicken-and-egg RLS bug: inserting a household then immediately
-- reading it back (via .select().single()) failed households_select's
-- is_member_of() check, since no household_members row existed yet at
-- read time. A single security definer function does both inserts server
-- side, as one statement, before RLS ever needs to evaluate is_member_of().
create or replace function create_household_with_owner(household_name text)
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

grant execute on function create_household_with_owner(text) to authenticated;
