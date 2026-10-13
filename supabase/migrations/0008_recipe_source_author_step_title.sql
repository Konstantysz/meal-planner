-- recipes.source_author: who wrote the recipe (imported site/author name, or the household member
--   who wrote it). Free text, nullable. recipes.author_id (who saved it) is untouched.
-- recipe_steps.title: optional short heading of a step (e.g. Aniagotuje); the details stay in text.
-- save_recipe reads both from p_recipe (recipe.source_author, steps[].title); missing or blank = null,
-- so callers that omit them keep working. No data migration: existing rows stay null.
-- Rollback: supabase/rollbacks/0008_recipe_source_author_step_title.down.sql

alter table public.recipes add column source_author text;
alter table public.recipe_steps add column title text;

create or replace function public.save_recipe(p_household_id uuid, p_recipe jsonb)
returns public.recipes
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved public.recipes;
begin
  if coalesce(jsonb_array_length(p_recipe -> 'ingredients'), 0) = 0
     or coalesce(jsonb_array_length(p_recipe -> 'steps'), 0) = 0 then
    raise exception 'recipe needs at least one ingredient and one step'
      using errcode = '22023';
  end if;

  insert into recipes (
    household_id, author_id, name, servings_base, prep_time_min,
    source_url, visibility, diet_tags, allergens, source_author
  )
  values (
    p_household_id,
    auth.uid(),
    p_recipe ->> 'name',
    (p_recipe ->> 'servings_base')::int,
    (p_recipe ->> 'prep_time_min')::int,
    p_recipe ->> 'source_url',
    coalesce(p_recipe ->> 'visibility', 'household'),
    coalesce(array(select jsonb_array_elements_text(p_recipe -> 'diet_tags')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p_recipe -> 'allergens')), '{}'),
    nullif(btrim(p_recipe ->> 'source_author'), '')
  )
  returning * into saved;

  insert into recipe_ingredients (recipe_id, ingredient_id, amount, unit, raw_text, position, optional)
  select saved.id, i.ingredient_id, i.amount, i.unit, i.raw_text, i.position, coalesce(i.optional, false)
  from jsonb_to_recordset(p_recipe -> 'ingredients')
    as i(ingredient_id uuid, amount numeric, unit text, raw_text text, position int, optional boolean);

  insert into recipe_steps (recipe_id, position, text, title)
  select saved.id, s.position, s.text, nullif(btrim(s.title), '')
  from jsonb_to_recordset(p_recipe -> 'steps') as s(position int, text text, title text);

  return saved;
end;
$$;

revoke execute on function public.save_recipe(uuid, jsonb) from public, anon;
grant execute on function public.save_recipe(uuid, jsonb) to authenticated;
