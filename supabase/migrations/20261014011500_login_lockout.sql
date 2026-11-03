-- ============================================================
-- Sign-in lockout
-- Run in the Supabase SQL Editor.
--
-- Customer and admin sign-in share one ladder, stored here so it
-- survives new edge-function instances:
--   4 wrong passwords  -> 10 minutes
--   next 4             -> 30 minutes
--   every further 4    -> 60 minutes
--
-- Email and browser keys use 4. The IP key uses 12 so one shared
-- network is not locked after a few typos. A separate flood key
-- caps an address at 20 sign-in requests per 10 minutes.
--
-- Row level security is on and there are no policies. Only the
-- service role, which bypasses RLS, can touch the table. The
-- functions below are revoked from anon and authenticated.
-- ============================================================

create table if not exists public.login_guard (
  key text primary key,
  fail_count int not null default 0,
  tier int not null default 0,
  locked_until timestamptz,
  last_failure_at timestamptz,
  window_start timestamptz,
  request_count int not null default 0,
  updated_at timestamptz not null default now(),
  constraint login_guard_key_format check (key ~ '^(email|device|ip|flood):[a-f0-9]{64}$')
);

alter table public.login_guard enable row level security;

revoke all on table public.login_guard from public, anon, authenticated;
grant select, insert, update, delete on table public.login_guard to service_role;

-- Counts one sign-in request against the 20 / 10 minute flood cap.
create or replace function public.login_guard_note_request(p_flood_key text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  flood public.login_guard%rowtype;
  retry_minutes int;
begin
  if p_flood_key is null or p_flood_key !~ '^flood:[a-f0-9]{64}$' then
    raise exception 'invalid flood key';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_flood_key)::bigint);

  insert into public.login_guard as g (key, window_start, request_count)
  values (p_flood_key, now_ts, 1)
  on conflict (key) do update set
    request_count = case
      when g.window_start is null
        or now_ts - g.window_start >= interval '10 minutes'
      then 1
      else g.request_count + 1
    end,
    window_start = case
      when g.window_start is null
        or now_ts - g.window_start >= interval '10 minutes'
      then now_ts
      else g.window_start
    end,
    updated_at = now_ts
  returning * into flood;

  if flood.request_count > 20 then
    retry_minutes := ceil(
      extract(epoch from (flood.window_start + interval '10 minutes' - now_ts)) / 60.0
    )::int;
    if retry_minutes < 1 then
      retry_minutes := 1;
    end if;
    return jsonb_build_object('limited', true, 'retry_minutes', retry_minutes);
  end if;

  return jsonb_build_object('limited', false);
end;
$$;

-- Rejects the attempt when the email, browser, or IP is locked.
-- Always counts the request toward the flood cap.
create or replace function public.login_guard_begin(
  p_email_key text,
  p_device_key text,
  p_ip_key text,
  p_flood_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  flood jsonb;
  rec record;
  minutes_left int := 0;
  wait_mins int;
begin
  if p_email_key is null or p_email_key !~ '^email:[a-f0-9]{64}$'
     or p_device_key is null or p_device_key !~ '^device:[a-f0-9]{64}$'
     or p_ip_key is null or p_ip_key !~ '^ip:[a-f0-9]{64}$' then
    raise exception 'invalid guard key';
  end if;

  flood := public.login_guard_note_request(p_flood_key);

  for rec in
    select locked_until
    from public.login_guard
    where key in (p_email_key, p_device_key, p_ip_key)
      and locked_until is not null
      and locked_until > now_ts
  loop
    wait_mins := ceil(extract(epoch from (rec.locked_until - now_ts)) / 60.0)::int;
    if wait_mins < 1 then
      wait_mins := 1;
    end if;
    if wait_mins > minutes_left then
      minutes_left := wait_mins;
    end if;
  end loop;

  if minutes_left > 0 then
    return jsonb_build_object('allowed', false, 'reason', 'locked', 'retry_minutes', minutes_left);
  end if;

  if coalesce((flood->>'limited')::boolean, false) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'flood',
      'retry_minutes', greatest(coalesce((flood->>'retry_minutes')::int, 1), 1)
    );
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

-- Records one wrong password. An unfinished streak older than 15 minutes
-- starts over. 24 hours with no failures drops the ladder back to 10 minutes.
create or replace function public.login_guard_apply_failure(p_key text, p_threshold int)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  r public.login_guard%rowtype;
  v_tier int;
  v_fail int;
  v_lock_minutes int;
begin
  if p_key is null or p_key !~ '^(email|device|ip):[a-f0-9]{64}$' then
    raise exception 'invalid guard key';
  end if;
  if p_threshold is null or p_threshold < 1 or p_threshold > 100 then
    raise exception 'invalid threshold';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_key)::bigint);

  select * into r from public.login_guard where key = p_key for update;

  if not found then
    insert into public.login_guard (key, fail_count, tier, last_failure_at)
    values (p_key, 1, 0, now_ts);
    return;
  end if;

  if r.locked_until is not null and r.locked_until > now_ts then
    return;
  end if;

  v_tier := r.tier;
  v_fail := r.fail_count;

  if r.last_failure_at is not null and now_ts - r.last_failure_at > interval '24 hours' then
    v_tier := 0;
    v_fail := 0;
  elsif v_fail > 0
        and v_fail < p_threshold
        and r.last_failure_at is not null
        and now_ts - r.last_failure_at > interval '15 minutes' then
    v_fail := 0;
  end if;

  v_fail := v_fail + 1;

  if v_fail >= p_threshold then
    v_lock_minutes := case when v_tier <= 0 then 10 when v_tier = 1 then 30 else 60 end;
    update public.login_guard set
      fail_count = 0,
      tier = least(v_tier + 1, 2),
      locked_until = now_ts + (v_lock_minutes * interval '1 minute'),
      last_failure_at = now_ts,
      updated_at = now_ts
    where key = p_key;
  else
    update public.login_guard set
      fail_count = v_fail,
      tier = v_tier,
      locked_until = null,
      last_failure_at = now_ts,
      updated_at = now_ts
    where key = p_key;
  end if;
end;
$$;

-- Email and browser lock after 4. IP locks after 12. Keys are locked in
-- sorted order so concurrent wrong passwords cannot deadlock.
-- Returns the longest active lock so the attempt that crossed the
-- line can tell the person how long to wait.
create or replace function public.login_guard_fail(
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
  rec record;
  now_ts timestamptz := now();
  v_until timestamptz;
  retry_minutes int;
begin
  for rec in
    select key, threshold
    from (values
      (p_email_key, 4),
      (p_device_key, 4),
      (p_ip_key, 12)
    ) as v(key, threshold)
    order by key
  loop
    perform public.login_guard_apply_failure(rec.key, rec.threshold);
  end loop;

  select max(locked_until) into v_until
  from public.login_guard
  where key in (p_email_key, p_device_key, p_ip_key)
    and locked_until is not null
    and locked_until > now_ts;

  if v_until is not null then
    retry_minutes := ceil(extract(epoch from (v_until - now_ts)) / 60.0)::int;
    if retry_minutes < 1 then
      retry_minutes := 1;
    end if;
    return jsonb_build_object('locked', true, 'retry_minutes', retry_minutes);
  end if;

  return jsonb_build_object('locked', false);
end;
$$;

-- A correct password clears the account and the browser. The IP ladder
-- stays, so a bot that guessed one password does not reset its address.
create or replace function public.login_guard_clear(
  p_email_key text,
  p_device_key text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_email_key is null or p_email_key !~ '^email:[a-f0-9]{64}$'
     or p_device_key is null or p_device_key !~ '^device:[a-f0-9]{64}$' then
    raise exception 'invalid guard key';
  end if;

  delete from public.login_guard
  where key in (p_email_key, p_device_key);
end;
$$;

revoke all on function public.login_guard_note_request(text) from public, anon, authenticated;
revoke all on function public.login_guard_begin(text, text, text, text) from public, anon, authenticated;
revoke all on function public.login_guard_apply_failure(text, int) from public, anon, authenticated;
revoke all on function public.login_guard_fail(text, text, text) from public, anon, authenticated;
revoke all on function public.login_guard_clear(text, text) from public, anon, authenticated;

grant execute on function public.login_guard_note_request(text) to service_role;
grant execute on function public.login_guard_begin(text, text, text, text) to service_role;
grant execute on function public.login_guard_apply_failure(text, int) to service_role;
grant execute on function public.login_guard_fail(text, text, text) to service_role;
grant execute on function public.login_guard_clear(text, text) to service_role;
