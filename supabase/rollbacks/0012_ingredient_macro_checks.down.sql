-- Manual rollback for migrations/0012_ingredient_macro_checks.sql.
-- Not picked up by `supabase db push` (outside supabase/migrations).
-- Drops the five macro range constraints. The two corrected rows (Peanut Butter Crunchy, Skyr Wanilia)
-- keep their corrected values: the old ones were wrong, and nothing depends on them.
-- No app change needs rolling back first: the app's range rules (IngredientInputSchema) only reject
-- values the constraints would have rejected anyway.
-- Run in the SQL editor, then: supabase migration repair --status reverted 0012

begin;

alter table public.ingredients
  drop constraint ingredients_kcal_range,
  drop constraint ingredients_protein_range,
  drop constraint ingredients_fat_range,
  drop constraint ingredients_carbs_range,
  drop constraint ingredients_macro_sum;

commit;
