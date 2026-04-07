-- ============================================================
-- TECH TO STORE — New Merchant Onboarding Template
-- ============================================================
-- HOW TO USE:
--   1. Supabase Dashboard → Authentication → Users → "Invite a User"
--      Enter the store owner's email address and click Send Invite.
--   2. Once the invite is sent, click the new user's row in the Users
--      table and copy their UUID (looks like: a1b2c3d4-...).
--   3. Fill in the five variables in the CONFIGURATION block below.
--   4. Paste this entire file into the SQL Editor and click Run.
--   5. The owner will receive their invite email. From that point they
--      can invite their own employees via the TTS dashboard — no more
--      SQL needed for that store.
-- ============================================================


-- ============================================================
-- CONFIGURATION — fill these in before running
-- ============================================================

\set store_id      'STORE_SLUG'          -- e.g. freshmart       (lowercase, no spaces)
\set store_name    'STORE DISPLAY NAME'  -- e.g. Fresh Mart
\set resend_key    'RESEND_API_KEY'      -- from merchant's Resend account
\set from_email    'FROM_EMAIL_ADDRESS'  -- e.g. orders@freshmart.com
\set owner_uuid    'OWNER_USER_UUID'     -- UUID copied from Supabase Auth Users table

-- ============================================================


-- 1. Register the store
insert into public.stores (id, name)
values (:'store_id', :'store_name')
on conflict (id) do update
    set name = excluded.name;


-- 2. Store the merchant's Resend credentials (hidden from anon key)
insert into public.store_secrets (store_id, resend_api_key, from_email)
values (:'store_id', :'resend_key', :'from_email')
on conflict (store_id) do update
    set resend_api_key = excluded.resend_api_key,
        from_email     = excluded.from_email;


-- 3. Link the invited owner to this store
insert into public.store_admins (store_id, user_id, role)
values (:'store_id', :'owner_uuid'::uuid, 'owner')
on conflict (store_id, user_id) do update
    set role = excluded.role;


-- ============================================================
-- VERIFY — run this after the block above to confirm everything
-- ============================================================
select
    s.id          as store_id,
    s.name        as store_name,
    ss.from_email,
    ss.resend_api_key is not null as has_resend_key,
    sa.user_id    as owner_user_id,
    sa.role       as owner_role
from public.stores s
left join public.store_secrets  ss on ss.store_id = s.id
left join public.store_admins   sa on sa.store_id = s.id and sa.role = 'owner'
where s.id = :'store_id';
