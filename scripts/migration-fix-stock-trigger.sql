-- Fix: cast item->>'id' (text) to uuid for products.id comparison,
-- and populate organization_id from the stores table (NOT NULL column).

create or replace function public.record_stock_movements_on_order()
returns trigger as $$
declare
    item       jsonb;
    qty        int;
    pid        uuid;
    org_id     uuid;
begin
    -- Look up the store's organization_id once per order
    select organization_id into org_id
    from public.stores
    where id = new.store_id;

    for item in select * from jsonb_array_elements(new.items)
    loop
        pid := (item->>'id')::uuid;
        qty := coalesce((item->>'quantity')::int, 0);

        if qty > 0 and pid is not null then
            if exists (
                select 1 from public.products
                where id = pid
                  and store_id = new.store_id
                  and stock_managed = true
            ) then
                insert into public.stock_movements
                    (product_id, quantity, type, note, store_id, order_id, organization_id)
                values
                    (pid, -qty, 'sale',
                     'Website order #' || new.id::text,
                     new.store_id, new.id, org_id);
            end if;
        end if;
    end loop;

    return new;
end;
$$ language plpgsql security definer;
