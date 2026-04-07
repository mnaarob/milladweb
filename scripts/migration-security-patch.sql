-- ============================================================
-- Security Patch: Fix the two multi-tenant security gaps
-- Run in the Tech to Store Supabase SQL Editor
-- ============================================================


-- ============================================================
-- GAP 1 FIX: Validate store_id on order insert
--
-- Before: for insert with check (true)  ← anyone could set
--         store_id to any value, polluting other stores' data
-- After:  store_id must exist in the stores table
-- ============================================================

drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert" on public.orders
    for insert with check (
        store_id is not null
        and exists (select 1 from public.stores where id = store_id)
    );


-- ============================================================
-- GAP 2 FIX: JWT custom claims
--
-- Embeds store_id and store_role into the Supabase JWT token
-- at login time so the dashboard reads it from the token
-- (cryptographically signed) rather than a DB query.
--
-- After creating this function, register it in:
--   Supabase Dashboard → Authentication → Hooks
--   → "Custom Access Token" hook → select this function
-- ============================================================

create or replace function public.custom_jwt_claims(event jsonb)
returns jsonb as $$
declare
    claims      jsonb;
    v_store_id  text;
    v_role      text;
begin
    -- Look up the user's store assignment
    select sa.store_id, sa.role
    into v_store_id, v_role
    from public.store_admins sa
    where sa.user_id = (event->>'user_id')::uuid
    limit 1;

    claims := event->'claims';

    if v_store_id is not null then
        claims := jsonb_set(claims, '{store_id}',   to_jsonb(v_store_id));
        claims := jsonb_set(claims, '{store_role}', to_jsonb(v_role));
    end if;

    -- Super admins get a flag in their token too
    if exists (
        select 1 from public.super_admins
        where user_id = (event->>'user_id')::uuid
    ) then
        claims := jsonb_set(claims, '{is_super_admin}', 'true'::jsonb);
    end if;

    return jsonb_set(event, '{claims}', claims);
end;
$$ language plpgsql security definer;

-- Grant Supabase Auth the ability to call this function
grant execute on function public.custom_jwt_claims(jsonb) to supabase_auth_admin;
