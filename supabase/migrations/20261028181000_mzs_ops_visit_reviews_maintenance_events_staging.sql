-- STAGING ONLY: staff visit approval and maintenance ticket workflow.
-- All decisions are append-only. The original visit/time or issue is immutable.
-- Billable minutes are a REVIEW CANDIDATE; never invoice, wages, tax or cash.
begin;

create table public.mzs_ops_visit_reviews (
 id uuid primary key default gen_random_uuid(),
 visit_id uuid not null unique references public.mzs_ops_staff_visits(id) on delete restrict,
 decision text not null check(decision in ('approved','rejected')),
 reason text not null check(length(btrim(reason)) between 8 and 1000 and reason !~ '[[:cntrl:]]'),
 recharge_class text not null check(recharge_class in ('not_billable','review_candidate')),
 minimum_minutes integer,
 increment_minutes integer,
 billable_minutes integer not null default 0 check(billable_minutes between 0 and 2000),
 reviewed_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 reviewed_at timestamptz not null default now(),
 check(decision='approved' or recharge_class='not_billable'),
 check(  (decision='approved' and recharge_class='review_candidate' and
   minimum_minutes between 0 and 960 and increment_minutes between 1 and 960)
  or ((recharge_class='not_billable' or decision='rejected') and
   minimum_minutes is null and increment_minutes is null and billable_minutes=0)
 )
);
create index ops_visit_review_date on public.mzs_ops_visit_reviews(reviewed_at desc);
alter table public.mzs_ops_visit_reviews enable row level security;
revoke all on public.mzs_ops_visit_reviews from public,anon,authenticated,service_role;
grant select on public.mzs_ops_visit_reviews to authenticated;
grant insert(visit_id,decision,reason,recharge_class,minimum_minutes,increment_minutes)
 on public.mzs_ops_visit_reviews to authenticated;
create policy ops_visit_review_admin_read on public.mzs_ops_visit_reviews
 for select to authenticated using ((select public.is_admin()));
create policy ops_visit_review_admin_add on public.mzs_ops_visit_reviews
 for insert to authenticated with check ((select public.is_admin()) and reviewed_by=(select auth.uid()));

create function mzs_private.ops_validate_visit_review()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare visit public.mzs_ops_staff_visits;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
  or new.reviewed_by is distinct from (select auth.uid())
 then raise exception 'Only active Group Administrator may review visits' using errcode='42501';end if;
 select * into visit from public.mzs_ops_staff_visits where id=new.visit_id for update;
 if not found then raise exception 'Original visit not found';end if;
 if exists(select 1 from public.mzs_ops_visit_reviews where visit_id=visit.id)
 then raise exception 'Visit already reviewed';end if;
 if new.decision='approved' and new.recharge_class='review_candidate' then
  if new.minimum_minutes is null or new.increment_minutes is null
    or new.minimum_minutes<0 or new.increment_minutes<=0 then
   raise exception 'Explicit per-visit billing rule is required';end if;
  new.billable_minutes:=greatest(new.minimum_minutes,
    ((visit.actual_minutes+new.increment_minutes-1)/new.increment_minutes)*new.increment_minutes);
  if new.billable_minutes>2000 then raise exception 'Billable duration outside supported review range';end if;
 else
  if new.minimum_minutes is not null or new.increment_minutes is not null
  then raise exception 'No automatic billing rule on internal or rejected work';end if;
  new.billable_minutes:=0;
 end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_visit_review() from public,anon,authenticated,service_role;
create trigger ops_visit_review_verify before insert on public.mzs_ops_visit_reviews
 for each row execute function mzs_private.ops_validate_visit_review();

create table public.mzs_ops_maintenance_events (
 id uuid primary key default gen_random_uuid(),
 sequence_no bigint generated always as identity unique,
 ticket_id uuid not null references public.mzs_ops_maintenance_tickets(id) on delete restrict,
 action text not null check(action in
  ('triaged','scheduled','in_progress','resolved','reopened','closed')),
 note text not null check(length(btrim(note)) between 8 and 2000 and note !~ '[[:cntrl:]]'),
 work_order_reference text check(work_order_reference is null or
  (length(btrim(work_order_reference)) between 3 and 100 and work_order_reference !~ '[[:cntrl:]]')),
 actor_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index ops_maintenance_event_ticket on public.mzs_ops_maintenance_events(ticket_id,sequence_no desc);
alter table public.mzs_ops_maintenance_events enable row level security;
revoke all on public.mzs_ops_maintenance_events from public,anon,authenticated,service_role;
grant select on public.mzs_ops_maintenance_events to authenticated;
grant insert(ticket_id,action,note,work_order_reference) on public.mzs_ops_maintenance_events to authenticated;
create policy ops_maintenance_event_admin_or_reporter_read on public.mzs_ops_maintenance_events
 for select to authenticated using(
  (select public.is_admin()) or exists(
   select 1 from public.mzs_ops_maintenance_tickets t
   where t.id=ticket_id and t.reported_by=(select auth.uid())
    and (select mzs_private.ops_can_work_on_property(t.property_id))
  ));
create policy ops_maintenance_event_admin_add on public.mzs_ops_maintenance_events
 for insert to authenticated with check((select public.is_admin()) and actor_id=(select auth.uid()));

create function mzs_private.ops_validate_maintenance_event()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare ticket public.mzs_ops_maintenance_tickets;previous_action text;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
  or new.actor_id is distinct from (select auth.uid()) then
  raise exception 'Only Group Administrator can update maintenance status' using errcode='42501';end if;
 select * into ticket from public.mzs_ops_maintenance_tickets where id=new.ticket_id for update;
 if not found then raise exception 'Ticket not found';end if;
 select e.action into previous_action from public.mzs_ops_maintenance_events e
 where e.ticket_id=new.ticket_id order by e.sequence_no desc limit 1;
 previous_action:=coalesce(previous_action,'reported');
 if not (
   (previous_action='reported' and new.action='triaged') or
   (previous_action='triaged' and new.action in ('scheduled','in_progress','resolved')) or
   (previous_action='scheduled' and new.action in ('in_progress','resolved')) or
   (previous_action='in_progress' and new.action='resolved') or
   (previous_action='resolved' and new.action in ('reopened','closed')) or
   (previous_action='reopened' and new.action in ('triaged','scheduled','in_progress','resolved'))
 ) then raise exception 'Invalid maintenance state transition';end if;
 -- The work_order_reference is an administrative planning label only:
 -- no automatic vendor order, purchase, payment or customer invoice.
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_maintenance_event()
 from public,anon,authenticated,service_role;
create trigger ops_maintenance_event_verify before insert on public.mzs_ops_maintenance_events
 for each row execute function mzs_private.ops_validate_maintenance_event();

comment on table public.mzs_ops_visit_reviews is
 'Append-only administrator review per actual visit. Approved review_candidate duration is a separate proposed billable minutes snapshot, not issued invoicing or payroll.';
comment on table public.mzs_ops_maintenance_events is
 'Append-only maintenance workflow; work_order_reference is an uncommitted planning note, not a supplier order.';
commit;
