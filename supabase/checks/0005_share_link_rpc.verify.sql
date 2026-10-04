-- Verifies migrations/0005_share_link_rpc.sql against a real database.
-- Run as postgres (SQL editor). Creates throwaway rows, plays each check as
-- anon/authenticated, then ALWAYS aborts with an exception: nothing persists.
-- Read the result in the error message:
--   "VERIFY 0005: ALL PASS (n checks)"  or  "VERIFY 0005: FAIL ..." with the list.
-- Before 0005 is applied, checks 1-5, 7 and 8 are expected to FAIL.
-- Attacks that succeed undo themselves (VRFY1) so they can't skew later checks.

do $verify$
declare
  a uuid := gen_random_uuid();  -- owner of h1, shares p1
  b uuid := gen_random_uuid();  -- unrelated signed-in user
  h1 uuid := gen_random_uuid();
  h2 uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid();  -- shared plan (Monday 2000-01-03)
  p2 uuid := gen_random_uuid();  -- unshared plan (Monday 2000-01-10)
  r1 uuid := gen_random_uuid();
  tok text := 'verify-' || replace(gen_random_uuid()::text, '-', '');
  j jsonb;
  n int;
  ok boolean;
  results text[] := '{}';
  fails int := 0;
begin
  -- Fixtures (as postgres, RLS bypassed)
  insert into auth.users (id, email) values (a, a || '@verify.test'), (b, b || '@verify.test');
  insert into households (id, name) values (h1, 'verify h1'), (h2, 'verify h2');
  insert into household_members (household_id, user_id, role) values (h1, a, 'owner'), (h2, b, 'owner');
  insert into plans (id, household_id, week_start_date) values
    (p1, h1, date '2000-01-03'), (p2, h1, date '2000-01-10');
  insert into recipes (id, household_id, author_id, name, servings_base)
    values (r1, h1, a, 'verify recipe', 2);
  insert into plan_slots (plan_id, date, position, recipe_id) values (p1, date '2000-01-03', 0, r1);
  insert into share_tokens (token, plan_id, created_by) values (tok, p1, a);

  -- anon
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

  -- 1. anon can't list share tokens
  select count(*) into n from share_tokens;
  results := results || format('%s 1 anon cannot list share tokens', case when n = 0 then 'PASS' else 'FAIL' end);

  -- 2. anon can't read a shared plan by table query
  select count(*) into n from plans where id = p1;
  results := results || format('%s 2 anon cannot read shared plan table', case when n = 0 then 'PASS' else 'FAIL' end);

  -- 3. anon can't read a shared plan's recipe by table query
  select count(*) into n from recipes where id = r1;
  results := results || format('%s 3 anon cannot read shared recipe table', case when n = 0 then 'PASS' else 'FAIL' end);

  -- 4. anon gets the plan through the RPC with the right token
  begin
    execute 'select get_shared_plan($1)' into j using tok;
    ok := j ->> 'week_start_date' = '2000-01-03'
      and jsonb_array_length(j -> 'slots') = 1
      and j -> 'slots' -> 0 -> 'recipe' ->> 'name' = 'verify recipe'
      and not (j ? 'household_id');
  exception when others then ok := false;
  end;
  results := results || format('%s 4 anon reads shared plan via RPC', case when ok then 'PASS' else 'FAIL' end);

  -- 5. RPC with a wrong token returns null
  begin
    execute 'select get_shared_plan($1)' into j using tok || 'x';
    ok := j is null;
  exception when others then ok := false;
  end;
  results := results || format('%s 5 wrong token returns null', case when ok then 'PASS' else 'FAIL' end);

  -- 6. anon still can't read an unshared plan
  select count(*) into n from plans where id = p2;
  results := results || format('%s 6 anon cannot read unshared plan', case when n = 0 then 'PASS' else 'FAIL' end);

  -- 7. Another signed-in user can't list someone else's tokens
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from share_tokens where token = tok;
  results := results || format('%s 7 other user cannot see foreign tokens', case when n = 0 then 'PASS' else 'FAIL' end);

  -- 8. A plan can't start on a non-Monday (settings bug guard), as the owner
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    insert into plans (household_id, week_start_date) values (h1, date '2000-01-09');
    raise exception using errcode = 'VRFY1';
  exception
    when sqlstate 'VRFY1' then ok := false;
    when others then ok := true;
  end;
  results := results || format('%s 8 non-Monday plan blocked', case when ok then 'PASS' else 'FAIL' end);

  -- 9. Owner still sees own token, plan and slot (no regression)
  select count(*) into n from share_tokens where token = tok;
  ok := n = 1;
  select count(*) into n from plan_slots where plan_id = p1;
  ok := ok and n = 1;
  results := results || format('%s 9 owner still reads own token and slots', case when ok then 'PASS' else 'FAIL' end);

  -- 10. Owner can still create a Monday plan
  begin
    insert into plans (household_id, week_start_date) values (h1, date '2000-01-17');
    ok := true;
  exception when others then ok := false;
  end;
  results := results || format('%s 10 owner creates Monday plan', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('role', 'postgres', true);
  select count(*) into fails from unnest(results) t where t like 'FAIL%';
  raise exception 'VERIFY 0005: % (% checks)%',
    case when fails = 0 then 'ALL PASS' else 'FAIL ' || fails end,
    array_length(results, 1),
    E'\n' || array_to_string(results, E'\n');
end
$verify$;
