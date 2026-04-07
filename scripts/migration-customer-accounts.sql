-- Migration: Customer Accounts & Order History
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor) after the main schema.
-- Required for: account.html, order history, checkout pre-fill for logged-in users.

-- Add user_id to orders (nullable for guest checkout)
alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_orders_user_id on public.orders(user_id);

-- RLS: customers can read their own orders
create policy "orders_customer_read" on public.orders
  for select using (auth.uid() = user_id);
