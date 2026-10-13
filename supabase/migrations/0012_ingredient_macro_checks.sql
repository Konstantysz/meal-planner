-- Range checks on ingredient macros, and the two known bad rows corrected (#71).
--   Before: any value could be stored. Two Open Food Facts rows on the live project were wrong
--   (read with the read-only Supabase MCP on 2026-10-13):
--   * 8e412dad-fe87-49d1-88e4-864a73153ead "Peanut Butter Crunchy": kcal 593.75, protein 75,
--     fat 156.25, carbs 43.75. Fat over 100 g per 100 g is impossible. kcal is right; protein, fat
--     and carbs are each 3.125x too high (75/24, 156.25/50, 43.75/14), so they become 24 / 50 / 14
--     (Atwater 602 kcal vs. the stated 593.75).
--   * 54ccf934-2fce-4fb3-b467-b5ababe914a3 "Skyr Wanilia": kcal 22.29 with protein 6.5, fat 1.5,
--     carbs 9.5 (Atwater 77.5 kcal). kcal is 3.5x too low (78 / 3.5 = 22.29), so it becomes 78.
--     The stored value is 22.2857142857143, so the guard compares it rounded to 2 decimals.
--   Each update matches the id AND the current bad values, so a row already fixed by hand is left
--   alone. On a database without these rows (PGlite, a fresh project) the updates touch nothing.
--   After: protein, fat and carbs each 0..100 g per 100 g, their sum at most 101 g (1 g for label
--   rounding), kcal 0..900. Null values stay allowed (macro-less ingredients).
-- Plain "add constraint ... check" validates every existing row, so the migration fails loudly if any
-- other live row breaks a rule; fix that row, then deploy again.
-- The Atwater rule (kcal vs. 4/9/4 per gram) is deliberately not a constraint: alcohol and fibre-rich
-- spices legitimately miss it. The app applies it to Open Food Facts results only
-- (src/lib/macro-validation.ts), and supabase/reports/data_quality.sql lists rows that miss it.
-- App change in the same PR: IngredientInputSchema applies the same range rules, so the API rejects
-- an out-of-range ingredient with 400 before the database does.
-- Merge order: merge only after 0011 (#92); then 0013 (#96) and 0014 (#98) follow this one.
-- Rollback: supabase/rollbacks/0012_ingredient_macro_checks.down.sql

update public.ingredients
set protein_per_100g = 24, fat_per_100g = 50, carbs_per_100g = 14
where id = '8e412dad-fe87-49d1-88e4-864a73153ead'
  and protein_per_100g = 75
  and fat_per_100g = 156.25
  and carbs_per_100g = 43.75;

update public.ingredients
set kcal_per_100g = 78
where id = '54ccf934-2fce-4fb3-b467-b5ababe914a3'
  and round(kcal_per_100g::numeric, 2) = 22.29
  and protein_per_100g = 6.5
  and fat_per_100g = 1.5
  and carbs_per_100g = 9.5;

alter table public.ingredients
  add constraint ingredients_kcal_range check (kcal_per_100g between 0 and 900),
  add constraint ingredients_protein_range check (protein_per_100g between 0 and 100),
  add constraint ingredients_fat_range check (fat_per_100g between 0 and 100),
  add constraint ingredients_carbs_range check (carbs_per_100g between 0 and 100),
  add constraint ingredients_macro_sum check (
    coalesce(protein_per_100g, 0) + coalesce(fat_per_100g, 0) + coalesce(carbs_per_100g, 0) <= 101
  );
