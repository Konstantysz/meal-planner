-- Manual rollback for migrations/0010_ingredient_ownership.sql.
-- Not picked up by `supabase db push` (outside supabase/migrations).
-- No app change to roll back first: the app never relied on created_by or app admins.
-- Drops app_admins and its rows. created_by values written since 0010 are kept.
-- Run in the SQL editor, then: supabase migration repair --status reverted 0010

begin;

-- 0004 policies: any signed-in user inserts and updates any ingredient.
drop policy ing_insert on public.ingredients;
drop policy ing_update on public.ingredients;

create policy ing_insert on public.ingredients for insert to authenticated
  with check (true);
create policy ing_update on public.ingredients for update to authenticated
  using (true) with check (true);

alter table public.ingredients drop constraint ingredients_created_by_fkey;
alter table public.ingredients
  add constraint ingredients_created_by_fkey
  foreign key (created_by) references auth.users (id);

alter table public.ingredients alter column created_by drop default;

drop function public.is_app_admin();
drop table public.app_admins;

commit;
