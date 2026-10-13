-- recipes.image_url: optional cover photo, a remote https URL hotlinked from the imported page
--   (og:image / JSON-LD image) or typed in the form. Nullable; existing rows stay null.
--   Hotlink only, no Supabase Storage (Free plan): revisit if hotlinks prove unreliable.
--   The check keeps the column to http(s) URLs of at most 2048 chars; which hosts the app renders
--   is decided in app code (src/lib/image-hosts.ts), not here.
-- save_recipe and update_recipe read it from p_recipe.image_url; missing or blank = null, so callers
--   that omit it keep working (but update_recipe then clears the photo: send the stored value on edit).
-- Depends on 0008 (save_recipe) and 0009 (update_recipe). Requires app code that sends image_url.
-- Merge first: 0012 (#97), 0013 (#96) and 0014 (#98) follow this one; if 0011 lands later it must be renumbered above them and its live baseline retaken.
-- Rollback: supabase/rollbacks/0011_recipe_image_url.down.sql

alter table public.recipes add column image_url text;
alter table public.recipes add constraint recipes_image_url_http
  check (image_url is null or (image_url ~ '^https?://' and length(image_url) <= 2048));

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
    source_url, visibility, diet_tags, allergens, source_author, image_url
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
    nullif(btrim(p_recipe ->> 'source_author'), ''),
    nullif(btrim(p_recipe ->> 'image_url'), '')
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
    image_url = nullif(btrim(p_recipe ->> 'image_url'), ''),
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
