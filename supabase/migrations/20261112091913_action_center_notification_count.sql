-- Read-only aggregate for the Action Center. The outbox and its payloads stay private.
create or replace function mzs_private.failed_notification_count()
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(public.is_admin(), false) then
    raise exception 'Active administrator required' using errcode = '42501';
  end if;
  return (select count(*) from public.mzs_mail_outbox where status = 'failed');
end;
$$;
revoke all on function mzs_private.failed_notification_count() from public, anon, authenticated, service_role;
grant execute on function mzs_private.failed_notification_count() to authenticated;

create or replace function public.mzs_failed_notification_count()
returns bigint language sql stable security invoker set search_path = '' as $$
  select mzs_private.failed_notification_count();
$$;
revoke all on function public.mzs_failed_notification_count() from public, anon, authenticated, service_role;
grant execute on function public.mzs_failed_notification_count() to authenticated;

comment on function public.mzs_failed_notification_count() is
  'Active-admin-only failed notification count; no recipient, payload or message access.';
