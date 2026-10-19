-- MZS Phase 3A.3: scoped Capital Requests management.
-- Staging-only migration; MUST NOT apply to the Production project.
-- Department operators never receive the legacy global admin role.
begin;

create table public.mzs_capital_request_admin_audit (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.mzs_capital_requests(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  previous_status text not null,
  new_status text not null,
  changed_at timestamptz not null default now(),
  constraint mzs_capital_audit_status_changed check (previous_status <> new_status)
);
create index mzs_capital_request_admin_audit_request_idx
  on public.mzs_capital_request_admin_audit(request_id,changed_at desc);
alter table public.mzs_capital_request_admin_audit enable row level security;
revoke all on public.mzs_capital_request_admin_audit from public,anon,authenticated;
grant select on public.mzs_capital_request_admin_audit to authenticated;
create policy "Capital audit visible to Group Admin"
on public.mzs_capital_request_admin_audit for select to authenticated
using ((select public.is_admin()));

-- Do not widen direct SELECT policies on private Capital requests or profiles:
-- capital operators receive only this carefully scoped result projection.
create function public.mzs_capital_admin_list_requests()
returns table (
  id uuid,
  user_id uuid,
  request_type text,
  amount_eur numeric,
  explanation text,
  status text,
  email_status text,
  created_at timestamptz,
  member_name text,
  member_email text
)
language plpgsql stable security definer set search_path=''
as $function$
begin
  if (select auth.uid()) is null or not (
    (select public.is_admin()) or (select public.mzs_has_department_scope('capital'))
  ) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;
  return query
    select r.id,r.user_id,r.request_type,r.amount_eur,r.explanation,
           r.status,r.email_status,r.created_at,p.full_name,p.email
    from public.mzs_capital_requests r
    left join public.profiles p on p.id=r.user_id
    order by r.created_at desc,r.id desc limit 300;
end
$function$;
revoke all on function public.mzs_capital_admin_list_requests() from public,anon;
grant execute on function public.mzs_capital_admin_list_requests() to authenticated;

-- No service-role operation is necessary: session authorisation and the update
-- are part of one audited database transaction. Audit insertion fails closed.
create function public.mzs_capital_admin_update_request(
  p_request_id uuid,p_new_status text
)
returns boolean language plpgsql volatile security definer set search_path=''
as $function$
declare
  v_actor uuid := auth.uid();
  v_previous text;
begin
  if v_actor is null or not (
    (select public.is_admin()) or (select public.mzs_has_department_scope('capital'))
  ) then
    raise exception 'Unauthorized' using errcode='42501';
  end if;
  if p_request_id is null or p_new_status is null or
     p_new_status not in ('new','in_review','contacted','closed') then
    raise exception 'Invalid request or status' using errcode='22023';
  end if;
  select r.status into v_previous
  from public.mzs_capital_requests r
  where r.id=p_request_id for update;
  if not found then
    raise exception 'Request not found' using errcode='P0002';
  end if;
  if v_previous=p_new_status then return false; end if;
  update public.mzs_capital_requests
  set status=p_new_status, updated_at=now()
  where id=p_request_id;
  insert into public.mzs_capital_request_admin_audit(
    request_id,actor_id,previous_status,new_status
  ) values (p_request_id,v_actor,v_previous,p_new_status);
  return true;
end
$function$;
revoke all on function public.mzs_capital_admin_update_request(uuid,text) from public,anon;
grant execute on function public.mzs_capital_admin_update_request(uuid,text) to authenticated;

commit;
