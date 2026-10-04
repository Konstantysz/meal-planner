-- Security hardening, no data model change, no app code change.
--
-- Closes:
--   * hm_insert: any user could add themselves (even as owner) to any household.
--   * hm_delete: any member could remove any other member, including the owner.
--   * households_insert: `with check (true)` for every role, anon included.
--     Households are created only by create_household_with_owner (security definer).
--   * rec_update: no WITH CHECK, so an author could move a recipe into a foreign household.
--   * st_insert: any signed-in user could create a share token for any plan_id,
--     which (via *_select_via_share_token) exposed that plan to everyone.
--   * SECURITY DEFINER functions executable by anon; is_member_of had a mutable search_path.
-- Performance (Supabase advisors):
--   * policies scoped to `authenticated` instead of `public`;
--   * auth.uid() wrapped in (select ...) so it is evaluated once per statement;
--   * covering indexes for 8 foreign keys.
--
-- Deliberately unchanged (later steps): st_select using (true) and the three
-- *_select_via_share_token policies (share page reads share_tokens directly),
-- ing_update open to any signed-in user (crowd-sourced catalog, model change pending).
--
-- Behaviour change: recipes with visibility = 'public_link' are no longer readable
-- by anon. No UI sets that value.
--
-- Rollback: supabase/rollbacks/0004_security_hardening.down.sql

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

alter function public.is_member_of(uuid) set search_path = public;

create or replace function public.is_owner_of(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- Postgres grants EXECUTE to PUBLIC by default; Supabase also grants anon explicitly.
revoke execute on function public.is_member_of(uuid) from public, anon;
revoke execute on function public.is_owner_of(uuid) from public, anon;
revoke execute on function public.create_household_with_owner(text) from public, anon;
grant execute on function public.is_member_of(uuid) to authenticated;
grant execute on function public.is_owner_of(uuid) to authenticated;
grant execute on function public.create_household_with_owner(text) to authenticated;

-- rls_auto_enable is created by Supabase (event trigger ensure_rls), not by our
-- migrations, so it may be absent locally. Event triggers do not need these grants.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------

drop policy households_insert on households;
drop policy households_select on households;
drop policy households_update on households;

create policy households_select on households for select to authenticated
  using (is_member_of(id));
create policy households_update on households for update to authenticated
  using (is_member_of(id)) with check (is_member_of(id));

-- ---------------------------------------------------------------------------
-- household_members
-- ---------------------------------------------------------------------------

drop policy hm_select on household_members;
drop policy hm_insert on household_members;
drop policy hm_delete on household_members;

create policy hm_select on household_members for select to authenticated
  using (user_id = (select auth.uid()) or is_member_of(household_id));

-- Only an existing member can add someone, and only as 'member'.
-- The owner row is created by create_household_with_owner, which bypasses RLS.
create policy hm_insert on household_members for insert to authenticated
  with check (is_member_of(household_id) and role = 'member');

-- A member may leave; the owner may remove others. The owner can't remove
-- themselves, so a household never loses its owner this way.
create policy hm_delete on household_members for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role = 'member')
    or (is_owner_of(household_id) and user_id <> (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- ingredients (semantics unchanged: public read, any signed-in user writes)
-- ---------------------------------------------------------------------------

drop policy ing_insert on ingredients;
drop policy ing_update on ingredients;

create policy ing_insert on ingredients for insert to authenticated
  with check (true);
create policy ing_update on ingredients for update to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- recipes
-- ---------------------------------------------------------------------------

drop policy rec_select on recipes;
drop policy rec_insert on recipes;
drop policy rec_update on recipes;
drop policy rec_delete on recipes;

create policy rec_select on recipes for select to authenticated
  using (
    visibility = 'public_link'
    or author_id = (select auth.uid())
    or is_member_of(household_id)
  );
create policy rec_insert on recipes for insert to authenticated
  with check (author_id = (select auth.uid()) and is_member_of(household_id));
-- WITH CHECK keeps the recipe inside a household the caller belongs to.
create policy rec_update on recipes for update to authenticated
  using (author_id = (select auth.uid()) or is_member_of(household_id))
  with check (is_member_of(household_id));
create policy rec_delete on recipes for delete to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- recipe_ingredients / recipe_steps (inherit from recipes)
-- ---------------------------------------------------------------------------

drop policy ri_all on recipe_ingredients;
drop policy rs_all on recipe_steps;

create policy ri_all on recipe_ingredients for all to authenticated
  using (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or is_member_of(r.household_id))
  ))
  with check (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or is_member_of(r.household_id))
  ));

create policy rs_all on recipe_steps for all to authenticated
  using (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or is_member_of(r.household_id))
  ))
  with check (exists (
    select 1 from recipes r where r.id = recipe_id
      and (r.author_id = (select auth.uid()) or is_member_of(r.household_id))
  ));

-- ---------------------------------------------------------------------------
-- plans / plan_slots / pantry_items
-- ---------------------------------------------------------------------------

drop policy plans_all on plans;
drop policy plan_slots_all on plan_slots;
drop policy pantry_all on pantry_items;

create policy plans_all on plans for all to authenticated
  using (is_member_of(household_id)) with check (is_member_of(household_id));

create policy plan_slots_all on plan_slots for all to authenticated
  using (exists (select 1 from plans p where p.id = plan_id and is_member_of(p.household_id)))
  with check (exists (select 1 from plans p where p.id = plan_id and is_member_of(p.household_id)));

create policy pantry_all on pantry_items for all to authenticated
  using (is_member_of(household_id)) with check (is_member_of(household_id));

-- ---------------------------------------------------------------------------
-- share_tokens
-- ---------------------------------------------------------------------------

drop policy st_insert on share_tokens;
drop policy st_delete on share_tokens;

-- Token may only be created for a plan of the caller's own household.
create policy st_insert on share_tokens for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from plans p where p.id = plan_id and is_member_of(p.household_id))
  );
create policy st_delete on share_tokens for delete to authenticated
  using (created_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Foreign key indexes
-- ---------------------------------------------------------------------------

create index if not exists household_members_user_idx on household_members (user_id);
create index if not exists ingredients_created_by_idx on ingredients (created_by);
create index if not exists pantry_items_ingredient_idx on pantry_items (ingredient_id);
create index if not exists plan_slots_recipe_idx on plan_slots (recipe_id);
create index if not exists recipe_ingredients_ingredient_idx on recipe_ingredients (ingredient_id);
create index if not exists recipes_author_idx on recipes (author_id);
create index if not exists share_tokens_created_by_idx on share_tokens (created_by);
create index if not exists share_tokens_plan_idx on share_tokens (plan_id);
