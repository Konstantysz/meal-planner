-- Share links through a token-checked RPC instead of open table reads.
--
-- Before: st_select using (true) let anyone list every token, and the three
-- *_select_via_share_token policies let anyone read every plan that had *some*
-- token, plus its slots and recipes, without knowing the token.
-- After: anon has no table access for sharing. get_shared_plan(token) returns
-- only the plan that token unlocks, and only the fields the share page shows.
--
-- Also fixes the data left by the settings-page bug (it shared a plan keyed by
-- today's date instead of the week's Monday) and prevents it from recurring.
--
-- Requires app code that calls get_shared_plan (same PR).
-- Rollback: supabase/rollbacks/0005_share_link_rpc.down.sql

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

create or replace function public.get_shared_plan(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'week_start_date', p.week_start_date,
    'slots', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'date', s.date,
          'position', s.position,
          'label', s.label,
          'servings', s.servings,
          'recipe', case when r.id is null then null else jsonb_build_object('name', r.name) end
        )
        order by s.date, s.position
      )
      from plan_slots s
      left join recipes r on r.id = s.recipe_id
      where s.plan_id = p.id
    ), '[]'::jsonb)
  )
  from share_tokens st
  join plans p on p.id = st.plan_id
  where st.token = p_token;
$$;

revoke execute on function public.get_shared_plan(text) from public;
grant execute on function public.get_shared_plan(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy plans_select_via_share_token on plans;
drop policy plan_slots_select_via_share_token on plan_slots;
drop policy recipes_select_via_share_token on recipes;

-- Creators can still list their own tokens (e.g. a future revoke UI).
drop policy st_select on share_tokens;
create policy st_select on share_tokens for select to authenticated
  using (created_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Data cleanup (destructive, scoped): empty plans keyed by a non-Monday date.
-- Only the settings bug creates these; plans with slots are never deleted.
-- Their share_tokens rows go with them (on delete cascade). Not restorable by
-- the rollback, but they hold no slots, only links to an empty week.
-- ---------------------------------------------------------------------------

delete from plans p
where extract(isodow from p.week_start_date) <> 1
  and not exists (select 1 from plan_slots s where s.plan_id = p.id);

-- Fails the deploy, on purpose, if a non-Monday plan with slots exists:
-- that needs a manual merge into the Monday plan, not a silent delete.
alter table plans
  add constraint plans_week_start_monday check (extract(isodow from week_start_date) = 1);
