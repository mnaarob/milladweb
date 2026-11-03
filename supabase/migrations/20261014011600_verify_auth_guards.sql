do $$
declare
  missing text;
begin
  select string_agg(name, ', ') into missing
  from (
    select name from (values
      ('login_guard_note_request'),
      ('login_guard_begin'),
      ('login_guard_apply_failure'),
      ('login_guard_fail'),
      ('login_guard_clear'),
      ('signup_email_exists'),
      ('signup_prepare_send'),
      ('signup_prepare_verify'),
      ('signup_put_code'),
      ('signup_check_code'),
      ('signup_delete_code')
    ) as required(name)
    where not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = required.name
    )
  ) s(name);
  if missing is not null then
    raise exception 'missing functions: %', missing;
  end if;
end $$;
