-- Verifies migrations/0011_recipe_image_url.sql against a real database.
-- Run as postgres (SQL editor). Creates throwaway rows, then ALWAYS aborts with an
-- exception: nothing persists. Read the result in the error message:
--   "VERIFY 0011: ALL PASS (n checks)"  or  "VERIFY 0011: FAIL ..."
-- Before 0011 is applied every check is expected to FAIL.
-- Needs migrations 0008 and 0009 and at least one row in ingredients (the seed provides 40).

do $verify$
declare
  a uuid := gen_random_uuid();
  ha uuid;
  ing uuid;
  rec jsonb;
  saved jsonb;
  rid uuid;
  n int;
  ok boolean;
  has_col boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recipes' and column_name = 'image_url');
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

  results := results || format('%s 1 recipes.image_url exists', case when has_col then 'PASS' else 'FAIL' end);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  rec := jsonb_build_object(
    'name', 'verify photo', 'servings_base', 2, 'prep_time_min', null, 'source_url', null,
    'image_url', 'https://cdn.aniagotuje.com/pictures/articles/2021/10/x.jpg', 'visibility', 'household',
    'diet_tags', '[]'::jsonb, 'allergens', '[]'::jsonb,
    'ingredients', jsonb_build_array(
      jsonb_build_object('ingredient_id', ing, 'amount', 100, 'unit', 'g', 'raw_text', 'x', 'position', 0)),
    'steps', jsonb_build_array(jsonb_build_object('position', 0, 'text', 'details')));

  -- 2. save_recipe stores image_url
  begin
    execute 'select to_jsonb(save_recipe($1, $2))' into saved using ha, rec;
    rid := (saved ->> 'id')::uuid;
    ok := saved ->> 'image_url' = 'https://cdn.aniagotuje.com/pictures/articles/2021/10/x.jpg';
  exception when others then ok := false;
  end;
  results := results || format('%s 2 save_recipe stores image_url', case when has_col and ok then 'PASS' else 'FAIL' end);

  -- 3. update_recipe replaces it; a blank value clears it
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using rid,
      jsonb_set(rec, '{image_url}', '"https://jadlonomia.com/wp-content/uploads/y.jpg"');
    ok := saved ->> 'image_url' = 'https://jadlonomia.com/wp-content/uploads/y.jpg';
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using rid, jsonb_set(rec, '{image_url}', '"  "');
    ok := ok and saved ->> 'image_url' is null;
  exception when others then ok := false;
  end;
  results := results || format('%s 3 update_recipe replaces and clears image_url', case when has_col and ok then 'PASS' else 'FAIL' end);

  -- 4. payload without image_url still saves, with null
  begin
    execute 'select to_jsonb(save_recipe($1, $2))' into saved using ha, rec - 'image_url';
    ok := saved ->> 'image_url' is null;
  exception when others then ok := false;
  end;
  results := results || format('%s 4 save_recipe without image_url leaves it null', case when has_col and ok then 'PASS' else 'FAIL' end);

  -- 5. non-http(s) values are rejected by the check constraint
  begin
    execute 'select to_jsonb(save_recipe($1, $2))' into saved using ha,
      jsonb_set(rec, '{image_url}', '"javascript:alert(1)"');
    ok := false;
  exception
    when check_violation then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 5 non-http image_url rejected (check_violation)', case when has_col and ok then 'PASS' else 'FAIL' end);

  -- 6. grants unchanged: authenticated may execute, anon may not
  ok := has_function_privilege('authenticated', 'public.save_recipe(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.save_recipe(uuid, jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.update_recipe(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.update_recipe(uuid, jsonb)', 'execute');
  results := results || format('%s 6 RPC grants (authenticated only)', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('role', 'postgres', true);
  select count(*) into fails from unnest(results) t where t like 'FAIL%';
  raise exception 'VERIFY 0011: % (% checks)%',
    case when fails = 0 then 'ALL PASS' else 'FAIL ' || fails end,
    array_length(results, 1),
    E'\n' || array_to_string(results, E'\n');
end
$verify$;
