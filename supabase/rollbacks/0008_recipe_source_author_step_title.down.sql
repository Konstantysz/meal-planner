-- Manual rollback for migrations/0008_recipe_source_author_step_title.sql.
-- Not picked up by `supabase db push` (outside supabase/migrations).
-- Roll back the app code first (it sends source_author/title to save_recipe and reads the columns).
-- Drops the data in both columns. Run in the SQL editor, then: supabase migration repair --status reverted 0008

begin;

-- 0007 version (no source_author, no step title).
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
    source_url, visibility, diet_tags, allergens
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
    coalesce(array(select jsonb_array_elements_text(p_recipe -> 'allergens')), '{}')
  )
  returning * into saved;

  insert into recipe_ingredients (recipe_id, ingredient_id, amount, unit, raw_text, position, optional)
  select saved.id, i.ingredient_id, i.amount, i.unit, i.raw_text, i.position, coalesce(i.optional, false)
  from jsonb_to_recordset(p_recipe -> 'ingredients')
    as i(ingredient_id uuid, amount numeric, unit text, raw_text text, position int, optional boolean);

  insert into recipe_steps (recipe_id, position, text)
  select saved.id, s.position, s.text
  from jsonb_to_recordset(p_recipe -> 'steps') as s(position int, text text);

  return saved;
end;
$$;

revoke execute on function public.save_recipe(uuid, jsonb) from public, anon;
grant execute on function public.save_recipe(uuid, jsonb) to authenticated;

alter table public.recipe_steps drop column title;
alter table public.recipes drop column source_author;

commit;
