-- Verifies migrations/0004_security_hardening.sql against a real database.
-- Run as postgres (SQL editor or MCP execute_sql with write access).
-- Creates throwaway users/rows, plays each attack as anon/authenticated, then
-- ALWAYS aborts with an exception, so nothing is persisted.
-- Read the result in the error message:
--   "VERIFY 0004: ALL PASS (n checks)"  or  "VERIFY 0004: FAIL ..." with the list.
-- Before 0004 is applied the attack checks are expected to FAIL.

do $verify$
declare
  a uuid := gen_random_uuid();  -- owner of h1
  b uuid := gen_random_uuid();  -- outsider, owner of h2
  c uuid := gen_random_uuid();  -- member of h1
  d uuid := gen_random_uuid();  -- user to be invited
  h1 uuid := gen_random_uuid();
  h2 uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid();
  n int;
  ok boolean;
  results text[] := '{}';
  fails int := 0;
begin
  -- Fixtures (as postgres, RLS bypassed)
  insert into auth.users (id, email) values
    (a, a || '@verify.test'), (b, b || '@verify.test'),
    (c, c || '@verify.test'), (d, d || '@verify.test');
  insert into households (id, name) values (h1, 'verify h1'), (h2, 'verify h2');
  insert into household_members (household_id, user_id, role) values
    (h1, a, 'owner'), (h1, c, 'member'), (h2, b, 'owner');
  insert into plans (id, household_id, week_start_date) values (p1, h1, date '2000-01-03');
  insert into recipes (id, household_id, author_id, name, servings_base)
    values (r1, h1, a, 'verify recipe', 2);

  -- 1. Outsider joins a foreign household as member
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin
    insert into household_members (household_id, user_id, role) values (h1, b, 'member');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format('%s 1 outsider self-join as member blocked', case when ok then 'PASS' else 'FAIL' end);

  -- 2. Outsider joins a foreign household as owner
  begin
    insert into household_members (household_id, user_id, role) values (h1, b, 'owner');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format('%s 2 outsider self-join as owner blocked', case when ok then 'PASS' else 'FAIL' end);

  -- 3. Outsider creates a share token for a foreign plan
  begin
    insert into share_tokens (token, plan_id, created_by) values ('verify-bad-' || b, p1, b);
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format('%s 3 share token for foreign plan blocked', case when ok then 'PASS' else 'FAIL' end);

  -- 4. Author moves recipe into a household they don't belong to (as a, into h2)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    update recipes set household_id = h2 where id = r1;
    get diagnostics n = row_count;
    ok := n = 0;
  exception when others then ok := true;
  end;
  results := results || format('%s 4 recipe moved to foreign household blocked', case when ok then 'PASS' else 'FAIL' end);

  -- 5. Owner invites d as owner (role escalation)
  begin
    insert into household_members (household_id, user_id, role) values (h1, d, 'owner');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format('%s 5 invite as owner blocked', case when ok then 'PASS' else 'FAIL' end);

  -- 6. Owner invites d as member (legit path, inviteMember)
  begin
    insert into household_members (household_id, user_id, role) values (h1, d, 'member');
    ok := true;
  exception when others then ok := false;
  end;
  results := results || format('%s 6 member invite still works', case when ok then 'PASS' else 'FAIL' end);

  -- 7. Owner creates a share token for own plan (legit path, createShareToken)
  begin
    insert into share_tokens (token, plan_id, created_by) values ('verify-ok-' || a, p1, a);
    ok := true;
  exception when others then ok := false;
  end;
  results := results || format('%s 7 share token for own plan still works', case when ok then 'PASS' else 'FAIL' end);

  -- 8. Member c removes owner a
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  delete from household_members where household_id = h1 and user_id = a;
  get diagnostics n = row_count;
  results := results || format('%s 8 member cannot remove owner', case when n = 0 then 'PASS' else 'FAIL' end);

  -- 9. Member c leaves (legit)
  delete from household_members where household_id = h1 and user_id = c;
  get diagnostics n = row_count;
  results := results || format('%s 9 member can leave', case when n = 1 then 'PASS' else 'FAIL' end);

  -- 10. Member still reads own household recipe (no regression)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from recipes where id = r1;
  results := results || format('%s 10 owner still reads own recipe', case when n = 1 then 'PASS' else 'FAIL' end);

  -- 11. anon creates a household
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    insert into households (name) values ('verify anon');
    ok := false;
  exception when others then ok := true;
  end;
  results := results || format('%s 11 anon cannot create household', case when ok then 'PASS' else 'FAIL' end);

  -- 12. anon calls is_member_of via RPC
  begin
    perform is_member_of(h1);
    ok := false;
  exception when insufficient_privilege then ok := true;
  end;
  results := results || format('%s 12 anon cannot execute is_member_of', case when ok then 'PASS' else 'FAIL' end);

  -- 13. anon still reads a shared plan (share page path)
  begin
    select count(*) into n from plans where id = p1;
    ok := n = 1;
  exception when others then ok := false;
  end;
  results := results || format('%s 13 anon still reads shared plan', case when ok then 'PASS' else 'FAIL' end);

  -- 14. anon still reads the shared plan's recipe through the slot join
  perform set_config('role', 'postgres', true);
  insert into plan_slots (plan_id, date, position, recipe_id) values (p1, date '2000-01-03', 0, r1);
  perform set_config('role', 'anon', true);
  begin
    select count(*) into n from recipes where id = r1;
    ok := n = 1;
  exception when others then ok := false;
  end;
  results := results || format('%s 14 anon still reads shared recipe', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('role', 'postgres', true);
  select count(*) into fails from unnest(results) t where t like 'FAIL%';
  raise exception 'VERIFY 0004: % (% checks)%',
    case when fails = 0 then 'ALL PASS' else 'FAIL ' || fails end,
    array_length(results, 1),
    E'\n' || array_to_string(results, E'\n');
end
$verify$;
