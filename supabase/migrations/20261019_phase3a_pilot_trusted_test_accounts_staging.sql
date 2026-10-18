-- Phase 3A.5, MZS Staging ONLY.
-- Preview pilot test identities use Auth app_metadata (administrator controlled),
-- not editable profile names or user_metadata.
-- To provision: use the SUPABASE STAGING Auth Admin API, confirm the email,
-- set email phase3a-test-<unique>@example.invalid, and set
-- app_metadata.mzs_phase3a_test=true. Never share service credentials.
begin;

create function public.mzs_phase3a_pilot_list_capital_accounts()
returns table (
  user_id uuid,
  full_name text,
  email text,
  is_active boolean,
  has_capital_scope boolean
)
language plpgsql stable security definer set search_path=''
as $body$
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;
  return query
    select p.id,p.full_name,u.email::text,p.is_active,
      exists (
        select 1 from public.mzs_admin_scope_assignments a
        where a.user_id=p.id and a.department='capital' and a.is_active=true
      )
    from auth.users u
    join public.profiles p on p.id=u.id
    where u.raw_app_meta_data @> '{"mzs_phase3a_test":true}'::jsonb
      and u.email like 'phase3a-test-%@example.invalid'
      and p.role in ('client','partner')
    order by p.created_at desc
    limit 50;
end
$body$;
revoke all on function public.mzs_phase3a_pilot_list_capital_accounts() from public,anon;
grant execute on function public.mzs_phase3a_pilot_list_capital_accounts() to authenticated;

create function public.mzs_phase3a_pilot_set_capital_scope(
  p_target_user uuid,p_enabled boolean
)
returns boolean language plpgsql volatile security definer set search_path=''
as $body$
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;
  if p_target_user is null or p_enabled is null then
    raise exception 'Invalid scope assignment' using errcode='22023';
  end if;
  if not exists (
    select 1 from auth.users u
    join public.profiles p on p.id=u.id
    where u.id=p_target_user
      and u.raw_app_meta_data @> '{"mzs_phase3a_test":true}'::jsonb
      and u.email like 'phase3a-test-%@example.invalid'
      and p.is_active=true and p.role in ('client','partner')
  ) then
    raise exception 'Not an active synthetic Staging test identity'
      using errcode='42501';
  end if;
  -- Delegates to the already-audited Group Admin grant/revocation path.
  return public.mzs_set_admin_department_scope(
    p_target_user,'capital',p_enabled
  );
end
$body$;
revoke all on function public.mzs_phase3a_pilot_set_capital_scope(uuid,boolean) from public,anon;
grant execute on function public.mzs_phase3a_pilot_set_capital_scope(uuid,boolean) to authenticated;

commit;
