-- Manual rollback for migrations/0009_update_recipe_rpc.sql.
-- Not picked up by `supabase db push` (outside supabase/migrations).
-- Roll back the app code first (PUT /api/recipes/[id] calls update_recipe).
-- Drops only the function; no data changes. Run in the SQL editor, then: supabase migration repair --status reverted 0009

begin;

drop function if exists public.update_recipe(uuid, jsonb);

commit;
