-- ============================================================
-- Signup email codes
-- Run in the Supabase SQL Editor.
--
-- Creating an account emails a 6-digit code through Resend.
-- The account is created only after the code matches.
-- Sends are capped so a script cannot drain the Resend API:
--   one address: 1 per minute, 3 per hour
--   one browser: 5 per hour
--   one IP: 10 per hour
-- Five wrong codes burn that code. No public policies.
-- ============================================================

create table if not exists public.signup_challenges (
  email_key text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  updated_at timestamptz not null default now(),
  constraint signup_challenges_key check (email_key ~ '^email:[a-f0-9]{64}$'),
  constraint signup_challenges_hash check (code_hash ~ '^[a-f0-9]{64}$')
);

create table if not exists public.signup_send_guard (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0,
  last_sent_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint signup_send_guard_key check (key ~ '^(email|device|ip|flood):[a-f0-9]{64}$')
);

alter table public.signup_challenges enable row level security;
alter table public.signup_send_guard enable row level security;

revoke all on table public.signup_challenges from public, anon, authenticated;
revoke all on table public.signup_send_guard from public, anon, authenticated;
grant select, insert, update, delete on table public.signup_challenges to service_role;
grant select, insert, update, delete on table public.signup_send_guard to service_role;

create or replace function public.signup_email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = auth, public
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(btrim(p_email))
  );
$$;

create or replace function public.signup_prepare_send(
  p_email_key text,
  p_device_key text,
  p_ip_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  rec record;
  r public.signup_send_guard%rowtype;
  v_hits int;
  v_window timestamptz;
  retry_minutes int;
  worst int := 0;
  blocked boolean := false;
begin
  if p_email_key is null or p_email_key !~ '^email:[a-f0-9]{64}$'
     or p_device_key is null or p_device_key !~ '^device:[a-f0-9]{64}$'
     or p_ip_key is null or p_ip_key !~ '^ip:[a-f0-9]{64}$' then
    raise exception 'invalid signup key';
  end if;

  for rec in
    select key
    from (values (p_email_key), (p_device_key), (p_ip_key)) as v(key)
    order by key
  loop
    perform pg_advisory_xact_lock(hashtext(rec.key)::bigint);
  end loop;

  for rec in
    select key, max_hits, is_email
    from (values
      (p_email_key, 3, true),
      (p_device_key, 5, false),
      (p_ip_key, 10, false)
    ) as v(key, max_hits, is_email)
  loop
    select * into r from public.signup_send_guard where key = rec.key;
    if not found then
      v_hits := 0;
    elsif now_ts - r.window_start >= interval '1 hour' then
      v_hits := 0;
    else
      v_hits := r.hits;
      v_window := r.window_start;
    end if;

    if found and rec.is_email and r.last_sent_at is not null
       and now_ts - r.last_sent_at < interval '60 seconds' then
      blocked := true;
      worst := greatest(worst, 1);
    elsif v_hits >= rec.max_hits then
      retry_minutes := ceil(extract(epoch from (v_window + interval '1 hour' - now_ts)) / 60.0)::int;
      if retry_minutes < 1 then
        retry_minutes := 1;
      end if;
      blocked := true;
      worst := greatest(worst, retry_minutes);
    end if;
  end loop;

  if blocked then
    return jsonb_build_object('allowed', false, 'retry_minutes', greatest(worst, 1));
  end if;

  for rec in
    select key, is_email
    from (values
      (p_email_key, true),
      (p_device_key, false),
      (p_ip_key, false)
    ) as v(key, is_email)
  loop
    select * into r from public.signup_send_guard where key = rec.key for update;
    if not found then
      insert into public.signup_send_guard (key, window_start, hits, last_sent_at)
      values (
        rec.key,
        now_ts,
        1,
        case when rec.is_email then now_ts else null end
      );
    elsif now_ts - r.window_start >= interval '1 hour' then
      insert into public.signup_send_guard (key, window_start, hits, last_sent_at)
      values (
        rec.key,
        now_ts,
        1,
        case when rec.is_email then now_ts else null end
      )
      on conflict (key) do update set
        window_start = now_ts,
        hits = 1,
        last_sent_at = case when rec.is_email then now_ts else public.signup_send_guard.last_sent_at end,
        updated_at = now_ts;
    else
      update public.signup_send_guard set
        hits = hits + 1,
        last_sent_at = case when rec.is_email then now_ts else last_sent_at end,
        updated_at = now_ts
      where key = rec.key;
    end if;
  end loop;

  return jsonb_build_object('allowed', true);
end;
$$;

-- Caps code guesses that do not send mail.
create or replace function public.signup_prepare_verify(p_flood_key text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  flood public.signup_send_guard%rowtype;
  retry_minutes int;
begin
  if p_flood_key is null or p_flood_key !~ '^flood:[a-f0-9]{64}$' then
    raise exception 'invalid flood key';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_flood_key)::bigint);

  insert into public.signup_send_guard as g (key, window_start, hits)
  values (p_flood_key, now_ts, 1)
  on conflict (key) do update set
    hits = case
      when now_ts - g.window_start >= interval '10 minutes' then 1
      else g.hits + 1
    end,
    window_start = case
      when now_ts - g.window_start >= interval '10 minutes' then now_ts
      else g.window_start
    end,
    updated_at = now_ts
  returning * into flood;

  if flood.hits > 30 then
    retry_minutes := ceil(extract(epoch from (flood.window_start + interval '10 minutes' - now_ts)) / 60.0)::int;
    if retry_minutes < 1 then
      retry_minutes := 1;
    end if;
    return jsonb_build_object('allowed', false, 'retry_minutes', retry_minutes);
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

create or replace function public.signup_put_code(p_email_key text, p_code_hash text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_email_key is null or p_email_key !~ '^email:[a-f0-9]{64}$'
     or p_code_hash is null or p_code_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid signup code';
  end if;

  insert into public.signup_challenges (email_key, code_hash, expires_at, attempts)
  values (p_email_key, p_code_hash, now() + interval '15 minutes', 0)
  on conflict (email_key) do update set
    code_hash = excluded.code_hash,
    expires_at = excluded.expires_at,
    attempts = 0,
    updated_at = now();
end;
$$;

create or replace function public.signup_check_code(p_email_key text, p_code_hash text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  r public.signup_challenges%rowtype;
begin
  if p_email_key is null or p_email_key !~ '^email:[a-f0-9]{64}$'
     or p_code_hash is null or p_code_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid signup code';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_email_key)::bigint);
  select * into r from public.signup_challenges where email_key = p_email_key for update;

  if not found or r.expires_at <= now() then
    delete from public.signup_challenges where email_key = p_email_key;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if r.code_hash is distinct from p_code_hash then
    if r.attempts + 1 >= 5 then
      delete from public.signup_challenges where email_key = p_email_key;
      return jsonb_build_object('ok', false, 'reason', 'locked');
    end if;
    update public.signup_challenges
      set attempts = attempts + 1, updated_at = now()
      where email_key = p_email_key;
    return jsonb_build_object('ok', false, 'reason', 'mismatch');
  end if;

  delete from public.signup_challenges where email_key = p_email_key;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.signup_delete_code(p_email_key text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_email_key is null or p_email_key !~ '^email:[a-f0-9]{64}$' then
    raise exception 'invalid signup key';
  end if;
  delete from public.signup_challenges where email_key = p_email_key;
end;
$$;

revoke all on function public.signup_email_exists(text) from public, anon, authenticated;
revoke all on function public.signup_prepare_send(text, text, text) from public, anon, authenticated;
revoke all on function public.signup_prepare_verify(text) from public, anon, authenticated;
revoke all on function public.signup_put_code(text, text) from public, anon, authenticated;
revoke all on function public.signup_check_code(text, text) from public, anon, authenticated;
revoke all on function public.signup_delete_code(text) from public, anon, authenticated;

grant execute on function public.signup_email_exists(text) to service_role;
grant execute on function public.signup_prepare_send(text, text, text) to service_role;
grant execute on function public.signup_prepare_verify(text) to service_role;
grant execute on function public.signup_put_code(text, text) to service_role;
grant execute on function public.signup_check_code(text, text) to service_role;
grant execute on function public.signup_delete_code(text) to service_role;
