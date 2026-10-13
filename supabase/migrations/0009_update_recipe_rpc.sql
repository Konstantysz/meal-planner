-- update_recipe: edit a saved recipe in one transaction.
--   Before: no update path existed; /recipes/[id]/edit was read-only.
--   After: update_recipe(p_recipe_id, p_recipe) updates the recipe's own columns and replaces
--   its ingredients and steps (delete + insert, so reordering and removal need no diffing).
--   SECURITY INVOKER: RLS still decides (rec_update, ri_all, rs_all), like save_recipe.
--   Fails loudly: an UPDATE that RLS filters affects 0 rows and raises no error, so the function
--   raises 42501 when no row was updated (recipe missing or not editable by the caller).
--   author_id, household_id and created_at are never changed.
--   p_recipe has the same shape as for save_recipe (RecipeInputSchema output).
-- Requires app code that calls update_recipe (same PR). Depends on 0008 (source_author, title).
-- Rollback: supabase/rollbacks/0009_update_recipe_rpc.down.sql

create or replace function public.update_recipe(p_recipe_id uuid, p_recipe jsonb)
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

  update recipes set
    name = p_recipe ->> 'name',
    servings_base = (p_recipe ->> 'servings_base')::int,
    prep_time_min = (p_recipe ->> 'prep_time_min')::int,
    source_url = p_recipe ->> 'source_url',
    source_author = nullif(btrim(p_recipe ->> 'source_author'), ''),
    visibility = coalesce(p_recipe ->> 'visibility', 'household'),
    diet_tags = coalesce(array(select jsonb_array_elements_text(p_recipe -> 'diet_tags')), '{}'),
    allergens = coalesce(array(select jsonb_array_elements_text(p_recipe -> 'allergens')), '{}')
  where id = p_recipe_id
  returning * into saved;

  -- RLS hides rows the caller may not edit: without this check the call would succeed and do nothing.
  if not found then
    raise exception 'recipe not found or not editable'
      using errcode = '42501';
  end if;

  delete from recipe_ingredients where recipe_id = saved.id;
  delete from recipe_steps where recipe_id = saved.id;

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

revoke execute on function public.update_recipe(uuid, jsonb) from public, anon;
grant execute on function public.update_recipe(uuid, jsonb) to authenticated;
