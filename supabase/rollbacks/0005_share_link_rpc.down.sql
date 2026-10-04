-- Manual rollback for migrations/0005_share_link_rpc.sql.
-- Not picked up by `supabase db push` (outside supabase/migrations).
-- Restores the 0001/0002 share policies exactly, including the token
-- enumeration hole. Roll back the app code first: the old share page reads
-- share_tokens directly and needs these policies.
-- Deleted empty non-Monday plans (and their tokens) are not restored.
-- Run in the SQL editor, then: supabase migration repair --status reverted 0005

begin;

alter table plans drop constraint plans_week_start_monday;

drop policy st_select on share_tokens;
create policy st_select on share_tokens for select using (true);

create policy plans_select_via_share_token on plans for select using (
  exists (select 1 from share_tokens st where st.plan_id = plans.id)
);
create policy plan_slots_select_via_share_token on plan_slots for select using (
  exists (select 1 from share_tokens st where st.plan_id = plan_slots.plan_id)
);
create policy recipes_select_via_share_token on recipes for select using (
  exists (
    select 1 from plan_slots ps
    join share_tokens st on st.plan_id = ps.plan_id
    where ps.recipe_id = recipes.id
  )
);

drop function public.get_shared_plan(text);

commit;
