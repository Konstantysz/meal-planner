-- Data-quality report for ingredients and recipe ingredients (#71).
-- READ-ONLY: a single SELECT, it never writes. Paste it into the SQL editor and run it any time.
-- Not a migration and not a verification script: nothing in CI or `supabase db push` runs it.
--
-- One row per finding, ordered by issue:
--   atwater          an ingredient whose kcal disagrees with the Atwater estimate (4/9/4 kcal per gram of
--                    protein/fat/carbs) outside 0.6-1.2x and by more than 10 kcal. Same rule as
--                    validateMacros(..., { atwater: true }) in src/lib/macro-validation.ts. Not always an
--                    error: alcohol and fibre-rich spices legitimately miss it. Check against the label.
--   macro_less       a macro-less ingredient (all four values null) used in at least one recipe; it counts
--                    as 0 in recipe macros. detail lists the recipes.
--   no_amount        a recipe ingredient without an amount.
--   unit_not_grams   a recipe ingredient whose unit cannot be converted to grams, so it adds 0 to the
--                    recipe's macros. Convertible units mirror GRAMS_PER_UNIT / toGrams in
--                    src/lib/macros.ts (PR #95): mg, g, gr, dag, dkg, kg, ml, cl, dl, l, compared
--                    trimmed, lowercased and with one trailing dot stripped, plus the inflected forms
--                    normalizeUnit maps onto g and l ("gram...", "litr..."). Keep this list in step with it.
-- Optional recipe ingredients are listed too (marked in detail); they never count toward macros.

with ing as (
  select
    i.*,
    4 * i.protein_per_100g + 9 * i.fat_per_100g + 4 * i.carbs_per_100g as atwater_kcal
  from public.ingredients i
)
select issue, ingredient_id, ingredient, recipe_id, recipe, detail
from (
  select
    1 as ord,
    'atwater' as issue,
    ing.id as ingredient_id,
    ing.name as ingredient,
    null::uuid as recipe_id,
    null::text as recipe,
    format(
      'kcal %s vs Atwater %s (%sx); P %s F %s C %s; source %s',
      ing.kcal_per_100g, round(ing.atwater_kcal, 1),
      case when ing.atwater_kcal > 0 then round(ing.kcal_per_100g / ing.atwater_kcal, 2)::text else 'n/a' end,
      ing.protein_per_100g, ing.fat_per_100g, ing.carbs_per_100g, ing.source
    ) as detail
  from ing
  where ing.kcal_per_100g is not null
    and ing.atwater_kcal is not null
    and abs(ing.kcal_per_100g - ing.atwater_kcal) > 10
    and not (ing.atwater_kcal > 0
             and ing.kcal_per_100g between 0.6 * ing.atwater_kcal and 1.2 * ing.atwater_kcal)

  union all

  select
    2,
    'macro_less',
    ing.id,
    ing.name,
    null::uuid,
    null::text,
    format('used in %s recipe(s): %s', count(distinct r.id), string_agg(distinct r.name, ', '))
  from ing
  join public.recipe_ingredients ri on ri.ingredient_id = ing.id
  join public.recipes r on r.id = ri.recipe_id
  where ing.kcal_per_100g is null
    and ing.protein_per_100g is null
    and ing.fat_per_100g is null
    and ing.carbs_per_100g is null
  group by ing.id, ing.name

  union all

  select
    3,
    case when ri.amount is null then 'no_amount' else 'unit_not_grams' end,
    ri.ingredient_id,
    ing.name,
    r.id,
    r.name,
    format(
      'line "%s": amount %s, unit %s%s',
      ri.raw_text, coalesce(ri.amount::text, 'null'), coalesce(ri.unit, 'null'),
      case when ri.optional then ' (optional)' else '' end
    )
  from public.recipe_ingredients ri
  join public.recipes r on r.id = ri.recipe_id
  join ing on ing.id = ri.ingredient_id
  where ri.amount is null
     or ri.unit is null
     or not (
       -- Same key as toGrams: trim, lowercase, strip one trailing dot. Keep in step with GRAMS_PER_UNIT.
       regexp_replace(lower(trim(ri.unit)), '\.$', '')
         in ('mg', 'g', 'gr', 'dag', 'dkg', 'kg', 'ml', 'cl', 'dl', 'l')
       or regexp_replace(lower(trim(ri.unit)), '\.$', '') ~ '(^|\s)(gram|litr)\S*$'
     )
) findings
order by ord, issue, ingredient, recipe;
