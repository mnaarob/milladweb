-- Supabase schema for Millad's Supermarket
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.categories (
  id text primary key,
  name text not null,
  icon text default '',
  sort_order int default 0
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null references public.categories(id),
  price numeric(10,2) not null default 0,
  unit text default 'each',
  description text default '',
  image text default '',
  fallback_emoji text default '🛒',
  in_stock boolean default true,
  featured boolean default false,
  subcategory text,
  sort_order int default 9999,
  variable_weight boolean default false,
  display_price text,
  estimated_max_weight numeric(10,2),
  image_width int,
  image_height int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer jsonb not null default '{}',
  items jsonb not null default '[]',
  pricing jsonb not null default '{}',
  payment_method text,
  payment_token text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Index for common queries
create index if not exists idx_products_in_stock on public.products(in_stock);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_featured on public.products(featured);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created on public.orders(created_at desc);

-- Auto-update updated_at on products
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.set_updated_at();

-- ============================================================
-- Admin helper function
-- ============================================================

create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.admin_users enable row level security;

-- Categories: public read, admin write
create policy "categories_public_read" on public.categories
  for select using (true);

create policy "categories_admin_insert" on public.categories
  for insert with check (public.is_admin());

create policy "categories_admin_update" on public.categories
  for update using (public.is_admin());

create policy "categories_admin_delete" on public.categories
  for delete using (public.is_admin());

-- Products: public read, admin write
create policy "products_public_read" on public.products
  for select using (true);

create policy "products_admin_insert" on public.products
  for insert with check (public.is_admin());

create policy "products_admin_update" on public.products
  for update using (public.is_admin());

create policy "products_admin_delete" on public.products
  for delete using (public.is_admin());

-- Orders: anyone can insert, admin read/update
create policy "orders_public_insert" on public.orders
  for insert with check (true);

create policy "orders_admin_read" on public.orders
  for select using (public.is_admin());

create policy "orders_admin_update" on public.orders
  for update using (public.is_admin());

-- Admin users: only admins can read
create policy "admin_users_self_read" on public.admin_users
  for select using (auth.uid() = user_id);
