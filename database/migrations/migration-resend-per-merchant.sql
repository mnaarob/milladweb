-- ============================================================
-- Per-merchant Resend configuration
-- Run in the Tech to Store Supabase SQL Editor
-- ============================================================

-- Store API keys in a SEPARATE table so they are never exposed
-- to the anon key. With RLS enabled and no SELECT policy,
-- only the service_role (edge functions) can read this table.

create table if not exists public.store_secrets (
    store_id       text primary key references public.stores(id) on delete cascade,
    resend_api_key text,              -- merchant's Resend API key
    from_email     text               -- e.g. orders@milladssupermarket.com
);

alter table public.store_secrets enable row level security;
-- No SELECT policy = anon key / logged-in users cannot read
-- Service role key (used by edge functions) bypasses RLS entirely

-- Store admins can update their own secrets via the TTS dashboard
-- (dashboard calls an edge function that uses the service role to write)
-- Keeping write policy locked down too for maximum safety:
drop policy if exists "store_secrets_admin_write" on public.store_secrets;
create policy "store_secrets_admin_write" on public.store_secrets
    for all using (public.is_store_admin(store_id));

-- Seed Millad's row (empty — merchant fills in from TTS dashboard)
insert into public.store_secrets (store_id, resend_api_key, from_email)
values ('millads', null, null)
on conflict (store_id) do nothing;
