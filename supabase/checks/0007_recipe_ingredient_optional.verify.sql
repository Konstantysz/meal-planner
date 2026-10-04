-- Verifies migrations/0007_recipe_ingredient_optional.sql against a real database.
-- Run as postgres (SQL editor). Creates throwaway rows, then ALWAYS aborts with an
-- exception: nothing persists. Read the result in the error message:
--   "VERIFY 0007: ALL PASS (n checks)"  or  "VERIFY 0007: FAIL ..."
-- Before 0007 is applied every check is expected to FAIL.
-- Needs at least one row in ingredients (the seed provides 40).

do $verify$
declare
  a uuid := gen_random_uuid();
  ha uuid;
  ing uuid;
  rec jsonb;
  saved jsonb;
  n int;
  ok boolean;
  has_col boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recipe_ingredients' and column_name = 'optional');
  results text[] := '{}';
  fails int := 0;
begin
  select id into ing from ingredients order by name limit 1;

  insert into auth.users (id, email) values (a, 'verify-a-' || a || '@verify.test');
  select household_id into ha from household_members where user_id = a limit 1;
  if ha is null then
    insert into households (name) values ('verify a') returning id into ha;
    insert into household_members (household_id, user_id, role) values (ha, a, 'owner');
  end if;

  results := results || format('%s 1 optional column exists', case when has_col then 'PASS' else 'FAIL' end);

  rec := jsonb_build_object(
    'name', 'verify optional', 'servings_base', 2, 'prep_time_min', null, 'source_url', null,
    'visibility', 'household', 'diet_tags', '[]'::jsonb, 'allergens', '[]'::jsonb,
    'ingredients', jsonb_build_array(
      jsonb_build_object('ingredient_id', ing, 'amount', 100, 'unit', 'g', 'raw_text', 'x', 'position', 0, 'optional', true),
      jsonb_build_object('ingredient_id', ing, 'amount', 1, 'unit', 'g', 'raw_text', 'y', 'position', 1)),
    'steps', jsonb_build_array(jsonb_build_object('position', 0, 'text', 'step')));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- 2. save_recipe stores the flag; a missing flag defaults to false
  begin
    execute 'select to_jsonb(save_recipe($1, $2))' into saved using ha, rec;
    execute 'select count(*) from recipe_ingredients where recipe_id = $1 and optional and position = 0'
      into n using (saved ->> 'id')::uuid;
    ok := n = 1;
    execute 'select count(*) from recipe_ingredients where recipe_id = $1 and not optional and position = 1'
      into n using (saved ->> 'id')::uuid;
    ok := ok and n = 1;
  exception when others then ok := false;
  end;
  results := results || format('%s 2 save_recipe stores optional, default false', case when has_col and ok then 'PASS' else 'FAIL' end);

  perform set_config('role', 'postgres', true);
  select count(*) into fails from unnest(results) t where t like 'FAIL%';
  raise exception 'VERIFY 0007: % (% checks)%',
    case when fails = 0 then 'ALL PASS' else 'FAIL ' || fails end,
    array_length(results, 1),
    E'\n' || array_to_string(results, E'\n');
end
$verify$;
