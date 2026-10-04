-- Manual rollback for migrations/0004_security_hardening.sql.
-- Not picked up by `supabase db push` (outside supabase/migrations).
-- Restores the 0001 policies and grants exactly, including their known holes.
-- Run in the SQL editor, then: supabase migration repair --status reverted 0004

begin;

-- Indexes are harmless to keep; drop only for a byte-exact rollback.
drop index if exists household_members_user_idx;
drop index if exists ingredients_created_by_idx;
drop index if exists pantry_items_ingredient_idx;
drop index if exists plan_slots_recipe_idx;
drop index if exists recipe_ingredients_ingredient_idx;
drop index if exists recipes_author_idx;
drop index if exists share_tokens_created_by_idx;
drop index if exists share_tokens_plan_idx;

drop policy households_select on households;
drop policy households_update on households;
create policy households_select on households for select using (is_member_of(id));
create policy households_insert on households for insert with check (true);
create policy households_update on households for update using (is_member_of(id));

drop policy hm_select on household_members;
drop policy hm_insert on household_members;
drop policy hm_delete on household_members;
create policy hm_select on household_members for select using (
  user_id = auth.uid() or is_member_of(household_id)
);
create policy hm_insert on household_members for insert with check (
  user_id = auth.uid() or is_member_of(household_id)
);
create policy hm_delete on household_members for delete using (
  user_id = auth.uid() or is_member_of(household_id)
);

drop policy ing_insert on ingredients;
drop policy ing_update on ingredients;
create policy ing_insert on ingredients for insert with check (auth.uid() is not null);
create policy ing_update on ingredients for update using (auth.uid() is not null);

drop policy rec_select on recipes;
drop policy rec_insert on recipes;
drop policy rec_update on recipes;
drop policy rec_delete on recipes;
create policy rec_select on recipes for select using (
  visibility = 'public_link' or author_id = auth.uid() or is_member_of(household_id)
);
create policy rec_insert on recipes for insert with check (
  author_id = auth.uid() and is_member_of(household_id)
);
create policy rec_update on recipes for update using (
  author_id = auth.uid() or is_member_of(household_id)
);
create policy rec_delete on recipes for delete using (author_id = auth.uid());

drop policy ri_all on recipe_ingredients;
drop policy rs_all on recipe_steps;
create policy ri_all on recipe_ingredients for all using (
  exists (select 1 from recipes r where r.id = recipe_id and (
    r.author_id = auth.uid() or is_member_of(r.household_id)))
) with check (
  exists (select 1 from recipes r where r.id = recipe_id and (
    r.author_id = auth.uid() or is_member_of(r.household_id)))
);
create policy rs_all on recipe_steps for all using (
  exists (select 1 from recipes r where r.id = recipe_id and (
    r.author_id = auth.uid() or is_member_of(r.household_id)))
) with check (
  exists (select 1 from recipes r where r.id = recipe_id and (
    r.author_id = auth.uid() or is_member_of(r.household_id)))
);

drop policy plans_all on plans;
drop policy plan_slots_all on plan_slots;
drop policy pantry_all on pantry_items;
create policy plans_all on plans for all using (is_member_of(household_id))
  with check (is_member_of(household_id));
create policy plan_slots_all on plan_slots for all using (
  exists (select 1 from plans p where p.id = plan_id and is_member_of(p.household_id))
) with check (
  exists (select 1 from plans p where p.id = plan_id and is_member_of(p.household_id))
);
create policy pantry_all on pantry_items for all using (is_member_of(household_id))
  with check (is_member_of(household_id));

drop policy st_insert on share_tokens;
drop policy st_delete on share_tokens;
create policy st_insert on share_tokens for insert with check (auth.uid() is not null);
create policy st_delete on share_tokens for delete using (created_by = auth.uid());

drop function public.is_owner_of(uuid);
alter function public.is_member_of(uuid) reset search_path;
grant execute on function public.is_member_of(uuid) to public, anon;
grant execute on function public.create_household_with_owner(text) to public, anon;
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    grant execute on function public.rls_auto_enable() to public, anon, authenticated;
  end if;
end $$;

commit;
