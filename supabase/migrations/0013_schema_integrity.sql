-- Schema integrity (#72): rules the app assumed but the database did not enforce.
--   1. Recipe ingredients and steps: position unique per recipe and >= 0; an amount, when set, > 0;
--      step text not blank. Plain (non-deferrable) unique constraints are enough: save_recipe inserts
--      each list in one statement with distinct positions, and update_recipe deletes the old rows in an
--      earlier statement before inserting the new ones, so a reorder never meets the old positions.
--   2. Deleting a user account no longer fails: recipes.author_id becomes nullable and is set null
--      (the recipe stays with its household, the saving member becomes unknown); share tokens the user
--      created are deleted with them (on delete cascade). household_members and app_admins already
--      cascade, ingredients.created_by is already set null (0010); plans have no user column.
--      rec_insert still requires author_id = auth.uid(), so new recipes always carry their author.
--   3. recipes.updated_at, maintained by a BEFORE UPDATE trigger (clients cannot set it). Existing
--      rows start at their created_at. update_recipe (0009) always updates the recipe row, so an edit
--      moves it; a direct write to recipe_ingredients/recipe_steps alone does not.
--   4. A slot's date must fall inside its plan's week (week_start_date .. +6). A CHECK cannot read
--      another table, so two BEFORE triggers enforce it: one on plan_slots (insert, or update of date or
--      plan_id) and one on plans (update of week_start_date while it has slots). Both raise 23514
--      (check_violation), like the CHECK they stand in for. Not a deferred constraint trigger: no app
--      flow moves a plan and its slots in the same transaction.
--   5. create_household_with_owner (0003, replaced by the signup trigger in 0006) is no longer
--      executable by public, anon or authenticated. Nothing in src/ calls it.
-- Does not redefine save_recipe or update_recipe (0011 does).
-- Live data had no violations of any rule on 2026-10-13. If that changed, the migration fails: the
-- CHECK and UNIQUE constraints validate existing rows, and the slot rule has an explicit check below.
-- Rollback: supabase/rollbacks/0013_schema_integrity.down.sql

-- ---------------------------------------------------------------------------
-- 1. Ingredient and step rows
-- ---------------------------------------------------------------------------

alter table public.recipe_ingredients
  add constraint recipe_ingredients_recipe_position_key unique (recipe_id, position),
  add constraint recipe_ingredients_position_nonnegative check (position >= 0),
  add constraint recipe_ingredients_amount_positive check (amount is null or amount > 0);

alter table public.recipe_steps
  add constraint recipe_steps_recipe_position_key unique (recipe_id, position),
  add constraint recipe_steps_position_nonnegative check (position >= 0),
  add constraint recipe_steps_text_not_blank check (text ~ '[^[:space:]]');

-- ---------------------------------------------------------------------------
-- 2. Account deletion
-- ---------------------------------------------------------------------------

alter table public.recipes alter column author_id drop not null;
alter table public.recipes drop constraint recipes_author_id_fkey;
alter table public.recipes
  add constraint recipes_author_id_fkey
  foreign key (author_id) references auth.users (id) on delete set null;

alter table public.share_tokens drop constraint share_tokens_created_by_fkey;
alter table public.share_tokens
  add constraint share_tokens_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. recipes.updated_at
-- ---------------------------------------------------------------------------

alter table public.recipes add column updated_at timestamptz;
update public.recipes set updated_at = created_at;
alter table public.recipes
  alter column updated_at set default now(),
  alter column updated_at set not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Only triggers call it.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Slot date inside its plan's week
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from public.plan_slots s
    join public.plans p on p.id = s.plan_id
    where s.date < p.week_start_date or s.date > p.week_start_date + 6
  ) then
    raise exception 'plan_slots has slots outside their plan week; fix them before applying 0013'
      using errcode = '23514';
  end if;
end $$;

-- security definer: the rule must not depend on whether RLS lets the caller see the plan.
create or replace function public.check_slot_date_in_week()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  week_start date;
begin
  select week_start_date into week_start from plans where id = new.plan_id;
  -- Unknown plan: the foreign key rejects the row.
  if week_start is not null and (new.date < week_start or new.date > week_start + 6) then
    raise exception 'slot date % is outside its plan week starting %', new.date, week_start
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.check_plan_week_keeps_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from plan_slots s
    where s.plan_id = new.id
      and (s.date < new.week_start_date or s.date > new.week_start_date + 6)
  ) then
    raise exception 'plan week % would leave slots outside it', new.week_start_date
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_slot_date_in_week() from public, anon, authenticated;
revoke execute on function public.check_plan_week_keeps_slots() from public, anon, authenticated;

create trigger plan_slots_date_in_week
  before insert or update of date, plan_id on public.plan_slots
  for each row execute function public.check_slot_date_in_week();

create trigger plans_week_keeps_slots
  before update of week_start_date on public.plans
  for each row execute function public.check_plan_week_keeps_slots();

-- ---------------------------------------------------------------------------
-- 5. Retire the signup RPC
-- ---------------------------------------------------------------------------

revoke execute on function public.create_household_with_owner(text) from public, anon, authenticated;
