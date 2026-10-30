-- MZS Operations: review selected real visits, close ISO weeks and keep immutable source snapshots.
-- Historical 2026 weeks imported from WhatsApp remain in their distinct archival table.
begin;
set local lock_timeout='3s';

create table public.mzs_ops_week_events (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete restrict,
 week_start date not null check(extract(isodow from week_start)=1),
 action text not null check(action in ('closed','reopened')),
 note text not null check(length(btrim(note)) between 12 and 500),
 visit_count integer not null check(visit_count between 0 and 10000),
 approved_minutes integer not null check(approved_minutes between 0 and 9600000),
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 check ((action='closed' and visit_count>0 and approved_minutes>0)
     or (action='reopened' and visit_count=0 and approved_minutes=0))
);
create index mzs_ops_week_events_lookup on public.mzs_ops_week_events(profile_id,week_start,created_at desc,id desc);
create table public.mzs_ops_week_entries (
 closure_id uuid not null references public.mzs_ops_week_events(id) on delete restrict,
 visit_id uuid not null references public.mzs_ops_staff_visits(id) on delete restrict,
 worked_on date not null,
 property_id uuid references public.mzs_estate_properties(id) on delete restrict,
 unit_id uuid references public.mzs_estate_units(id) on delete restrict,
 work_area_id text references public.mzs_ops_staff_work_areas(id) on delete restrict,
 actual_minutes integer not null check(actual_minutes between 1 and 960),
 approved_minutes integer not null check(approved_minutes between 1 and 960),
 category text not null,
 description text not null,
 primary key(closure_id,visit_id)
);
create index mzs_ops_week_entries_visit on public.mzs_ops_week_entries(visit_id);
alter table public.mzs_ops_week_events enable row level security;
alter table public.mzs_ops_week_entries enable row level security;
revoke all on public.mzs_ops_week_events,public.mzs_ops_week_entries from public,anon,authenticated,service_role;
grant select on public.mzs_ops_week_events,public.mzs_ops_week_entries to authenticated;
grant insert on public.mzs_ops_week_events,public.mzs_ops_week_entries to authenticated;
create policy ops_week_event_read on public.mzs_ops_week_events for select to authenticated
 using ((select public.is_admin()) or
       (profile_id=(select auth.uid()) and exists(select 1 from public.profiles p
        where p.id=(select auth.uid()) and p.is_active)));
create policy ops_week_event_insert on public.mzs_ops_week_events for insert to authenticated
 with check ((select public.is_admin()) and created_by=(select auth.uid()));
create policy ops_week_entry_read on public.mzs_ops_week_entries for select to authenticated
 using (exists(select 1 from public.mzs_ops_week_events e where e.id=closure_id
  and (e.profile_id=(select auth.uid()) or (select public.is_admin()))));
create policy ops_week_entry_insert on public.mzs_ops_week_entries for insert to authenticated
 with check ((select public.is_admin()) and exists(
  select 1 from public.mzs_ops_week_events e where e.id=closure_id and e.action='closed'));

create view public.mzs_ops_current_week_closures with (security_invoker=true,security_barrier=true) as
select distinct on (profile_id,week_start) id,profile_id,week_start,action,note,visit_count,
 approved_minutes,created_by,created_at
from public.mzs_ops_week_events
order by profile_id,week_start,created_at desc,id desc;
revoke all on public.mzs_ops_current_week_closures from public,anon,authenticated,service_role;
grant select on public.mzs_ops_current_week_closures to authenticated;

-- Serialize a staff submission against administrative closure of the same ISO week.
create function mzs_private.ops_guard_frozen_staff_week()
returns trigger language plpgsql security invoker set search_path='' as $fn$
declare v_profile uuid;v_day date;v_week date;v_status text;
begin
 if tg_table_name='mzs_ops_staff_visits' then
  v_profile:=new.profile_id;v_day:=new.worked_on;
 elsif tg_table_name='mzs_ops_visit_reviews' then
  select profile_id,worked_on into v_profile,v_day from public.mzs_ops_staff_visits where id=new.visit_id;
 elsif tg_table_name='mzs_ops_visit_correction_requests' then
  select profile_id,worked_on into v_profile,v_day from public.mzs_ops_staff_visits where id=new.visit_id;
 else
  select v.profile_id,v.worked_on into v_profile,v_day
  from public.mzs_ops_visit_correction_requests c
  join public.mzs_ops_staff_visits v on v.id=c.visit_id
  where c.id=new.correction_id;
 end if;
 if v_profile is null or v_day is null then raise exception 'Work visit not found' using errcode='22023';end if;
 v_week:=date_trunc('week',v_day::timestamp)::date;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_profile::text||':'||v_week::text,20261030));
 select action into v_status from public.mzs_ops_week_events
  where profile_id=v_profile and week_start=v_week order by created_at desc,id desc limit 1;
 if v_status='closed' then
  raise exception 'This week is closed; ask an administrator to reopen it before corrections' using errcode='23514';
 end if;
 return new;
end $fn$;
create trigger ops_week_guard_new_visit before insert on public.mzs_ops_staff_visits
 for each row execute function mzs_private.ops_guard_frozen_staff_week();
create trigger ops_week_guard_new_review before insert on public.mzs_ops_visit_reviews
 for each row execute function mzs_private.ops_guard_frozen_staff_week();
create trigger ops_week_guard_new_correction before insert on public.mzs_ops_visit_correction_requests
 for each row execute function mzs_private.ops_guard_frozen_staff_week();
create trigger ops_week_guard_correction_decision before insert on public.mzs_ops_visit_correction_decisions
 for each row execute function mzs_private.ops_guard_frozen_staff_week();

-- One all-or-nothing review for a deliberate selection; records use existing audited review triggers.
create function public.mzs_ops_approve_week_visits(p_profile uuid,p_week_start date,p_visit_ids uuid[],p_note text)
returns integer language plpgsql security invoker set search_path='' as $fn$
declare v_count int;v_done int;v_status text;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then
  raise exception 'Administrator required' using errcode='42501';end if;
 if p_profile is null or p_week_start is null or extract(isodow from p_week_start)<>1
  or p_visit_ids is null or cardinality(p_visit_ids) not between 1 and 100
  or (select count(distinct a) from unnest(p_visit_ids) a)<>cardinality(p_visit_ids)
  or p_note is null or length(btrim(p_note)) not between 12 and 500 then
  raise exception 'Invalid week, selection or review reason' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile::text||':'||p_week_start::text,20261030));
 select action into v_status from public.mzs_ops_week_events where profile_id=p_profile
  and week_start=p_week_start order by created_at desc,id desc limit 1;
 if v_status='closed' then raise exception 'Week closed' using errcode='23514';end if;
 select count(*) into v_count from public.mzs_ops_current_visits v
 where v.id=any(p_visit_ids) and v.profile_id=p_profile
  and v.worked_on>=p_week_start and v.worked_on<p_week_start+7
  and v.review_decision is null and v.correction_pending=false;
 if v_count<>cardinality(p_visit_ids) then
  raise exception 'Selection changed, was already reviewed or has a pending correction' using errcode='22023';end if;
 insert into public.mzs_ops_visit_reviews
  (visit_id,correction_id,decision,reason,recharge_class)
 select v.id,v.correction_id,'approved',btrim(p_note),'not_billable'
 from public.mzs_ops_current_visits v where v.id=any(p_visit_ids)
 order by v.id;
 get diagnostics v_done=row_count;
 if v_done<>v_count then raise exception 'Incomplete approval transaction' using errcode='22023';end if;
 return v_done;
end $fn$;
revoke all on function public.mzs_ops_approve_week_visits(uuid,date,uuid[],text) from public,anon,authenticated,service_role;
grant execute on function public.mzs_ops_approve_week_visits(uuid,date,uuid[],text) to authenticated;

create function public.mzs_ops_close_staff_week(p_profile uuid,p_week_start date,p_note text)
returns uuid language plpgsql security invoker set search_path='' as $fn$
declare v_count int;v_pending int;v_total int;v_status text;v_id uuid;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then
  raise exception 'Administrator required' using errcode='42501';end if;
 if p_profile is null or p_week_start is null or extract(isodow from p_week_start)<>1
   or p_week_start+6 >=(now() at time zone 'Europe/Madrid')::date
   or p_note is null or length(btrim(p_note)) not between 12 and 500 then
  raise exception 'A completed ISO week and closure explanation are required' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile::text||':'||p_week_start::text,20261030));
 select action into v_status from public.mzs_ops_week_events where profile_id=p_profile
   and week_start=p_week_start order by created_at desc,id desc limit 1;
 if v_status='closed' then raise exception 'Week already closed' using errcode='23505';end if;
 select count(*),
   count(*) filter(where v.review_decision is distinct from 'approved' or v.correction_pending),
   coalesce(sum(v.effective_minutes),0)::int
 into v_count,v_pending,v_total from public.mzs_ops_current_visits v
 where v.profile_id=p_profile and v.worked_on>=p_week_start and v.worked_on<p_week_start+7;
 if v_count=0 or v_pending<>0 then
  raise exception 'All registered visits must be approved, with no pending corrections' using errcode='22023';end if;
 insert into public.mzs_ops_week_events(profile_id,week_start,action,note,visit_count,approved_minutes)
 values(p_profile,p_week_start,'closed',btrim(p_note),v_count,v_total) returning id into v_id;
 insert into public.mzs_ops_week_entries
   (closure_id,visit_id,worked_on,property_id,unit_id,work_area_id,actual_minutes,approved_minutes,category,description)
 select v_id,v.id,v.worked_on,v.property_id,v.unit_id,v.work_area_id,v.actual_minutes,v.effective_minutes,v.task_category,v.description
 from public.mzs_ops_current_visits v
 where v.profile_id=p_profile and v.worked_on>=p_week_start and v.worked_on<p_week_start+7;
 if (select count(*) from public.mzs_ops_week_entries where closure_id=v_id)<>v_count or
    (select sum(approved_minutes) from public.mzs_ops_week_entries where closure_id=v_id)<>v_total then
  raise exception 'Closure snapshot does not reconcile' using errcode='22023';end if;
 return v_id;
end $fn$;
revoke all on function public.mzs_ops_close_staff_week(uuid,date,text) from public,anon,authenticated,service_role;
grant execute on function public.mzs_ops_close_staff_week(uuid,date,text) to authenticated;

create function public.mzs_ops_reopen_staff_week(p_profile uuid,p_week_start date,p_note text)
returns uuid language plpgsql security invoker set search_path='' as $fn$
declare v_status text;v_id uuid;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then
  raise exception 'Administrator required' using errcode='42501';end if;
 if p_profile is null or p_week_start is null or extract(isodow from p_week_start)<>1
  or p_note is null or length(btrim(p_note)) not between 12 and 500 then
  raise exception 'Valid week and correction explanation required' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_profile::text||':'||p_week_start::text,20261030));
 select action into v_status from public.mzs_ops_week_events
  where profile_id=p_profile and week_start=p_week_start order by created_at desc,id desc limit 1;
 if v_status is distinct from 'closed' then
  raise exception 'Only closed weeks can be reopened' using errcode='22023';end if;
 if exists(select 1 from public.mzs_ops_zorgbalans_invoice_lines l
   join public.mzs_ops_staff_visits v on v.id=l.visit_id
   where v.profile_id=p_profile and v.worked_on>=p_week_start and v.worked_on<p_week_start+7)
 then raise exception 'Week contains invoiced visits; use a separate correction procedure' using errcode='23514';end if;
 insert into public.mzs_ops_week_events(profile_id,week_start,action,note,visit_count,approved_minutes)
 values(p_profile,p_week_start,'reopened',btrim(p_note),0,0) returning id into v_id;
 return v_id;
end $fn$;
revoke all on function public.mzs_ops_reopen_staff_week(uuid,date,text) from public,anon,authenticated,service_role;
grant execute on function public.mzs_ops_reopen_staff_week(uuid,date,text) to authenticated;
commit;