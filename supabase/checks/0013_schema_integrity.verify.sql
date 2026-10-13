-- Verifies migrations/0013_schema_integrity.sql against a real database.
-- Run as postgres (SQL editor). Creates throwaway users, recipes, a plan, slots and a share token,
-- plays each check as authenticated (a household member, so RLS lets every write through and only
-- the new rules can stop it), then ALWAYS aborts with an exception: nothing persists.
-- Read the result in the error message:
--   "VERIFY 0013: ALL PASS (n checks)"  or  "VERIFY 0013: FAIL ..." with the list.
-- Before 0013 is applied every check is expected to FAIL except 11, 14 and 15 (legit paths):
-- baseline "FAIL 14 (17 checks)".
-- Needs migrations 0008 and 0009 and at least one row in ingredients (the seed provides 40).
--
-- Each attack runs in its own subtransaction. If the attack succeeds, the block raises VRFY1 to undo
-- it, so a successful attack never leaks state into the next check. A rejection only counts when it
-- has the expected error code (23505 unique, 23514 check), not any error.

do $verify$
declare
  a uuid := gen_random_uuid();  -- member of ha, plays every check
  d uuid := gen_random_uuid();  -- second member of ha, deleted in check 16
  ha uuid;
  ing uuid;
  r1 uuid := gen_random_uuid();  -- target of the row-rule attacks
  r2 uuid := gen_random_uuid();  -- backdated, edited with update_recipe (check 12)
  r3 uuid := gen_random_uuid();  -- backdated, edited directly (check 13)
  rd uuid := gen_random_uuid();  -- saved by d
  p uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid();
  wk date := date '2030-01-07';  -- a Monday
  tok text := 'verify-' || replace(gen_random_uuid()::text, '-', '');
  rec jsonb;
  saved jsonb;
  rid uuid;
  ts timestamptz;
  hid uuid;
  author uuid;
  n int;
  ok boolean;
  results text[] := '{}';
  fails int := 0;
begin
  select id into ing from ingredients order by name limit 1;

  -- Fixtures (as postgres, RLS bypassed)
  insert into auth.users (id, email) values
    (a, 'verify-a-' || a || '@verify.test'),
    (d, 'verify-d-' || d || '@verify.test');
  select household_id into ha from household_members where user_id = a limit 1;
  if ha is null then
    insert into households (name) values ('verify a') returning id into ha;
    insert into household_members (household_id, user_id, role) values (ha, a, 'owner');
  end if;
  insert into household_members (household_id, user_id, role) values (ha, d, 'member');

  insert into recipes (id, household_id, author_id, name, servings_base) values
    (r1, ha, a, 'verify r1', 2),
    (rd, ha, d, 'verify saved by d', 2);
  -- r2 and r3 start with an old updated_at, so a later now() is a visible move.
  begin
    execute 'insert into recipes (id, household_id, author_id, name, servings_base, updated_at)
             values ($1, $3, $4, ''verify r2'', 2, timestamptz ''2000-01-01''),
                    ($2, $3, $4, ''verify r3'', 2, timestamptz ''2000-01-01'')'
      using r2, r3, ha, a;
  exception when undefined_column then
    insert into recipes (id, household_id, author_id, name, servings_base) values
      (r2, ha, a, 'verify r2', 2),
      (r3, ha, a, 'verify r3', 2);
  end;
  insert into recipe_ingredients (recipe_id, ingredient_id, amount, unit, raw_text, position)
    values (r1, ing, 100, 'g', 'one', 0);
  insert into recipe_steps (recipe_id, position, text) values (r1, 0, 'first');

  insert into plans (id, household_id, week_start_date) values (p, ha, wk);
  insert into plan_slots (id, plan_id, date, position, recipe_id) values (s1, p, wk + 2, 0, rd);
  insert into share_tokens (token, plan_id, created_by) values (tok, p, d);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- 1. Duplicate ingredient position
  begin
    insert into recipe_ingredients (recipe_id, ingredient_id, amount, unit, raw_text, position)
      values (r1, ing, 5, 'g', 'dup', 0);
    raise exception using errcode = 'VRFY1';
  exception
    when unique_violation then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 1 duplicate ingredient position rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 2. Duplicate step position
  begin
    insert into recipe_steps (recipe_id, position, text) values (r1, 0, 'dup');
    raise exception using errcode = 'VRFY1';
  exception
    when unique_violation then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 2 duplicate step position rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 3. Negative ingredient position
  begin
    insert into recipe_ingredients (recipe_id, ingredient_id, amount, unit, raw_text, position)
      values (r1, ing, 5, 'g', 'neg', -1);
    raise exception using errcode = 'VRFY1';
  exception
    when check_violation then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 3 negative ingredient position rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 4. Negative step position
  begin
    insert into recipe_steps (recipe_id, position, text) values (r1, -1, 'neg');
    raise exception using errcode = 'VRFY1';
  exception
    when check_violation then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 4 negative step position rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 5. Zero amount
  begin
    insert into recipe_ingredients (recipe_id, ingredient_id, amount, unit, raw_text, position)
      values (r1, ing, 0, 'g', 'zero', 5);
    raise exception using errcode = 'VRFY1';
  exception
    when check_violation then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 5 zero amount rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 6. Negative amount (update of an existing row)
  begin
    update recipe_ingredients set amount = -5 where recipe_id = r1 and position = 0;
    get diagnostics n = row_count;
    if n > 0 then
      raise exception using errcode = 'VRFY1';
    end if;
    ok := false;  -- 0 rows: RLS hid the row, the rule was not tested
  exception
    when check_violation then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 6 negative amount rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 7. Blank (whitespace-only) step text
  begin
    insert into recipe_steps (recipe_id, position, text) values (r1, 6, E'  \t\n ');
    raise exception using errcode = 'VRFY1';
  exception
    when check_violation then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 7 blank step text rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 8. New slot dated the Monday after its plan week
  begin
    insert into plan_slots (plan_id, date, position) values (p, wk + 7, 0);
    raise exception using errcode = 'VRFY1';
  exception
    when check_violation then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 8 slot outside its week rejected on insert', case when ok then 'PASS' else 'FAIL' end);

  -- 9. Existing slot moved to the Sunday before its plan week
  begin
    update plan_slots set date = wk - 1 where id = s1;
    get diagnostics n = row_count;
    if n > 0 then
      raise exception using errcode = 'VRFY1';
    end if;
    ok := false;
  exception
    when check_violation then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 9 slot moved outside its week rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 10. Plan moved to the next week, leaving its slot behind
  begin
    update plans set week_start_date = wk + 7 where id = p;
    get diagnostics n = row_count;
    if n > 0 then
      raise exception using errcode = 'VRFY1';
    end if;
    ok := false;
  exception
    when check_violation then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 10 plan week change that strands slots rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 11. Legit: slot on the Sunday of the week, and a move to the Monday
  begin
    insert into plan_slots (plan_id, date, position) values (p, wk + 6, 1);
    update plan_slots set date = wk where id = s1;
    get diagnostics n = row_count;
    ok := n = 1;
  exception when others then ok := false;
  end;
  results := results || format('%s 11 slots inside the week are accepted', case when ok then 'PASS' else 'FAIL' end);

  rec := jsonb_build_object(
    'name', 'verify saved', 'servings_base', 2, 'prep_time_min', null, 'source_url', null,
    'source_author', null, 'visibility', 'household',
    'diet_tags', '[]'::jsonb, 'allergens', '[]'::jsonb,
    'ingredients', jsonb_build_array(
      jsonb_build_object('ingredient_id', ing, 'amount', 100, 'unit', 'g', 'raw_text', 'one', 'position', 0),
      jsonb_build_object('ingredient_id', ing, 'amount', null, 'unit', null, 'raw_text', 'sól do smaku', 'position', 1)),
    'steps', jsonb_build_array(
      jsonb_build_object('position', 0, 'text', 'first'),
      jsonb_build_object('position', 1, 'text', 'second')));

  -- 12. update_recipe moves updated_at
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using r2, rec;
    ts := (saved ->> 'updated_at')::timestamptz;
    ok := ts = now();
  exception when others then ok := false;
  end;
  results := results || format('%s 12 update_recipe moves updated_at', case when coalesce(ok, false) then 'PASS' else 'FAIL' end);

  -- 13. A client cannot set updated_at itself
  begin
    execute 'update recipes set name = ''verify r3 edited'', updated_at = timestamptz ''2001-01-01'' where id = $1'
      using r3;
    execute 'select updated_at from recipes where id = $1' into ts using r3;
    ok := ts = now();
  exception when others then ok := false;
  end;
  results := results || format('%s 13 direct update sets updated_at to now, not the sent value', case when coalesce(ok, false) then 'PASS' else 'FAIL' end);

  -- 14. Legit: save_recipe with valid input (one amount null)
  begin
    execute 'select to_jsonb(save_recipe($1, $2))' into saved using ha, rec;
    rid := (saved ->> 'id')::uuid;
    ok := rid is not null;
  exception when others then ok := false;
  end;
  results := results || format('%s 14 save_recipe succeeds with valid input', case when coalesce(ok, false) then 'PASS' else 'FAIL' end);

  -- 15. Legit: update_recipe with ingredients and steps reordered (positions swapped)
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using rid, jsonb_set(jsonb_set(rec,
      '{ingredients}', jsonb_build_array(
        jsonb_build_object('ingredient_id', ing, 'amount', null, 'unit', null, 'raw_text', 'sól do smaku', 'position', 0),
        jsonb_build_object('ingredient_id', ing, 'amount', 100, 'unit', 'g', 'raw_text', 'one', 'position', 1))),
      '{steps}', jsonb_build_array(
        jsonb_build_object('position', 1, 'text', 'first'),
        jsonb_build_object('position', 0, 'text', 'second')));
    select count(*) into n from recipe_steps
      where recipe_id = rid and ((position = 0 and text = 'second') or (position = 1 and text = 'first'));
    ok := n = 2;
    select count(*) into n from recipe_ingredients
      where recipe_id = rid and ((position = 0 and raw_text = 'sól do smaku') or (position = 1 and raw_text = 'one'));
    ok := ok and n = 2;
  exception when others then ok := false;
  end;
  results := results || format('%s 15 update_recipe succeeds with reordered rows', case when coalesce(ok, false) then 'PASS' else 'FAIL' end);

  -- 16. Deleting d (a recipe and a share token) succeeds; the recipe stays in ha, visible to a
  perform set_config('role', 'postgres', true);
  begin
    delete from auth.users where id = d;
    select household_id, author_id into hid, author from recipes where id = rd;
    ok := found and hid = ha and author is null
      and not exists (select 1 from share_tokens where token = tok);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from recipes where id = rd;
    ok := ok and n = 1;
  exception when others then ok := false;
  end;
  perform set_config('role', 'postgres', true);
  results := results || format('%s 16 account delete keeps the recipe in the household and drops the token', case when coalesce(ok, false) then 'PASS' else 'FAIL' end);

  -- 17. create_household_with_owner is not executable by clients
  ok := not has_function_privilege('authenticated', 'public.create_household_with_owner(text)', 'execute')
    and not has_function_privilege('anon', 'public.create_household_with_owner(text)', 'execute');
  results := results || format('%s 17 create_household_with_owner not executable by anon or authenticated', case when ok then 'PASS' else 'FAIL' end);

  select count(*) into fails from unnest(results) t where t like 'FAIL%';
  raise exception 'VERIFY 0013: % (% checks)%',
    case when fails = 0 then 'ALL PASS' else 'FAIL ' || fails end,
    array_length(results, 1),
    E'\n' || array_to_string(results, E'\n');
end
$verify$;
