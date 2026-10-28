-- Daily operations: immutable revisions, explicit assignments, current-state views.
begin;
alter table public.mzs_ops_visit_correction_requests drop constraint mzs_ops_visit_correction_requests_visit_id_key;
alter table public.mzs_ops_visit_correction_requests add column sequence_no bigint generated always as identity unique;
alter table public.mzs_ops_visit_reviews drop constraint mzs_ops_visit_reviews_visit_id_key;
alter table public.mzs_ops_visit_reviews add column correction_id uuid references public.mzs_ops_visit_correction_requests(id) on delete restrict;
alter table public.mzs_ops_visit_reviews add column reviewed_minutes integer check(reviewed_minutes between 1 and 960);
-- Preserve the exact meaning of existing Staging reviews before enabling revisions.
update public.mzs_ops_visit_reviews r set correction_id=c.id
from public.mzs_ops_visit_correction_requests c join public.mzs_ops_visit_correction_decisions d on d.correction_id=c.id
where c.visit_id=r.visit_id and d.decision='approved';
update public.mzs_ops_visit_reviews r set reviewed_minutes=coalesce((select c.proposed_minutes from public.mzs_ops_visit_correction_requests c where c.id=r.correction_id),(select v.actual_minutes from public.mzs_ops_staff_visits v where v.id=r.visit_id));
alter table public.mzs_ops_visit_reviews alter column reviewed_minutes set not null;
create unique index ops_visit_review_revision on public.mzs_ops_visit_reviews(visit_id,correction_id) nulls not distinct;
grant insert(correction_id) on public.mzs_ops_visit_reviews to authenticated;

create or replace function mzs_private.ops_validate_visit_correction_request()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare original public.mzs_ops_staff_visits; effective_minutes integer;
begin
 if auth.uid() is null or new.requested_by is distinct from auth.uid() then raise exception 'Authenticated author required' using errcode='42501';end if;
 select * into original from public.mzs_ops_staff_visits where id=new.visit_id for update;
 if not found then raise exception 'Visit missing';end if;
 if not (public.is_admin() or (original.profile_id=auth.uid() and mzs_private.ops_can_work_on_property(original.property_id))) then raise exception 'Visit access denied' using errcode='42501';end if;
 if exists(select 1 from public.mzs_ops_visit_correction_requests c where c.visit_id=new.visit_id and not exists(select 1 from public.mzs_ops_visit_correction_decisions d where d.correction_id=c.id)) then raise exception 'A pending correction already exists';end if;
 select c.proposed_minutes into effective_minutes from public.mzs_ops_visit_correction_requests c join public.mzs_ops_visit_correction_decisions d on d.correction_id=c.id and d.decision='approved' where c.visit_id=new.visit_id order by c.sequence_no desc limit 1;
 if new.proposed_minutes=coalesce(effective_minutes,original.actual_minutes) then raise exception 'Correction must change current minutes';end if;
 return new;
end $fn$;
create or replace function mzs_private.ops_validate_visit_correction_decision()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare visit_id uuid;
begin
 if auth.uid() is null or public.is_admin() is distinct from true or new.decided_by is distinct from auth.uid() then raise exception 'Admin required' using errcode='42501';end if;
 select c.visit_id into visit_id from public.mzs_ops_visit_correction_requests c where c.id=new.correction_id;
 if not found then raise exception 'Correction missing';end if;
 -- All review/correction operations lock the visit first, avoiding lock inversion.
 perform 1 from public.mzs_ops_staff_visits v where v.id=visit_id for update;
 if exists(select 1 from public.mzs_ops_visit_correction_decisions d where d.correction_id=new.correction_id) then raise exception 'Correction already decided';end if;
 return new;
end $fn$;
create or replace function mzs_private.ops_validate_visit_review()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare visit public.mzs_ops_staff_visits; revision uuid; effective_minutes integer;
begin
 if auth.uid() is null or public.is_admin() is distinct from true or new.reviewed_by is distinct from auth.uid() then raise exception 'Admin required' using errcode='42501';end if;
 select * into visit from public.mzs_ops_staff_visits where id=new.visit_id for update;
 if not found then raise exception 'Visit missing';end if;
 if exists(select 1 from public.mzs_ops_visit_correction_requests c where c.visit_id=visit.id and not exists(select 1 from public.mzs_ops_visit_correction_decisions d where d.correction_id=c.id)) then raise exception 'Pending correction must be decided first';end if;
 select c.id,c.proposed_minutes into revision,effective_minutes from public.mzs_ops_visit_correction_requests c join public.mzs_ops_visit_correction_decisions d on d.correction_id=c.id and d.decision='approved' where c.visit_id=visit.id order by c.sequence_no desc limit 1;
 if new.correction_id is distinct from revision then raise exception 'Stale review: reload current revision';end if;
 if exists(select 1 from public.mzs_ops_visit_reviews r where r.visit_id=visit.id and r.correction_id is not distinct from revision) then raise exception 'Revision already reviewed';end if;
 new.reviewed_minutes:=coalesce(effective_minutes,visit.actual_minutes);
 if new.decision='approved' and new.recharge_class='review_candidate' then
  if new.minimum_minutes is null or new.increment_minutes is null or new.minimum_minutes<0 or new.minimum_minutes>960 or new.increment_minutes<1 or new.increment_minutes>960 then raise exception 'Explicit billing rule required';end if;
  new.billable_minutes:=greatest(new.minimum_minutes,((new.reviewed_minutes+new.increment_minutes-1)/new.increment_minutes)*new.increment_minutes);
 else
  if new.minimum_minutes is not null or new.increment_minutes is not null then raise exception 'No billing rule for rejected or internal time';end if;
  new.billable_minutes:=0;
 end if;
 return new;
end $fn$;
-- Allow revocation of a disabled/former account as well as active assignments.
create or replace function mzs_private.ops_validate_staff_scope_event()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare previous_action text;
begin
 if auth.uid() is null or public.is_admin() is distinct from true or new.recorded_by is distinct from auth.uid() then raise exception 'Admin required' using errcode='42501';end if;
 perform 1 from public.profiles where id=new.profile_id for update;
 if new.action='grant' and not exists(select 1 from public.profiles p where p.id=new.profile_id and p.is_active and p.role::text in ('client','partner')) then raise exception 'Target must be active client or partner';end if;
 select e.action into previous_action from public.mzs_ops_staff_scope_events e where e.profile_id=new.profile_id and e.property_id=new.property_id order by e.sequence_no desc limit 1;
 if (new.action='grant' and previous_action='grant') or (new.action='revoke' and previous_action is distinct from 'grant') then raise exception 'Scope already has this state';end if;
 return new;
end $fn$;

alter table public.mzs_ops_maintenance_events add column responsible_profile_id uuid references public.profiles(id) on delete restrict;
alter table public.mzs_ops_maintenance_events add column scheduled_for date;
grant insert(responsible_profile_id,scheduled_for) on public.mzs_ops_maintenance_events to authenticated;
create or replace function mzs_private.ops_validate_maintenance_event()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare ticket public.mzs_ops_maintenance_tickets; previous public.mzs_ops_maintenance_events; stage text;
begin
 if auth.uid() is null or public.is_admin() is distinct from true or new.actor_id is distinct from auth.uid() then raise exception 'Admin required' using errcode='42501';end if;
 select * into ticket from public.mzs_ops_maintenance_tickets where id=new.ticket_id for update;
 if not found then raise exception 'Ticket missing';end if;
 select * into previous from public.mzs_ops_maintenance_events e where e.ticket_id=new.ticket_id order by e.sequence_no desc limit 1;
 stage:=coalesce(previous.action,'reported');
 if not ((stage='reported' and new.action='triaged') or
 (stage in ('triaged','scheduled','reopened') and new.action in ('triaged','scheduled','in_progress','resolved')) or
 (stage='in_progress' and new.action in ('in_progress','scheduled','resolved')) or
 (stage='resolved' and new.action in ('reopened','closed')) or
 (stage='closed' and new.action='reopened')) then raise exception 'Invalid maintenance transition';end if;
 if new.responsible_profile_id is not null and not exists(select 1 from public.profiles p where p.id=new.responsible_profile_id and p.is_active and
  (p.role::text='admin' or (p.role::text in ('client','partner') and coalesce((select e.action='grant' from public.mzs_ops_staff_scope_events e where e.profile_id=p.id and e.property_id=ticket.property_id order by e.sequence_no desc limit 1),false)))) then raise exception 'Responsible person must have active property scope';end if;
 if new.action in ('scheduled','in_progress') and new.responsible_profile_id is null then raise exception 'Responsible person required';end if;
 if new.action='scheduled' and new.scheduled_for is null then raise exception 'Planned date required';end if;
 if new.scheduled_for is not null and (new.scheduled_for<current_date-366 or new.scheduled_for>current_date+730) then raise exception 'Planning date out of range';end if;
 return new;
end $fn$;

-- Staff see their own review outcomes, never commercial rounding rules.
create function mzs_private.ops_visible_visit_reviews()
returns table(id uuid,visit_id uuid,correction_id uuid,decision text,reason text,reviewed_minutes integer,reviewed_at timestamptz)
language sql security definer stable set search_path='' as $fn$
 select r.id,r.visit_id,r.correction_id,r.decision,r.reason,r.reviewed_minutes,r.reviewed_at from public.mzs_ops_visit_reviews r join public.mzs_ops_staff_visits v on v.id=r.visit_id
 where public.is_admin() or (v.profile_id=auth.uid() and mzs_private.ops_can_work_on_property(v.property_id))
$fn$;
revoke all on function mzs_private.ops_visible_visit_reviews() from public,anon,authenticated,service_role;
grant execute on function mzs_private.ops_visible_visit_reviews() to authenticated;
create view public.mzs_ops_staff_review_status with(security_invoker=true,security_barrier=true) as select * from mzs_private.ops_visible_visit_reviews();
create view public.mzs_ops_current_visits with(security_invoker=true,security_barrier=true) as
select v.*,c.id as correction_id,coalesce(c.proposed_minutes,v.actual_minutes) as effective_minutes,
 r.decision as review_decision,r.reason as review_reason,r.reviewed_at,
 exists(select 1 from public.mzs_ops_visit_correction_requests pc where pc.visit_id=v.id and not exists(select 1 from public.mzs_ops_visit_correction_decisions pd where pd.correction_id=pc.id)) as correction_pending
from public.mzs_ops_staff_visits v
left join lateral(select c.id,c.proposed_minutes from public.mzs_ops_visit_correction_requests c join public.mzs_ops_visit_correction_decisions d on d.correction_id=c.id and d.decision='approved' where c.visit_id=v.id order by c.sequence_no desc limit 1) c on true
left join public.mzs_ops_staff_review_status r on r.visit_id=v.id and r.correction_id is not distinct from c.id;
create view public.mzs_ops_current_tickets with(security_invoker=true,security_barrier=true) as
select t.id,t.reported_by,t.property_id,t.unit_id,t.priority,t.title,t.description,t.created_at,
 coalesce(e.action,t.status) as status,e.responsible_profile_id,e.scheduled_for,e.note as latest_note
from public.mzs_ops_maintenance_tickets t
left join lateral(select e.* from public.mzs_ops_maintenance_events e where e.ticket_id=t.id order by e.sequence_no desc limit 1) e on true;
create view public.mzs_ops_current_staff_scopes with(security_invoker=true,security_barrier=true) as
select distinct on(profile_id,property_id) profile_id,property_id,action,reason,created_at
from public.mzs_ops_staff_scope_events order by profile_id,property_id,sequence_no desc;
create view public.mzs_ops_property_work_summary with(security_invoker=true,security_barrier=true) as
select p.id as property_id,p.name,
 (select count(*) from public.mzs_ops_current_tickets t where t.property_id=p.id and t.status not in ('resolved','closed')) as open_tickets,
 (select count(*) from public.mzs_ops_current_visits v where v.property_id=p.id and (v.review_decision is null or v.correction_pending)) as pending_visits,
 (select coalesce(sum(v.effective_minutes),0) from public.mzs_ops_current_visits v where v.property_id=p.id and v.review_decision='approved' and not v.correction_pending) as approved_minutes,
 (select coalesce(sum(e.gross_cents),0) from public.mzs_ops_expense_drafts e where e.property_id=p.id) as expense_draft_cents
from public.mzs_estate_properties p where (select public.is_admin());
revoke all on public.mzs_ops_staff_review_status,public.mzs_ops_current_visits,public.mzs_ops_current_tickets,public.mzs_ops_current_staff_scopes,public.mzs_ops_property_work_summary from public,anon,authenticated,service_role;
grant select on public.mzs_ops_staff_review_status,public.mzs_ops_current_visits,public.mzs_ops_current_tickets,public.mzs_ops_current_staff_scopes,public.mzs_ops_property_work_summary to authenticated;
-- Cover all new FK checks; do not scan entire event tables during account/property operations.
create index if not exists ops_staff_scope_property_idx on public.mzs_ops_staff_scope_events(property_id);
create index if not exists ops_staff_scope_actor_idx on public.mzs_ops_staff_scope_events(recorded_by);
create index if not exists ops_staff_visit_unit_idx on public.mzs_ops_staff_visits(unit_id);
create index if not exists ops_ticket_reporter_idx on public.mzs_ops_maintenance_tickets(reported_by);
create index if not exists ops_ticket_unit_idx on public.mzs_ops_maintenance_tickets(unit_id);
create index if not exists ops_review_actor_idx on public.mzs_ops_visit_reviews(reviewed_by);
create index if not exists ops_review_correction_idx on public.mzs_ops_visit_reviews(correction_id);
create index if not exists ops_correction_actor_idx on public.mzs_ops_visit_correction_requests(requested_by);
create index if not exists ops_correction_visit_order_idx on public.mzs_ops_visit_correction_requests(visit_id,sequence_no desc);
create index if not exists ops_correction_decision_actor_idx on public.mzs_ops_visit_correction_decisions(decided_by);
create index if not exists ops_event_actor_idx on public.mzs_ops_maintenance_events(actor_id);
create index if not exists ops_event_responsible_idx on public.mzs_ops_maintenance_events(responsible_profile_id);
comment on table public.mzs_ops_visit_correction_requests is 'Append-only corrections before or after review; each approved revision needs a new review. Original minutes never change.';
commit;
