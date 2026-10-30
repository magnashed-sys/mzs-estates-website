-- Correct event order within the same SQL transaction: now() is transaction-stable.
-- A monotonic identity is authoritative for all closure/reopening state transitions.
begin;
set local lock_timeout='3s';
alter table public.mzs_ops_week_events add column sequence_no bigint generated always as identity;
create unique index ops_week_event_sequence_unique on public.mzs_ops_week_events(sequence_no);
create or replace view public.mzs_ops_current_week_closures with (security_invoker=true,security_barrier=true) as
select distinct on (profile_id,week_start) id,profile_id,week_start,action,note,visit_count,
 approved_minutes,created_by,created_at
from public.mzs_ops_week_events
order by profile_id,week_start,sequence_no desc;

create or replace function mzs_private.ops_guard_frozen_staff_week()
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
  where profile_id=v_profile and week_start=v_week order by sequence_no desc limit 1;
 if v_status='closed' then
  raise exception 'This week is closed; ask an administrator to reopen it before corrections' using errcode='23514';
 end if;
 return new;
end $fn$;

create or replace function public.mzs_ops_approve_week_visits(p_profile uuid,p_week_start date,p_visit_ids uuid[],p_note text)
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
  and week_start=p_week_start order by sequence_no desc limit 1;
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

create or replace function public.mzs_ops_close_staff_week(p_profile uuid,p_week_start date,p_note text)
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
   and week_start=p_week_start order by sequence_no desc limit 1;
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

create or replace function public.mzs_ops_reopen_staff_week(p_profile uuid,p_week_start date,p_note text)
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
  where profile_id=p_profile and week_start=p_week_start order by sequence_no desc limit 1;
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
commit;
