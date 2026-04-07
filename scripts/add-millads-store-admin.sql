-- ============================================================
-- Millad's Supermarket — grant store dashboard access
-- ============================================================
-- The admin panel (admin.html / /admin) checks Supabase Auth plus
-- `store_admins` for store_id = 'millads' (see js/config/supabase.js).
--
-- BEFORE YOU RUN THIS:
--   1. Supabase Dashboard → Authentication → Users
--   2. Either invite/add the person so they already have an account,
--      or ask them to sign up on the main site first (same email).
--
-- THEN:
--   1. Replace the email below with the admin's exact login email.
--   2. Paste into SQL Editor and Run.
--
-- Role: 'owner' or 'staff' (both can use the dashboard; adjust if you use roles elsewhere).
-- ============================================================

-- Option A — by email (recommended): user must already exist in Auth
insert into public.store_admins (store_id, user_id, role)
select 'millads', id, 'staff'
from auth.users
where email = lower(trim('REPLACE_WITH_ADMIN_EMAIL@example.com'))
on conflict (store_id, user_id) do update
    set role = excluded.role;

-- Option B — by user UUID (if you copied it from Authentication → Users)
-- insert into public.store_admins (store_id, user_id, role)
-- values ('millads', 'PASTE-UUID-HERE'::uuid, 'staff')
-- on conflict (store_id, user_id) do update
--     set role = excluded.role;

-- Verify (optional): list admins for this store
-- select sa.user_id, u.email, sa.role
-- from public.store_admins sa
-- join auth.users u on u.id = sa.user_id
-- where sa.store_id = 'millads';
