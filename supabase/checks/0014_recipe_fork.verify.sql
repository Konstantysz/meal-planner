-- Verifies migrations/0014_recipe_fork.sql against a real database.
-- Run as postgres (SQL editor). Creates throwaway users, a household recipe and a plan slot, plays
-- each check as authenticated/anon, then ALWAYS aborts with an exception: nothing persists.
-- Read the result in the error message:
--   "VERIFY 0014: ALL PASS (n checks)"  or  "VERIFY 0014: FAIL ..." with the list.
-- Before 0014 is applied, expected baseline: FAIL 11 (16 checks). Checks 3 (rec_delete was already
-- author-only), 6, 10, 11 and 13 (legit paths) pass before; every other check fails.
-- Needs migration 0010 (app_admins, is_app_admin) and at least one row in ingredients (the seed
-- provides 40).
--
-- Each attack runs in its own subtransaction. If the attack succeeds, the block raises VRFY1 to
-- undo it, so a successful attack never leaks state into the next check. Legit deletes are undone
-- the same way with VRFY2 after their row count is recorded.

do $verify$
declare
  a uuid := gen_random_uuid();    -- author of the recipe, owner of household ha
  m uuid := gen_random_uuid();    -- another member of ha (not the author)
  adm uuid := gen_random_uuid();  -- app admin, also a member of ha (not the author)
  o uuid := gen_random_uuid();    -- outsider: not a member of ha
  ha uuid;
  ing uuid;
  rid uuid := gen_random_uuid();  -- the original recipe
  fid uuid;                       -- the member's fork
  pid uuid := gen_random_uuid();
  sid uuid := gen_random_uuid();
  orig jsonb;
  fork jsonb;
  edited jsonb;
  saved jsonb;
  n int;
  n2 int;
  ok boolean;
  has_fn boolean := to_regprocedure('public.fork_recipe(uuid)') is not null;
  results text[] := '{}';
  fails int := 0;
begin
  select id into ing from ingredients order by name limit 1;

  -- Fixtures (as postgres, RLS bypassed)
  insert into auth.users (id, email) values
    (a, 'verify-a-' || a || '@verify.test'),
    (m, 'verify-m-' || m || '@verify.test'),
    (adm, 'verify-adm-' || adm || '@verify.test'),
    (o, 'verify-o-' || o || '@verify.test');
  select household_id into ha from household_members where user_id = a limit 1;
  if ha is null then
    insert into households (name) values ('verify a') returning id into ha;
    insert into household_members (household_id, user_id, role) values (ha, a, 'owner');
  end if;
  -- The outsider keeps only the household the signup trigger gave them: never ha.
  insert into household_members (household_id, user_id, role) values
    (ha, m, 'member'),
    (ha, adm, 'member');
  insert into app_admins (user_id) values (adm);

  insert into recipes (id, household_id, author_id, name, servings_base, prep_time_min, source_url,
                       visibility, diet_tags, allergens, source_author)
  values (rid, ha, a, 'verify original', 2, 25, 'https://verify.test/r', 'household',
          '{wegetarianska}', '{gluten}', 'Ania');
  insert into recipe_ingredients (recipe_id, ingredient_id, amount, unit, raw_text, position, optional) values
    (rid, ing, 100, 'g', 'one', 0, false),
    (rid, ing, null, null, 'two', 1, true);
  insert into recipe_steps (recipe_id, position, text, title) values
    (rid, 0, 'first', 'Przygotuj'),
    (rid, 1, 'second', null);
  insert into plans (id, household_id, week_start_date) values (pid, ha, date '2026-10-12');
  insert into plan_slots (id, plan_id, date, position, recipe_id, servings)
  values (sid, pid, date '2026-10-12', 0, rid, 2);

  orig := to_jsonb((select r from recipes r where r.id = rid))
    - 'id' - 'household_id' - 'author_id' - 'created_at' - 'forked_from_id';
  edited := jsonb_build_object(
    'name', 'verify hijack', 'servings_base', 9, 'prep_time_min', null, 'source_url', null,
    'source_author', null, 'visibility', 'household', 'diet_tags', '[]'::jsonb, 'allergens', '[]'::jsonb,
    'ingredients', jsonb_build_array(
      jsonb_build_object('ingredient_id', ing, 'amount', 1, 'unit', 'g', 'raw_text', 'only', 'position', 0)),
    'steps', jsonb_build_array(jsonb_build_object('position', 0, 'text', 'only step')));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);

  -- 1. A member who is not the author updates the recipe directly
  begin
    update recipes set name = 'verify hijack' where id = rid;
    get diagnostics n = row_count;
    if n > 0 then
      raise exception using errcode = 'VRFY1';
    end if;
    ok := true;
  exception
    when sqlstate 'VRFY1' then ok := false;
    when others then ok := true;
  end;
  results := results || format('%s 1 non-author member cannot update the recipe', case when ok then 'PASS' else 'FAIL' end);

  -- 2. update_recipe by that member raises 42501 instead of saving
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using rid, edited;
    raise exception using errcode = 'VRFY1';
  exception
    when sqlstate 'VRFY1' then ok := false;
    when insufficient_privilege then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 2 non-author update_recipe raises 42501', case when ok then 'PASS' else 'FAIL' end);

  -- 3. Delete by that member removes nothing
  begin
    delete from recipes where id = rid;
    get diagnostics n = row_count;
    if n > 0 then
      raise exception using errcode = 'VRFY1';
    end if;
    ok := true;
  exception
    when sqlstate 'VRFY1' then ok := false;
    when others then ok := true;
  end;
  results := results || format('%s 3 non-author member cannot delete the recipe', case when ok then 'PASS' else 'FAIL' end);

  -- 4. That member adds an ingredient to the recipe, or changes or removes one
  begin
    insert into recipe_ingredients (recipe_id, ingredient_id, amount, unit, raw_text, position)
    values (rid, ing, 1, 'g', 'injected', 9);
    raise exception using errcode = 'VRFY1';
  exception
    when sqlstate 'VRFY1' then ok := false;
    when others then ok := true;
  end;
  if ok then
    begin
      update recipe_ingredients set raw_text = 'changed' where recipe_id = rid;
      get diagnostics n = row_count;
      delete from recipe_ingredients where recipe_id = rid;
      get diagnostics n2 = row_count;
      if n + n2 > 0 then
        raise exception using errcode = 'VRFY1';
      end if;
    exception
      when sqlstate 'VRFY1' then ok := false;
      when others then null;
    end;
  end if;
  results := results || format('%s 4 non-author member cannot write the recipe''s ingredients', case when ok then 'PASS' else 'FAIL' end);

  -- 5. That member adds, changes or removes a step of the recipe
  begin
    insert into recipe_steps (recipe_id, position, text) values (rid, 9, 'injected');
    raise exception using errcode = 'VRFY1';
  exception
    when sqlstate 'VRFY1' then ok := false;
    when others then ok := true;
  end;
  if ok then
    begin
      update recipe_steps set text = 'changed' where recipe_id = rid;
      get diagnostics n = row_count;
      delete from recipe_steps where recipe_id = rid;
      get diagnostics n2 = row_count;
      if n + n2 > 0 then
        raise exception using errcode = 'VRFY1';
      end if;
    exception
      when sqlstate 'VRFY1' then ok := false;
      when others then null;
    end;
  end if;
  results := results || format('%s 5 non-author member cannot write the recipe''s steps', case when ok then 'PASS' else 'FAIL' end);

  -- 6. That member still reads the recipe, its ingredients and its steps (legit)
  begin
    select count(*) into n from recipes where id = rid;
    ok := n = 1;
    select count(*) into n from recipe_ingredients where recipe_id = rid;
    ok := ok and n = 2;
    select count(*) into n from recipe_steps where recipe_id = rid;
    ok := ok and n = 2;
  exception when others then ok := false;
  end;
  results := results || format('%s 6 non-author member still reads recipe, ingredients and steps', case when ok then 'PASS' else 'FAIL' end);

  -- 7. That member forks the recipe: an own copy in ha with every column, ingredient and step
  begin
    execute 'select fork_recipe($1)' into fid using rid;
    perform set_config('role', 'postgres', true);
    fork := to_jsonb((select r from recipes r where r.id = fid));
    ok := (fork - 'id' - 'household_id' - 'author_id' - 'created_at' - 'forked_from_id') = orig
      and (fork ->> 'author_id')::uuid = m
      and (fork ->> 'household_id')::uuid = ha
      and (fork ->> 'forked_from_id')::uuid = rid;
    select count(*) into n from (
      (select ingredient_id, amount, unit, raw_text, position, optional from recipe_ingredients where recipe_id = rid
       except select ingredient_id, amount, unit, raw_text, position, optional from recipe_ingredients where recipe_id = fid)
      union all
      (select ingredient_id, amount, unit, raw_text, position, optional from recipe_ingredients where recipe_id = fid
       except select ingredient_id, amount, unit, raw_text, position, optional from recipe_ingredients where recipe_id = rid)
    ) d;
    select count(*) into n2 from recipe_ingredients where recipe_id = fid;
    ok := ok and n = 0 and n2 = 2;
    select count(*) into n from (
      (select position, text, title from recipe_steps where recipe_id = rid
       except select position, text, title from recipe_steps where recipe_id = fid)
      union all
      (select position, text, title from recipe_steps where recipe_id = fid
       except select position, text, title from recipe_steps where recipe_id = rid)
    ) d;
    select count(*) into n2 from recipe_steps where recipe_id = fid;
    ok := ok and n = 0 and n2 = 2;
  exception when others then ok := false;
  end;
  perform set_config('role', 'authenticated', true);
  results := results || format('%s 7 member fork copies recipe, ingredients and steps', case when has_fn and coalesce(ok, false) then 'PASS' else 'FAIL' end);

  -- 8. The member edits their fork; the original, its children and its plan slot are unchanged
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using fid, jsonb_set(edited, '{name}', '"verify fork edit"');
    ok := saved ->> 'name' = 'verify fork edit';
    perform set_config('role', 'postgres', true);
    ok := ok and (to_jsonb((select r from recipes r where r.id = rid))
      - 'id' - 'household_id' - 'author_id' - 'created_at' - 'forked_from_id') = orig;
    select count(*) into n from recipe_ingredients where recipe_id = rid;
    ok := ok and n = 2;
    select count(*) into n from recipe_steps where recipe_id = rid and title = 'Przygotuj';
    ok := ok and n = 1;
    select count(*) into n from plan_slots where id = sid and recipe_id = rid;
    ok := ok and n = 1;
  exception when others then ok := false;
  end;
  perform set_config('role', 'authenticated', true);
  results := results || format('%s 8 editing the fork leaves the original and its plan slot unchanged', case when has_fn and coalesce(ok, false) then 'PASS' else 'FAIL' end);

  -- 9. The author cannot hand the recipe to another member (rec_update with check)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    update recipes set author_id = m where id = rid;
    get diagnostics n = row_count;
    if n > 0 then
      raise exception using errcode = 'VRFY1';
    end if;
    ok := true;
  exception
    when sqlstate 'VRFY1' then ok := false;
    when others then ok := true;
  end;
  results := results || format('%s 9 author cannot reassign the recipe to another member', case when ok then 'PASS' else 'FAIL' end);

  -- 10. The author updates their recipe with update_recipe (legit)
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using rid, jsonb_set(edited, '{name}', '"verify by author"');
    ok := saved ->> 'name' = 'verify by author';
    select count(*) into n from recipe_ingredients where recipe_id = rid;
    ok := ok and n = 1;
  exception when others then ok := false;
  end;
  results := results || format('%s 10 author can update the recipe', case when ok then 'PASS' else 'FAIL' end);

  -- 11. An app admin who is not the author updates the recipe (legit)
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  begin
    execute 'select to_jsonb(update_recipe($1, $2))' into saved using rid, jsonb_set(edited, '{name}', '"verify by admin"');
    ok := saved ->> 'name' = 'verify by admin' and (saved ->> 'author_id')::uuid = a;
  exception when others then ok := false;
  end;
  results := results || format('%s 11 app admin can update another member''s recipe', case when ok then 'PASS' else 'FAIL' end);

  -- 12. An app admin who is not the author deletes the recipe (legit; undone)
  begin
    delete from recipes where id = rid;
    get diagnostics n = row_count;
    ok := n = 1;
    raise exception using errcode = 'VRFY2';
  exception
    when sqlstate 'VRFY2' then null;
    when others then ok := false;
  end;
  results := results || format('%s 12 app admin can delete another member''s recipe', case when ok then 'PASS' else 'FAIL' end);

  -- 13. The author deletes their recipe (legit; undone)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    delete from recipes where id = rid;
    get diagnostics n = row_count;
    ok := n = 1;
    raise exception using errcode = 'VRFY2';
  exception
    when sqlstate 'VRFY2' then null;
    when others then ok := false;
  end;
  results := results || format('%s 13 author can delete the recipe', case when ok then 'PASS' else 'FAIL' end);

  -- 14. An outsider cannot fork a recipe they cannot read
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  if has_fn then
    begin
      execute 'select fork_recipe($1)' into fid using rid;
      raise exception using errcode = 'VRFY1';
    exception
      when sqlstate 'VRFY1' then ok := false;
      when others then ok := sqlstate = 'P0002';
    end;
  else
    ok := false;
  end if;
  results := results || format('%s 14 outsider cannot fork an unreadable recipe (P0002)', case when ok then 'PASS' else 'FAIL' end);

  -- 15. Grants: authenticated may execute fork_recipe, anon may not
  ok := has_fn
    and has_function_privilege('authenticated', 'public.fork_recipe(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.fork_recipe(uuid)', 'execute');
  results := results || format('%s 15 fork_recipe grants (authenticated only)', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('role', 'postgres', true);

  -- 16. Deleting the original keeps the fork; its forked_from_id becomes null
  begin
    delete from recipes where id = rid;
    fork := to_jsonb((select r from recipes r where r.id = fid));
    ok := fork is not null and fork ? 'forked_from_id' and fork -> 'forked_from_id' = 'null'::jsonb;
    select count(*) into n from plan_slots where id = sid and recipe_id is null;
    ok := ok and n = 1;
  exception when others then ok := false;
  end;
  results := results || format('%s 16 deleting the original keeps the fork, link set null', case when has_fn and coalesce(ok, false) then 'PASS' else 'FAIL' end);

  select count(*) into fails from unnest(results) t where t like 'FAIL%';
  raise exception 'VERIFY 0014: % (% checks)%',
    case when fails = 0 then 'ALL PASS' else 'FAIL ' || fails end,
    array_length(results, 1),
    E'\n' || array_to_string(results, E'\n');
end
$verify$;
