-- Ingredient ownership and an app admin role (#70).
--   Before: ing_update was using (true): any signed-in user could change any ingredient's
--   macros, for every household. Nothing set ingredients.created_by, so all rows had no creator.
--   After: created_by defaults to the caller and an insert must carry the caller's id;
--   an update needs the creator or an app admin. Rows without a creator (the seed and every
--   row that existed before this migration) are editable by app admins only.
-- App admins live in app_admins. RLS is on with no policies and anon/authenticated have no
-- table privileges, so no client can read or write it; add an admin from the SQL editor:
--   insert into public.app_admins (user_id) values ('<auth.users id>');
-- Deleting a user keeps their ingredients (created_by becomes null, so admin-only).
-- Reads are unchanged: ing_select stays public.
-- No app change needed: the app never sends created_by and never updates ingredients.
-- Merge after the 0008 and 0009 PRs so versions deploy in order.
-- Rollback: supabase/rollbacks/0010_ingredient_ownership.down.sql

-- ---------------------------------------------------------------------------
-- App admins
-- ---------------------------------------------------------------------------

create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
-- Supabase grants table privileges to anon/authenticated by default; take them away so a
-- policy added by mistake later still cannot expose the table.
revoke all on table public.app_admins from public, anon, authenticated;

create or replace function public.is_app_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from app_admins where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- ingredients
-- ---------------------------------------------------------------------------

alter table public.ingredients alter column created_by set default auth.uid();

alter table public.ingredients drop constraint ingredients_created_by_fkey;
alter table public.ingredients
  add constraint ingredients_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

drop policy ing_insert on public.ingredients;
drop policy ing_update on public.ingredients;

create policy ing_insert on public.ingredients for insert to authenticated
  with check (created_by = (select auth.uid()));

-- with check repeats the rule, so a creator cannot hand a row to someone else or orphan it.
create policy ing_update on public.ingredients for update to authenticated
  using (created_by = (select auth.uid()) or (select is_app_admin()))
  with check (created_by = (select auth.uid()) or (select is_app_admin()));
