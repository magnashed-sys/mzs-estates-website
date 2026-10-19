-- Reviewed release candidate. NOT automatically applied.
-- Verify the target project independently before setting this operator acknowledgement.
-- SET mzs.phase3a_release_authorized = 'ptrnjzmcehrhbsfxntgw';
-- This acknowledgement is NOT automatic project identity detection.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
DO $preflight$
BEGIN
 IF current_setting('mzs.phase3a_release_authorized',true) IS DISTINCT FROM 'ptrnjzmcehrhbsfxntgw' THEN
   RAISE EXCEPTION 'Explicit release target acknowledgement required';
 END IF;
 IF to_regclass('public.mzs_capital_requests') IS NULL OR to_regprocedure('public.is_admin()') IS NULL THEN
   RAISE EXCEPTION 'Required existing production objects missing';
 END IF;
 IF to_regclass('public.mzs_admin_scope_assignments') IS NOT NULL
 OR to_regclass('public.mzs_admin_scope_audit') IS NOT NULL
 OR to_regclass('public.mzs_capital_request_admin_audit') IS NOT NULL
 OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('mzs_has_department_scope','mzs_set_admin_department_scope','mzs_capital_admin_list_requests','mzs_capital_admin_update_request','mzs_phase3a_pilot_list_capital_accounts','mzs_phase3a_pilot_set_capital_scope')) THEN
   RAISE EXCEPTION 'Phase 3A objects already exist: stop and inspect schema drift';
 END IF;
END $preflight$;
-- Source: 20261016_phase3a_admin_scopes_staging.sql
create table if not exists public.mzs_admin_scope_assignments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 department text not null check (department in ('estates','capital')),
 is_active boolean not null default false,
 assigned_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,department)
);
create index if not exists mzs_admin_scope_assignments_department_idx
 on public.mzs_admin_scope_assignments(department,user_id) where is_active;
alter table public.mzs_admin_scope_assignments enable row level security;
revoke all on public.mzs_admin_scope_assignments from anon;
grant select,insert,update,delete on public.mzs_admin_scope_assignments to authenticated;
create policy mzs_scope_group_admin_manage on public.mzs_admin_scope_assignments
 for all to authenticated using ((select public.is_admin()))
 with check ((select public.is_admin()) and assigned_by=(select auth.uid()));
create policy mzs_scope_self_read on public.mzs_admin_scope_assignments
 for select to authenticated using (user_id=(select auth.uid()));
create or replace function public.mzs_has_department_scope(p_department text)
returns boolean language sql stable security definer set search_path=''
as $$
 select p_department in ('estates','capital') and exists (
  select 1 from public.profiles p
  join public.mzs_admin_scope_assignments a on a.user_id=p.id
  where p.id=(select auth.uid())
    and p.is_active=true and a.department=p_department and a.is_active=true
 )
$$;
revoke all on function public.mzs_has_department_scope(text) from public,anon;
grant execute on function public.mzs_has_department_scope(text) to authenticated;
-- Source: 20261017_phase3a_scoped_admin_audit_staging.sql
create table if not exists public.mzs_admin_scope_audit (
 id bigint generated always as identity primary key,
 assignment_id uuid not null,
 target_user_id uuid not null,
 department text not null,
 old_active boolean,
 new_active boolean not null,
 changed_by uuid not null,
 changed_at timestamptz not null default now()
);
alter table public.mzs_admin_scope_audit enable row level security;
revoke all on public.mzs_admin_scope_audit from public, anon, authenticated;
grant select on public.mzs_admin_scope_audit to authenticated;
create policy mzs_scope_audit_group_read on public.mzs_admin_scope_audit
 for select to authenticated using ((select public.is_admin()));
drop policy if exists mzs_scope_group_admin_manage on public.mzs_admin_scope_assignments;
revoke insert,update,delete on public.mzs_admin_scope_assignments from authenticated;
create policy mzs_scope_group_admin_read on public.mzs_admin_scope_assignments
 for select to authenticated using ((select public.is_admin()));
create or replace function public.mzs_set_admin_department_scope(
 p_target_user uuid, p_department text, p_enabled boolean)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_actor uuid := auth.uid(); v_prev boolean; v_id uuid;
begin
 if v_actor is null or not public.is_admin() then raise exception 'Unauthorized'; end if;
 if p_target_user is null or p_department not in ('estates','capital') or p_enabled is null
 then raise exception 'Invalid scope assignment'; end if;
 if p_target_user = v_actor then raise exception 'Self-assignment is not permitted'; end if;
 if not exists (select 1 from public.profiles p where p.id=p_target_user and p.is_active=true)
 then raise exception 'Target account must be active'; end if;
 -- Department operators never inherit the legacy global admin role.
 if exists (select 1 from public.profiles p where p.id=p_target_user and p.role='admin')
 then raise exception 'Legacy administrators are already globally privileged'; end if;
 select id,is_active into v_id,v_prev from public.mzs_admin_scope_assignments
 where user_id=p_target_user and department=p_department for update;
 if v_id is null then
   if p_enabled = false then return false; end if;
   insert into public.mzs_admin_scope_assignments(user_id,department,is_active,assigned_by)
   values(p_target_user,p_department,true,v_actor) returning id into v_id;
 else
   if v_prev=p_enabled then return false; end if;
   update public.mzs_admin_scope_assignments set is_active=p_enabled,assigned_by=v_actor,updated_at=now()
   where id=v_id;
 end if;
 insert into public.mzs_admin_scope_audit(assignment_id,target_user_id,department,old_active,new_active,changed_by)
 values(v_id,p_target_user,p_department,v_prev,p_enabled,v_actor);
 return true;
end;
$$;
revoke all on function public.mzs_set_admin_department_scope(uuid,text,boolean) from public,anon;
grant execute on function public.mzs_set_admin_department_scope(uuid,text,boolean) to authenticated;
-- Source: 20261018_phase3a_capital_requests_scoped_staging.sql

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

-- Explicit ACLs avoid deployment-specific default function grants.
revoke execute on function public.mzs_has_department_scope(text), public.mzs_set_admin_department_scope(uuid,text,boolean), public.mzs_capital_admin_list_requests(), public.mzs_capital_admin_update_request(uuid,text) from public,anon,service_role;
grant execute on function public.mzs_has_department_scope(text), public.mzs_set_admin_department_scope(uuid,text,boolean), public.mzs_capital_admin_list_requests(), public.mzs_capital_admin_update_request(uuid,text) to authenticated;
revoke all on public.mzs_admin_scope_assignments from public,anon;
revoke insert,update,delete,truncate,references,trigger on public.mzs_admin_scope_assignments from authenticated;
commit;
