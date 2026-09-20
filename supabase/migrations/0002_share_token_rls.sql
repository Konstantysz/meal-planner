-- Allow anonymous read access to a plan (and its slots/recipes) when a
-- valid share_tokens row references it. Narrow, select-only, additive
-- policies alongside the existing member-only `for all` policies (RLS
-- policies for the same command are OR'd together).

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
