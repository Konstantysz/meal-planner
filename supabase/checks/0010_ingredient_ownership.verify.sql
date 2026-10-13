-- Verifies migrations/0010_ingredient_ownership.sql against a real database.
-- Run as postgres (SQL editor). Creates throwaway users and ingredients, plays each attack
-- as authenticated/anon, then ALWAYS aborts with an exception: nothing persists.
-- Read the result in the error message:
--   "VERIFY 0010: ALL PASS (n checks)"  or  "VERIFY 0010: FAIL ..." with the list.
-- Before 0010 is applied, every check except 3 and 5 (legit paths) is expected to FAIL.
--
-- Each attack runs in its own subtransaction. If the attack succeeds, the block raises
-- VRFY1 to undo it, so a successful attack never leaks state into the next check.

do $verify$
declare
  a uuid := gen_random_uuid();    -- creator of ing_a
  b uuid := gen_random_uuid();    -- another signed-in user
  adm uuid := gen_random_uuid();  -- app admin
  ing_a uuid := gen_random_uuid();
  ing_seed uuid := gen_random_uuid();
  tag text := left(replace(gen_random_uuid()::text, '-', ''), 12);
  creator uuid;
  flag_b boolean;
  flag_adm boolean;
  n int;
  ok boolean;
  results text[] := '{}';
  fails int := 0;
begin
  -- Fixtures (as postgres, RLS bypassed)
  insert into auth.users (id, email) values
    (a, 'verify-a-' || a || '@verify.test'),
    (b, 'verify-b-' || b || '@verify.test'),
    (adm, 'verify-adm-' || adm || '@verify.test');
  insert into ingredients (id, name, category, kcal_per_100g, created_by) values
    (ing_a, 'verify own ' || tag, 'inne', 100, a),
    (ing_seed, 'verify seed ' || tag, 'inne', 100, null);
  begin
    execute 'insert into app_admins (user_id) values ($1)' using adm;
  exception when undefined_table then null;
  end;

  -- 1. No client privilege on app_admins
  begin
    ok := not has_table_privilege('authenticated', 'public.app_admins', 'select')
      and not has_table_privilege('authenticated', 'public.app_admins', 'insert')
      and not has_table_privilege('anon', 'public.app_admins', 'select')
      and not has_table_privilege('anon', 'public.app_admins', 'insert');
  exception when undefined_table then ok := false;
  end;
  results := results || format('%s 1 app_admins has no client privileges', case when ok then 'PASS' else 'FAIL' end);

  -- 2. Another user changes the creator's ingredient macros
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin
    update ingredients set kcal_per_100g = 999 where id = ing_a;
    get diagnostics n = row_count;
    if n > 0 then
      raise exception using errcode = 'VRFY1';
    end if;
    ok := true;
  exception
    when sqlstate 'VRFY1' then ok := false;
    when others then ok := true;
  end;
  results := results || format('%s 2 other user cannot update an owned ingredient', case when ok then 'PASS' else 'FAIL' end);

  -- 3. Creator updates own ingredient (legit)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    update ingredients set kcal_per_100g = 120 where id = ing_a;
    get diagnostics n = row_count;
    ok := n = 1;
  exception when others then ok := false;
  end;
  results := results || format('%s 3 creator can update own ingredient', case when ok then 'PASS' else 'FAIL' end);

  -- 4. Non-admin changes a creator-less (seed) ingredient
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin
    update ingredients set kcal_per_100g = 999 where id = ing_seed;
    get diagnostics n = row_count;
    if n > 0 then
      raise exception using errcode = 'VRFY1';
    end if;
    ok := true;
  exception
    when sqlstate 'VRFY1' then ok := false;
    when others then ok := true;
  end;
  results := results || format('%s 4 non-admin cannot update a seed ingredient', case when ok then 'PASS' else 'FAIL' end);

  -- 5. Admin updates a seed ingredient and another user's ingredient (legit)
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  begin
    update ingredients set kcal_per_100g = 110 where id in (ing_seed, ing_a);
    get diagnostics n = row_count;
    ok := n = 2;
  exception when others then ok := false;
  end;
  results := results || format('%s 5 admin can update any ingredient', case when ok then 'PASS' else 'FAIL' end);

  -- 6. Insert with a forged creator
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin
    insert into ingredients (name, category, created_by) values ('verify forged ' || tag, 'inne', a);
    raise exception using errcode = 'VRFY1';
  exception
    when sqlstate 'VRFY1' then ok := false;
    when others then ok := true;
  end;
  results := results || format('%s 6 insert with a forged creator blocked', case when ok then 'PASS' else 'FAIL' end);

  -- 7. Insert without created_by records the caller (picker / auto-match path)
  begin
    insert into ingredients (name, category) values ('verify default ' || tag, 'inne')
      returning created_by into creator;
    ok := creator = b;
  exception when others then ok := false;
  end;
  results := results || format('%s 7 insert records the caller as creator', case when coalesce(ok, false) then 'PASS' else 'FAIL' end);

  -- 8. Creator hands their ingredient to someone else
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    update ingredients set created_by = b where id = ing_a;
    get diagnostics n = row_count;
    if n > 0 then
      raise exception using errcode = 'VRFY1';
    end if;
    ok := true;
  exception
    when sqlstate 'VRFY1' then ok := false;
    when others then ok := true;
  end;
  results := results || format('%s 8 creator cannot reassign an ingredient', case when ok then 'PASS' else 'FAIL' end);

  -- 9. Signed-in user makes themselves admin
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin
    execute 'insert into app_admins (user_id) values ($1)' using b;
    raise exception using errcode = 'VRFY1';
  exception
    when sqlstate 'VRFY1' then ok := false;
    when undefined_table then ok := false;
    when others then ok := true;
  end;
  results := results || format('%s 9 user cannot make themselves admin', case when ok then 'PASS' else 'FAIL' end);

  -- 10. is_app_admin: false for a non-admin, true for the admin
  begin
    execute 'select is_app_admin()' into flag_b;
    perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
    execute 'select is_app_admin()' into flag_adm;
    ok := not flag_b and flag_adm;
  exception when others then ok := false;
  end;
  results := results || format('%s 10 is_app_admin false for user, true for admin', case when ok then 'PASS' else 'FAIL' end);

  -- 11. anon cannot execute is_app_admin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    execute 'select is_app_admin()';
    ok := false;
  exception
    when insufficient_privilege then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 11 anon cannot execute is_app_admin', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('role', 'postgres', true);

  -- 12. Deleting the creator keeps the ingredient, creator becomes null
  begin
    delete from auth.users where id = a;
    select created_by into creator from ingredients where id = ing_a;
    ok := found and creator is null;
  exception when others then ok := false;
  end;
  results := results || format('%s 12 deleting the creator keeps the ingredient', case when ok then 'PASS' else 'FAIL' end);

  select count(*) into fails from unnest(results) t where t like 'FAIL%';
  raise exception 'VERIFY 0010: % (% checks)%',
    case when fails = 0 then 'ALL PASS' else 'FAIL ' || fails end,
    array_length(results, 1),
    E'\n' || array_to_string(results, E'\n');
end
$verify$;
