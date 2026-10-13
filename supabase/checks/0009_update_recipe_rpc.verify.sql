-- Verifies migrations/0009_update_recipe_rpc.sql against a real database.
-- Run as postgres (SQL editor). Creates throwaway rows, plays each check as
-- authenticated, then ALWAYS aborts with an exception: nothing persists.
-- Read the result in the error message:
--   "VERIFY 0009: ALL PASS (n checks)"  or  "VERIFY 0009: FAIL ..." with the list.
-- Before 0009 is applied every check is expected to FAIL (the function doesn't exist).
-- Needs migration 0008 and at least one row in ingredients (the seed provides 40).

do $verify$
declare
  a uuid := gen_random_uuid();  -- author, member of household ha
  b uuid := gen_random_uuid();  -- stranger, member of hb only
  m uuid := gen_random_uuid();  -- second member of ha (not the author)
  ha uuid;
  hb uuid;
  ing uuid;
  rec jsonb;
  edited jsonb;
  saved jsonb;
  rid uuid;
  n int;
  ok boolean;
  has_fn boolean := to_regprocedure('public.update_recipe(uuid,jsonb)') is not null;
  results text[] := '{}';
  fails int := 0;
begin
  select id into ing from ingredients order by name limit 1;

  insert into auth.users (id, email) values
    (a, 'verify-a-' || a || '@verify.test'),
    (b, 'verify-b-' || b || '@verify.test'),
    (m, 'verify-m-' || m || '@verify.test');
  select household_id into ha from household_members where user_id = a limit 1;
  select household_id into hb from household_members where user_id = b limit 1;
  if ha is null then
    insert into households (name) values ('verify a') returning id into ha;
    insert into household_members (household_id, user_id, role) values (ha, a, 'owner');
  end if;
  if hb is null then
    insert into households (name) values ('verify b') returning id into hb;
    insert into household_members (household_id, user_id, role) values (hb, b, 'owner');
  end if;
  -- m also joins ha as a plain member (the signup trigger already gave m a household of its own).
  insert into household_members (household_id, user_id, role) values (ha, m, 'member');

  rec := jsonb_build_object(
    'name', 'verify original', 'servings_base', 2, 'prep_time_min', 10, 'source_url', null,
    'source_author', 'Ania', 'visibility', 'household',
    'diet_tags', '[]'::jsonb, 'allergens', '["gluten"]'::jsonb,
    'ingredients', jsonb_build_array(
      jsonb_build_object('ingredient_id', ing, 'amount', 100, 'unit', 'g', 'raw_text', 'one', 'position', 0),
      jsonb_build_object('ingredient_id', ing, 'amount', 5, 'unit', 'g', 'raw_text', 'two', 'position', 1)),
    'steps', jsonb_build_array(
      jsonb_build_object('position', 0, 'text', 'first', 'title', 'A'),
      jsonb_build_object('position', 1, 'text', 'second'),
      jsonb_build_object('position', 2, 'text', 'third')));
  edited := jsonb_build_object(
    'name', 'verify edited', 'servings_base', 4, 'prep_time_min', null, 'source_url', null,
    'source_author', null, 'visibility', 'household',
    'diet_tags', '["wegetarianska"]'::jsonb, 'allergens', '[]'::jsonb,
    'author_id', b,  -- must be ignored
    'ingredients', jsonb_build_array(
      jsonb_build_object('ingredient_id', ing, 'amount', 7, 'unit', 'ml', 'raw_text', 'only', 'position', 0, 'optional', true)),
    'steps', jsonb_build_array(
      jsonb_build_object('position', 0, 'text', 'new first', 'title', 'Nowy'),
      jsonb_build_object('position', 1, 'text', 'new second')));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- Setup: the author saves the recipe (save_recipe, migrations 0006/0008).
  execute 'select to_jsonb(save_recipe($1, $2))' into saved using ha, rec;
  rid := (saved ->> 'id')::uuid;

  -- 1. The function exists
  results := results || format('%s 1 update_recipe exists', case when has_fn then 'PASS' else 'FAIL' end);

  -- 2. Author edit replaces fields, ingredients and steps; author_id and household stay
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using rid, edited;
    ok := saved ->> 'name' = 'verify edited' and (saved ->> 'servings_base')::int = 4
      and saved ->> 'source_author' is null and saved -> 'diet_tags' = '["wegetarianska"]'::jsonb
      and (saved ->> 'author_id')::uuid = a and (saved ->> 'household_id')::uuid = ha;
    select count(*) into n from recipe_ingredients where recipe_id = rid and raw_text = 'only' and optional and amount = 7;
    ok := ok and n = 1;
    select count(*) into n from recipe_ingredients where recipe_id = rid;
    ok := ok and n = 1;
    select count(*) into n from recipe_steps where recipe_id = rid;
    ok := ok and n = 2;
    select count(*) into n from recipe_steps where recipe_id = rid and position = 0 and title = 'Nowy' and text = 'new first';
    ok := ok and n = 1;
  exception when others then ok := false;
  end;
  results := results || format('%s 2 author edit replaces fields, ingredients and steps', case when has_fn and ok then 'PASS' else 'FAIL' end);

  -- 3. A household member who is not the author may edit (rec_update allows it)
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using rid, jsonb_set(edited, '{name}', '"verify by member"');
    ok := saved ->> 'name' = 'verify by member' and (saved ->> 'author_id')::uuid = a;
  exception when others then ok := false;
  end;
  results := results || format('%s 3 household member can edit', case when has_fn and ok then 'PASS' else 'FAIL' end);

  -- 4. A stranger gets an error (42501), not a silent no-op, and the recipe is unchanged
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using rid, jsonb_set(edited, '{name}', '"verify hijack"');
    ok := false;
  exception
    when insufficient_privilege then ok := true;
    when others then ok := false;
  end;
  perform set_config('role', 'postgres', true);
  select count(*) into n from recipes where id = rid and name = 'verify by member';
  ok := ok and n = 1;
  select count(*) into n from recipe_ingredients where recipe_id = rid;
  ok := ok and n = 1;
  perform set_config('role', 'authenticated', true);
  results := results || format('%s 4 stranger gets an error and changes nothing', case when has_fn and ok then 'PASS' else 'FAIL' end);

  -- 5. An unknown recipe id raises too
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using gen_random_uuid(), edited;
    ok := false;
  exception
    when insufficient_privilege then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 5 unknown recipe id raises', case when has_fn and ok then 'PASS' else 'FAIL' end);

  -- 6. Empty steps rejected, and the recipe keeps its content
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using rid, jsonb_set(edited, '{steps}', '[]');
    ok := false;
  exception
    when others then ok := sqlstate = '22023';
  end;
  select count(*) into n from recipe_steps where recipe_id = rid;
  ok := ok and n = 2;
  results := results || format('%s 6 recipe without steps rejected, content kept', case when has_fn and ok then 'PASS' else 'FAIL' end);

  -- 7. A bad ingredient inside an edit rolls the whole edit back (atomicity)
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using rid,
      jsonb_set(jsonb_set(edited, '{name}', '"verify atomic"'), '{ingredients,0,ingredient_id}', to_jsonb(gen_random_uuid()));
    ok := false;
  exception when others then
    select count(*) into n from recipes where id = rid and name = 'verify by member';
    ok := n = 1;
    select count(*) into n from recipe_ingredients where recipe_id = rid;
    ok := ok and n = 1;
  end;
  results := results || format('%s 7 failed edit leaves the recipe intact', case when has_fn and ok then 'PASS' else 'FAIL' end);

  -- 9. An author who has left the household: USING (author_id) passes but WITH CHECK
  --    (is_member_of) fails, so the edit is refused with 42501 and nothing changes.
  perform set_config('role', 'postgres', true);
  delete from household_members where household_id = ha and user_id = a;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using rid, jsonb_set(edited, '{name}', '"verify left"');
    ok := false;
  exception
    when insufficient_privilege then ok := true;
    when others then ok := false;
  end;
  perform set_config('role', 'postgres', true);
  select count(*) into n from recipes where id = rid and name = 'verify by member';
  ok := ok and n = 1;
  select count(*) into n from recipe_ingredients where recipe_id = rid;
  ok := ok and n = 1;
  perform set_config('role', 'authenticated', true);
  results := results || format('%s 9 author who left the household is refused (42501), recipe unchanged', case when has_fn and ok then 'PASS' else 'FAIL' end);

  -- 10. Grants: authenticated only
  ok := has_fn
    and has_function_privilege('authenticated', 'public.update_recipe(uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.update_recipe(uuid, jsonb)', 'execute');
  results := results || format('%s 10 update_recipe grants (authenticated only)', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('role', 'postgres', true);
  select count(*) into fails from unnest(results) t where t like 'FAIL%';
  raise exception 'VERIFY 0009: % (% checks)%',
    case when fails = 0 then 'ALL PASS' else 'FAIL ' || fails end,
    array_length(results, 1),
    E'\n' || array_to_string(results, E'\n');
end
$verify$;
