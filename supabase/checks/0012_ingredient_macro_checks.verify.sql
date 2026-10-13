-- Verifies migrations/0012_ingredient_macro_checks.sql against a real database.
-- Run as postgres (SQL editor). Creates a throwaway user and ingredients, plays each write as
-- authenticated (the app's path, under the 0010 policies), then ALWAYS aborts with an exception:
-- nothing persists. Read the result in the error message:
--   "VERIFY 0012: ALL PASS (n checks)"  or  "VERIFY 0012: FAIL ..." with the list.
-- Expected baseline before 0012:
--   * live project: FAIL 10 (14 checks): checks 1-8 (out-of-range writes succeed) and 13-14 (the two
--     known bad rows still hold their bad values) fail; the legit paths 9-12 pass.
--   * PGlite (pnpm db:verify) or any database without the two live rows: FAIL 8 (14 checks), because
--     checks 13-14 pass when their row is absent ("if the row exists, it is plausible").
--
-- Each out-of-range write runs in its own subtransaction. If it succeeds, the block raises VRFY1 to
-- undo it, so a successful write never leaks into the next check. Only a check_violation counts as
-- blocked: any other error (RLS, a typo) is a FAIL, so a check cannot pass for the wrong reason.

do $verify$
declare
  a uuid := gen_random_uuid();
  ing_a uuid := gen_random_uuid();
  tag text := left(replace(gen_random_uuid()::text, '-', ''), 12);
  pb_id constant uuid := '8e412dad-fe87-49d1-88e4-864a73153ead';
  skyr_id constant uuid := '54ccf934-2fce-4fb3-b467-b5ababe914a3';
  r record;
  estimate numeric;
  ok boolean;
  results text[] := '{}';
  fails int := 0;
begin
  -- Fixtures (as postgres, RLS bypassed): a user and one valid ingredient they created.
  insert into auth.users (id, email) values (a, 'verify-a-' || a || '@verify.test');
  insert into ingredients (id, name, category, kcal_per_100g, protein_per_100g, fat_per_100g,
                           carbs_per_100g, source, created_by)
    values (ing_a, 'verify own ' || tag, 'inne', 588, 25, 50, 20, 'manual', a);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- 1-7. Out-of-range inserts (7: a missing macro counts as 0 in the sum)
  for r in
    select * from (values
      (1, 'protein above 100 g', 400::numeric, 100.5::numeric, 0::numeric, 0::numeric),
      (2, 'negative fat', 400, 0, -1, 0),
      (3, 'carbs above 100 g', 400, 0, 0, 101),
      (4, 'kcal above 900', 901, 0, 100, 0),
      (5, 'negative kcal', -1, 0, 0, 0),
      (6, 'macro sum above 101 g', 500, 40, 40, 30),
      (7, 'macro sum above 101 g with fat missing', 480, 60, null, 60)
    ) v(n, label, kcal, protein, fat, carbs)
  loop
    begin
      insert into ingredients (name, category, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g)
        values ('verify bad ' || r.n || ' ' || tag, 'inne', r.kcal, r.protein, r.fat, r.carbs);
      raise exception using errcode = 'VRFY1';
    exception
      when sqlstate 'VRFY1' then ok := false;
      when check_violation then ok := true;
      when others then ok := false;
    end;
    results := results || format('%s %s insert with %s rejected', case when ok then 'PASS' else 'FAIL' end, r.n, r.label);
  end loop;

  -- 8. Update an existing row to the old bad peanut butter values
  begin
    update ingredients set protein_per_100g = 75, fat_per_100g = 156.25, carbs_per_100g = 43.75
      where id = ing_a;
    raise exception using errcode = 'VRFY1';
  exception
    when sqlstate 'VRFY1' then ok := false;
    when check_violation then ok := true;
    when others then ok := false;
  end;
  results := results || format('%s 8 update to out-of-range macros rejected', case when ok then 'PASS' else 'FAIL' end);

  -- 9. Valid inserts at the boundaries (legit): pure fat, pure carbs, sum within the 1 g tolerance
  begin
    insert into ingredients (name, category, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g) values
      ('verify oil ' || tag, 'tluszcze', 900, 0, 100, 0),
      ('verify sugar ' || tag, 'przyprawy', 400, 0, 0, 100),
      ('verify rounding ' || tag, 'inne', 400, 0.5, 0.4, 100),
      ('verify salt ' || tag, 'przyprawy', 0, 0, 0, 0);
    ok := true;
  exception when others then ok := false;
  end;
  results := results || format('%s 9 valid boundary values accepted', case when ok then 'PASS' else 'FAIL' end);

  -- 10. Macro-less placeholder (picker and import fallback path)
  begin
    insert into ingredients (name, category, source) values ('verify placeholder ' || tag, 'inne', 'manual');
    ok := true;
  exception when others then ok := false;
  end;
  results := results || format('%s 10 macro-less placeholder accepted', case when ok then 'PASS' else 'FAIL' end);

  -- 11. Rows that miss the Atwater estimate are not blocked by the database
  begin
    insert into ingredients (name, category, kcal_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g) values
      ('verify cinnamon ' || tag, 'przyprawy', 247, 4, 1.2, 81),
      ('verify vodka ' || tag, 'napoje', 231, 0, 0, 0);
    ok := true;
  exception when others then ok := false;
  end;
  results := results || format('%s 11 spice-like and alcohol-like rows accepted', case when ok then 'PASS' else 'FAIL' end);

  -- 12. Creator updates own row to valid values
  begin
    update ingredients set kcal_per_100g = 593.75, protein_per_100g = 24, fat_per_100g = 50, carbs_per_100g = 14
      where id = ing_a;
    ok := found;
  exception when others then ok := false;
  end;
  results := results || format('%s 12 valid update accepted', case when ok then 'PASS' else 'FAIL' end);

  perform set_config('role', 'postgres', true);

  -- 13-14. The two corrected live rows, if present, hold plausible values:
  -- in range, sum <= 101 and kcal within 0.6-1.2x of the Atwater estimate (or within 10 kcal).
  for r in
    select * from (values (13, pb_id, 'Peanut Butter Crunchy'), (14, skyr_id, 'Skyr Wanilia')) v(n, id, label)
  loop
    ok := true;
    for estimate in
      select 4 * protein_per_100g + 9 * fat_per_100g + 4 * carbs_per_100g from ingredients where id = r.id
    loop
      select coalesce(
               protein_per_100g between 0 and 100 and fat_per_100g between 0 and 100
               and carbs_per_100g between 0 and 100 and kcal_per_100g between 0 and 900
               and protein_per_100g + fat_per_100g + carbs_per_100g <= 101
               and (abs(kcal_per_100g - estimate) <= 10
                    or kcal_per_100g between 0.6 * estimate and 1.2 * estimate),
               false)
        into ok
        from ingredients where id = r.id;
    end loop;
    results := results || format('%s %s %s row plausible if present', case when ok then 'PASS' else 'FAIL' end, r.n, r.label);
  end loop;

  select count(*) into fails from unnest(results) t where t like 'FAIL%';
  raise exception 'VERIFY 0012: % (% checks)%',
    case when fails = 0 then 'ALL PASS' else 'FAIL ' || fails end,
    array_length(results, 1),
    E'\n' || array_to_string(results, E'\n');
end
$verify$;
