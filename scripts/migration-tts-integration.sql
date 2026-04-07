-- ============================================================
-- Tech to Store — Multi-Tenant Integration Migration
-- Run this in the Tech to Store Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query)
--
-- Existing tables found: products, categories, stock_movements
-- Their schema: 
--   products(id, name, price, category_id, sku, quantity, updated_at, created_at)
--   categories(id, name)
--   stock_movements(id, product_id, quantity, type, note, created_at)
--
-- This migration:
--   1. Creates new tables: stores, store_admins, super_admins, orders
--   2. Extends existing tables with missing columns
--   3. Adds triggers for stock sync + order recording
--   4. Sets up RLS
-- ============================================================


-- ============================================================
-- STEP 1: New tables (do not exist yet)
-- ============================================================

create table if not exists public.stores (
    id          text primary key,
    name        text not null,
    domain      text,
    theme       jsonb default '{}',
    plan        text default 'basic',
    created_at  timestamptz default now()
);

create table if not exists public.store_admins (
    user_id   uuid references auth.users(id) on delete cascade,
    store_id  text references public.stores(id) on delete cascade,
    role      text default 'owner',
    primary key (user_id, store_id)
);

create table if not exists public.super_admins (
    user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.orders (
    id              uuid primary key default gen_random_uuid(),
    store_id        text not null references public.stores(id) on delete cascade,
    user_id         uuid references auth.users(id) on delete set null,
    customer        jsonb not null default '{}',
    items           jsonb not null default '[]',
    pricing         jsonb not null default '{}',
    payment_method  text,
    payment_token   text,
    status          text not null default 'pending',
    created_at      timestamptz default now()
);

-- ============================================================
-- STEP 2: Extend existing tables with missing columns
--         All safe — ADD COLUMN IF NOT EXISTS does nothing
--         if the column already exists.
-- ============================================================

-- products: add store_id and website-specific display fields
alter table public.products add column if not exists store_id          text references public.stores(id);
alter table public.products add column if not exists in_stock          boolean not null default true;
alter table public.products add column if not exists featured          boolean not null default false;
alter table public.products add column if not exists unit              text default 'each';
alter table public.products add column if not exists description       text default '';
alter table public.products add column if not exists image             text default '';
alter table public.products add column if not exists fallback_emoji    text default '🛒';
alter table public.products add column if not exists subcategory       text;
alter table public.products add column if not exists sort_order        int default 9999;
alter table public.products add column if not exists variable_weight   boolean default false;
alter table public.products add column if not exists display_price     text;
alter table public.products add column if not exists estimated_max_weight numeric(10,2);
alter table public.products add column if not exists image_width       int;
alter table public.products add column if not exists image_height      int;
-- stock_managed: false = website sales don't decrement this item (e.g. variable-weight meat)
alter table public.products add column if not exists stock_managed     boolean not null default true;
-- category: text slug for website filtering (e.g. 'meat', 'dairy') — separate from category_id UUID FK
alter table public.products add column if not exists category          text;

-- categories: add store_id and display fields
alter table public.categories add column if not exists store_id    text references public.stores(id);
alter table public.categories add column if not exists icon        text default '';
alter table public.categories add column if not exists sort_order  int default 0;

-- stock_movements: add store_id and order reference
alter table public.stock_movements add column if not exists store_id  text references public.stores(id);
alter table public.stock_movements add column if not exists order_id  uuid references public.orders(id) on delete set null;

-- ============================================================
-- STEP 3: Indexes
-- ============================================================

create index if not exists idx_products_store_id       on public.products(store_id);
create index if not exists idx_products_in_stock       on public.products(in_stock);
create index if not exists idx_products_featured       on public.products(featured);
create index if not exists idx_categories_store_id     on public.categories(store_id);
create index if not exists idx_orders_store_id         on public.orders(store_id);
create index if not exists idx_orders_user_id          on public.orders(user_id);
create index if not exists idx_orders_status           on public.orders(status);
create index if not exists idx_orders_created          on public.orders(created_at desc);
create index if not exists idx_stock_movements_store   on public.stock_movements(store_id);
create index if not exists idx_stock_movements_product on public.stock_movements(product_id);

-- ============================================================
-- STEP 4: Helper functions
-- ============================================================

create or replace function public.is_super_admin()
returns boolean as $$
begin
    return exists (
        select 1 from public.super_admins where user_id = auth.uid()
    );
end;
$$ language plpgsql security definer;

create or replace function public.is_store_admin(sid text)
returns boolean as $$
begin
    return public.is_super_admin()
        or exists (
            select 1 from public.store_admins
            where user_id = auth.uid() and store_id = sid
        );
end;
$$ language plpgsql security definer;

-- ============================================================
-- STEP 5: Stock sync trigger on stock_movements
--
--   When any stock_movement is inserted, update the product's
--   cached quantity and in_stock flag.
--   - Positive quantity = stock coming IN  (purchase/adjustment)
--   - Negative quantity = stock going OUT  (sale/loss)
-- ============================================================

create or replace function public.sync_product_stock_from_movement()
returns trigger as $$
begin
    update public.products
    set
        quantity = greatest(quantity + new.quantity, 0),
        in_stock = (greatest(quantity + new.quantity, 0) > 0),
        updated_at = now()
    where id = new.product_id;

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_stock_from_movement on public.stock_movements;
create trigger trg_sync_stock_from_movement
    after insert on public.stock_movements
    for each row execute function public.sync_product_stock_from_movement();

-- ============================================================
-- STEP 6: Order trigger — when a website order is placed,
--         insert a stock_movement record for each item
--         (type='sale', negative quantity).
--         This keeps the inventory dashboard in sync.
-- ============================================================

create or replace function public.record_stock_movements_on_order()
returns trigger as $$
declare
    item       jsonb;
    qty        int;
    pid        uuid;
begin
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
                    (product_id, quantity, type, note, store_id, order_id)
                values
                    (pid, -qty, 'sale',
                     'Website order #' || new.id::text,
                     new.store_id, new.id);
            end if;
        end if;
    end loop;

    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_record_stock_on_order on public.orders;
create trigger trg_record_stock_on_order
    after insert on public.orders
    for each row execute function public.record_stock_movements_on_order();

-- ============================================================
-- STEP 7: Enable Row Level Security
-- ============================================================

alter table public.stores         enable row level security;
alter table public.store_admins   enable row level security;
alter table public.super_admins   enable row level security;
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.orders         enable row level security;
alter table public.stock_movements enable row level security;

-- ============================================================
-- STEP 8: RLS Policies
-- ============================================================

-- Stores: public read (website loads branding), super admin write
drop policy if exists "stores_public_read"        on public.stores;
create policy "stores_public_read"        on public.stores for select using (true);
drop policy if exists "stores_super_write"        on public.stores;
create policy "stores_super_write"        on public.stores for all using (public.is_super_admin());

-- Store admins: self-read, super admin full access
drop policy if exists "store_admins_read"         on public.store_admins;
create policy "store_admins_read"         on public.store_admins
    for select using (user_id = auth.uid() or public.is_super_admin());
drop policy if exists "store_admins_write"        on public.store_admins;
create policy "store_admins_write"        on public.store_admins for all using (public.is_super_admin());

-- Super admins: self-read only
drop policy if exists "super_admins_self_read"    on public.super_admins;
create policy "super_admins_self_read"    on public.super_admins for select using (user_id = auth.uid());

-- Categories: public read, store admin write
drop policy if exists "categories_public_read"    on public.categories;
create policy "categories_public_read"    on public.categories for select using (true);
drop policy if exists "categories_store_write"    on public.categories;
create policy "categories_store_write"    on public.categories
    for all using (public.is_store_admin(store_id));

-- Products: public read, store admin write
drop policy if exists "products_public_read"      on public.products;
create policy "products_public_read"      on public.products for select using (true);
drop policy if exists "products_store_write"      on public.products;
create policy "products_store_write"      on public.products
    for all using (public.is_store_admin(store_id));

-- Orders: anyone can insert; store admin or ordering customer can read
drop policy if exists "orders_public_insert"      on public.orders;
create policy "orders_public_insert"      on public.orders for insert with check (true);
drop policy if exists "orders_store_read"         on public.orders;
create policy "orders_store_read"         on public.orders
    for select using (public.is_store_admin(store_id) or auth.uid() = user_id);
drop policy if exists "orders_store_update"       on public.orders;
create policy "orders_store_update"       on public.orders
    for update using (public.is_store_admin(store_id));

-- Stock movements: store admin reads their store; trigger (security definer) can insert
drop policy if exists "stock_movements_store_read" on public.stock_movements;
create policy "stock_movements_store_read" on public.stock_movements
    for select using (public.is_store_admin(store_id));
drop policy if exists "stock_movements_store_write" on public.stock_movements;
create policy "stock_movements_store_write" on public.stock_movements
    for all using (public.is_store_admin(store_id));

-- ============================================================
-- STEP 9: Seed Millad's store record
-- ============================================================

insert into public.stores (id, name, domain, theme, plan)
values (
    'millads',
    'Millad''s Supermarket',
    'milladssupermarket.com',
    '{"primaryColor": "#2D6A4F", "storeName": "Millad''s Supermarket"}',
    'basic'
)
on conflict (id) do nothing;

-- ============================================================
-- STEP 10: Backfill store_id on existing rows
--          Assigns all unassigned data to Millad's store.
-- ============================================================

update public.products        set store_id = 'millads' where store_id is null;
update public.categories      set store_id = 'millads' where store_id is null;
update public.stock_movements set store_id = 'millads' where store_id is null;

-- Sync in_stock on existing products based on current quantity
update public.products
set in_stock = (quantity > 0)
where store_id = 'millads';
