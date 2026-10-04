-- Verifies migrations/0006_atomic_recipe_and_signup_trigger.sql against a real database.
-- Run as postgres (SQL editor). Creates throwaway rows, plays each check as
-- anon/authenticated, then ALWAYS aborts with an exception: nothing persists.
-- Read the result in the error message:
--   "VERIFY 0006: ALL PASS (n checks)"  or  "VERIFY 0006: FAIL ..." with the list.
-- Before 0006 is applied every check is expected to FAIL (the features don't exist).
-- Needs at least one row in ingredients (the seed provides 40).

do $verify$
declare
  a uuid := gen_random_uuid();  -- new user, signs up
  b uuid := gen_random_uuid();  -- another new user
  ha uuid;
  hb uuid;
  ing uuid;
  rec jsonb;
  saved jsonb;
  rid uuid;
  has_fn boolean := to_regprocedure('public.save_recipe(uuid,jsonb)') is not null;
  n int;
  ok boolean;
  results text[] := '{}';
  fails int := 0;
begin
  select id into ing from ingredients order by name limit 1;

  -- 1. Signup creates exactly one owned household (trigger)
  insert into auth.users (id, email) values (a, 'verify-a-' || a || '@verify.test'), (b, 'verify-b-' || b || '@verify.test');
  select count(*) into n from household_members where user_id = a and role = 'owner';
  results := results || format('%s 1 signup creates a household', case when n = 1 then 'PASS' else 'FAIL' end);

  -- Without the trigger (baseline), create the households so later checks still run.
  if n = 0 then
    insert into households (name) values ('verify a') returning id into ha;
    insert into household_members (household_id, user_id, role) values (ha, a, 'owner');
    insert into households (name) values ('verify b') returning id into hb;
    insert into household_members (household_id, user_id, role) values (hb, b, 'owner');
  end if;
  select household_id into ha from household_members where user_id = a limit 1;
  select household_id into hb from household_members where user_id = b limit 1;

  rec := jsonb_build_object(
    'name', 'verify recipe', 'servings_base', 2, 'prep_time_min', 10, 'source_url', null,
    'visibility', 'household', 'diet_tags', '[]'::jsonb, 'allergens', '["gluten"]'::jsonb,
    'author_id', b,  -- must be ignored
    'ingredients', jsonb_build_array(
      jsonb_build_object('ingredient_id', ing, 'amount', 100, 'unit', 'g', 'raw_text', 'x', 'position', 0),
      jsonb_build_object('ingredient_id', ing, 'amount', null, 'unit', null, 'raw_text', 'y', 'position', 1)),
    'steps', jsonb_build_array(jsonb_build_object('position', 0, 'text', 'step')));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- 2. save_recipe saves recipe + 2 ingredients + 1 step, author = caller
  begin
    execute 'select to_jsonb(save_recipe($1, $2))' into saved using ha, rec;
    select count(*) into n from recipe_ingredients where recipe_id = (saved ->> 'id')::uuid;
    ok := n = 2;
    select count(*) into n from recipe_steps where recipe_id = (saved ->> 'id')::uuid;
    ok := ok and n = 1 and (saved ->> 'author_id')::uuid = a and saved -> 'allergens' = '["gluten"]'::jsonb;
  exception when others then ok := false;
  end;
  results := results || format('%s 2 save_recipe saves everything, author is caller', case when has_fn and ok then 'PASS' else 'FAIL' end);

  -- 3. A bad ingredient rolls back the whole recipe (atomicity)
  begin
    execute 'select to_jsonb(save_recipe($1, $2))' into saved using ha,
      jsonb_set(jsonb_set(rec, '{name}', '"verify atomic"'), '{ingredients,1,ingredient_id}', to_jsonb(gen_random_uuid()));
    ok := false;
  exception when others then
    select count(*) into n from recipes where name = 'verify atomic';
    ok := n = 0;
  end;
  results := results || format('%s 3 failed save leaves no orphan recipe', case when has_fn and ok then 'PASS' else 'FAIL' end);

  -- 4. Can't save into a foreign household (RLS still applies)
  begin
    execute 'select to_jsonb(save_recipe($1, $2))' into saved using hb, rec;
    raise exception using errcode = 'VRFY1';
  exception
    when sqlstate 'VRFY1' then ok := false;
    when others then ok := true;
  end;
  results := results || format('%s 4 save into foreign household blocked', case when has_fn and ok then 'PASS' else 'FAIL' end);

  -- 5. Recipe without steps is rejected
  begin
    execute 'select to_jsonb(save_recipe($1, $2))' into saved using ha, jsonb_set(rec, '{steps}', '[]');
    raise exception using errcode = 'VRFY1';
  exception
    when sqlstate 'VRFY1' then ok := false;
    when others then ok := true;
  end;
  results := results || format('%s 5 recipe without steps rejected', case when has_fn and ok then 'PASS' else 'FAIL' end);

  -- 6. Old signup RPC returns the existing household instead of a second one
  begin
    execute 'select create_household_with_owner($1)' into rid using 'verify dup';
    select count(*) into n from household_members where user_id = a and role = 'owner';
    ok := n = 1 and rid = ha;
  exception when others then ok := false;
  end;
  results := results || format('%s 6 signup RPC is idempotent', case when ok then 'PASS' else 'FAIL' end);

  -- 7. anon can't call save_recipe
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    execute 'select save_recipe($1, $2)' using ha, rec;
    ok := false;
  exception when insufficient_privilege then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 7 anon cannot execute save_recipe', case when has_fn and ok then 'PASS' else 'FAIL' end);

  perform set_config('role', 'postgres', true);
  select count(*) into fails from unnest(results) t where t like 'FAIL%';
  raise exception 'VERIFY 0006: % (% checks)%',
    case when fails = 0 then 'ALL PASS' else 'FAIL ' || fails end,
    array_length(results, 1),
    E'\n' || array_to_string(results, E'\n');
end
$verify$;
