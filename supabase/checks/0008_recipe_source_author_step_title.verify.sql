-- Verifies migrations/0008_recipe_source_author_step_title.sql against a real database.
-- Run as postgres (SQL editor). Creates throwaway rows, then ALWAYS aborts with an
-- exception: nothing persists. Read the result in the error message:
--   "VERIFY 0008: ALL PASS (n checks)"  or  "VERIFY 0008: FAIL ..."
-- Before 0008 is applied every check is expected to FAIL.
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
  has_author boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recipes' and column_name = 'source_author');
  has_title boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recipe_steps' and column_name = 'title');
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

  results := results || format('%s 1 recipes.source_author exists', case when has_author then 'PASS' else 'FAIL' end);
  results := results || format('%s 2 recipe_steps.title exists', case when has_title then 'PASS' else 'FAIL' end);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- 3. save_recipe stores source_author and per-step title; author_id stays the caller
  rec := jsonb_build_object(
    'name', 'verify new fields', 'servings_base', 2, 'prep_time_min', null, 'source_url', null,
    'source_author', 'Ania Gotuje', 'visibility', 'household',
    'diet_tags', '[]'::jsonb, 'allergens', '[]'::jsonb,
    'ingredients', jsonb_build_array(
      jsonb_build_object('ingredient_id', ing, 'amount', 100, 'unit', 'g', 'raw_text', 'x', 'position', 0)),
    'steps', jsonb_build_array(
      jsonb_build_object('position', 0, 'text', 'details', 'title', 'Przygotuj'),
      jsonb_build_object('position', 1, 'text', 'no title')));
  begin
    execute 'select to_jsonb(save_recipe($1, $2))' into saved using ha, rec;
    ok := saved ->> 'source_author' = 'Ania Gotuje' and (saved ->> 'author_id')::uuid = a;
    execute 'select count(*) from recipe_steps where recipe_id = $1 and position = 0 and title = $2'
      into n using (saved ->> 'id')::uuid, 'Przygotuj';
    ok := ok and n = 1;
    execute 'select count(*) from recipe_steps where recipe_id = $1 and position = 1 and title is null'
      into n using (saved ->> 'id')::uuid;
    ok := ok and n = 1;
  exception when others then ok := false;
  end;
  results := results || format('%s 3 save_recipe stores source_author and step title',
    case when has_author and has_title and ok then 'PASS' else 'FAIL' end);

  -- 4. old payload shape (no source_author, no title) still works; both stay null
  rec := (rec - 'source_author') || jsonb_build_object('steps',
    jsonb_build_array(jsonb_build_object('position', 0, 'text', 'only text')));
  begin
    execute 'select to_jsonb(save_recipe($1, $2))' into saved using ha, rec;
    ok := saved ->> 'source_author' is null;
    execute 'select count(*) from recipe_steps where recipe_id = $1 and title is null'
      into n using (saved ->> 'id')::uuid;
    ok := ok and n = 1;
  exception when others then ok := false;
  end;
  results := results || format('%s 4 save_recipe without the new fields leaves them null',
    case when has_author and has_title and ok then 'PASS' else 'FAIL' end);

  -- 5. grants unchanged: authenticated may execute, anon may not
  ok := has_function_privilege('authenticated', 'public.save_recipe(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.save_recipe(uuid, jsonb)', 'execute');
  results := results || format('%s 5 save_recipe grants (authenticated only)', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('role', 'postgres', true);
  select count(*) into fails from unnest(results) t where t like 'FAIL%';
  raise exception 'VERIFY 0008: % (% checks)%',
    case when fails = 0 then 'ALL PASS' else 'FAIL ' || fails end,
    array_length(results, 1),
    E'\n' || array_to_string(results, E'\n');
end
$verify$;
