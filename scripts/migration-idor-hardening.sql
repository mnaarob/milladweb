-- ============================================================
-- IDOR Hardening Migration
-- Run in the Supabase SQL Editor after all prior migrations.
--
-- Fixes:
--   1. Remove anon-facing INSERT policy on orders (orders must
--      go through the place-order Edge Function, which uses the
--      service role and bypasses RLS).
--   2. Prevent cross-tenant stock corruption by adding a
--      store_id match to sync_product_stock_from_movement.
--   3. Make custom_jwt_claims deterministic for multi-store admins.
-- ============================================================


-- ============================================================
-- FIX 1: Remove the permissive orders INSERT policy
--
-- Before: any holder of the anon key could insert an order for
--         any valid store_id, triggering stock decrements via
--         trg_record_stock_on_order — no auth required.
-- After:  no anon/authenticated INSERT policy exists. Orders
--         can only be inserted by the service role (Edge Function).
-- ============================================================

drop policy if exists "orders_public_insert" on public.orders;


-- ============================================================
-- FIX 2: Prevent cross-tenant stock corruption
--
-- Before: sync_product_stock_from_movement updated products
--         matching product_id only — a store admin could insert
--         a stock_movement for their store referencing a product
--         owned by another store, and the SECURITY DEFINER
--         trigger would corrupt the other store's inventory.
-- After:  the trigger requires both product_id AND store_id to
--         match, so movements can only affect products within
--         the same tenant.
-- ============================================================

create or replace function public.sync_product_stock_from_movement()
returns trigger as $$
begin
    update public.products
    set
        quantity = greatest(quantity + new.quantity, 0),
        in_stock = (greatest(quantity + new.quantity, 0) > 0),
        updated_at = now()
    where id = new.product_id
      and store_id = new.store_id;

    return new;
end;
$$ language plpgsql security definer;


-- ============================================================
-- FIX 3: Make custom_jwt_claims deterministic
--
-- Before: LIMIT 1 without ORDER BY meant a multi-store admin
--         got a nondeterministic store_id in their JWT.
-- After:  ORDER BY role priority (owner > manager > staff),
--         then store_id for full determinism.
-- ============================================================

create or replace function public.custom_jwt_claims(event jsonb)
returns jsonb as $$
declare
    claims      jsonb;
    v_store_id  text;
    v_role      text;
begin
    select sa.store_id, sa.role
    into v_store_id, v_role
    from public.store_admins sa
    where sa.user_id = (event->>'user_id')::uuid
    order by
        case sa.role
            when 'owner'   then 1
            when 'manager' then 2
            when 'staff'   then 3
            else 4
        end,
        sa.store_id
    limit 1;

    claims := event->'claims';

    if v_store_id is not null then
        claims := jsonb_set(claims, '{store_id}',   to_jsonb(v_store_id));
        claims := jsonb_set(claims, '{store_role}', to_jsonb(v_role));
    end if;

    if exists (
        select 1 from public.super_admins
        where user_id = (event->>'user_id')::uuid
    ) then
        claims := jsonb_set(claims, '{is_super_admin}', 'true'::jsonb);
    end if;

    return jsonb_set(event, '{claims}', claims);
end;
$$ language plpgsql security definer;

grant execute on function public.custom_jwt_claims(jsonb) to supabase_auth_admin;
