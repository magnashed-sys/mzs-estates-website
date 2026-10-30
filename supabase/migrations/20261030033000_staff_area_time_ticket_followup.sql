-- Operational-area time and staff-only maintenance progress notes.
-- No fake property records, no payroll/invoices, and no staff changes to admin ticket status.
begin;
set local lock_timeout='3s';

alter table public.mzs_ops_staff_visits
 add column work_area_id text references public.mzs_ops_staff_work_areas(id) on delete restrict;
alter table public.mzs_ops_staff_visits alter column property_id drop not null;
alter table public.mzs_ops_staff_visits
 add constraint ops_visit_location_exactly_one check(
  (property_id is not null and work_area_id is null)
  or (property_id is null and work_area_id is not null and unit_id is null)
 );
create index ops_staff_visit_area on public.mzs_ops_staff_visits(work_area_id,worked_on desc)
 where work_area_id is not null;
grant insert(work_area_id) on public.mzs_ops_staff_visits to authenticated;
drop policy ops_staff_visits_admin_or_self_read on public.mzs_ops_staff_visits;
create policy ops_staff_visits_admin_or_self_read on public.mzs_ops_staff_visits
 for select to authenticated using(
  (select public.is_admin()) or
  (profile_id=(select auth.uid()) and
    ((property_id is not null and mzs_private.ops_can_work_on_property(property_id))
     or (work_area_id is not null and mzs_private.ops_can_work_on_area(work_area_id))))
 );
drop policy ops_staff_visits_self_write on public.mzs_ops_staff_visits;
create policy ops_staff_visits_self_write on public.mzs_ops_staff_visits
 for insert to authenticated with check(
  profile_id=(select auth.uid()) and
  ((property_id is not null and mzs_private.ops_can_work_on_property(property_id))
   or (work_area_id is not null and mzs_private.ops_can_work_on_area(work_area_id)))
 );

create or replace function mzs_private.ops_validate_staff_visit()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if auth.uid() is null or new.profile_id is distinct from auth.uid()
  then raise exception 'Staff visit author mismatch' using errcode='42501';end if;
 if (new.property_id is null)=(new.work_area_id is null) or
    (new.work_area_id is not null and new.unit_id is not null)
  then raise exception 'Choose exactly one real property or operational area' using errcode='22023';end if;
 if not ((new.property_id is not null and mzs_private.ops_can_work_on_property(new.property_id))
  or (new.work_area_id is not null and mzs_private.ops_can_work_on_area(new.work_area_id)))
  then raise exception 'Staff work location access denied' using errcode='42501';end if;
 if new.unit_id is not null and not exists(select 1 from public.mzs_estate_units u
  where u.id=new.unit_id and u.property_id=new.property_id)
  then raise exception 'Unit must belong to visit property' using errcode='22023';end if;
 if new.worked_on>current_date+1 or new.worked_on<current_date-366
  then raise exception 'Staff work date out of permitted range' using errcode='22023';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_staff_visit() from public,anon,authenticated,service_role;

create or replace function mzs_private.ops_staff_visit_task_guard()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare t public.mzs_ops_property_tasks;
begin
 if new.task_id is null then return new;end if;
 select * into t from public.mzs_ops_property_tasks where id=new.task_id;
 if not found or t.assigned_profile_id is distinct from new.profile_id or
  t.property_id is distinct from new.property_id or
  t.work_area_id is distinct from new.work_area_id or
  (t.unit_id is not null and t.unit_id is distinct from new.unit_id)
  then raise exception 'Time entry must match assigned task location and worker' using errcode='22023';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_staff_visit_task_guard() from public,anon,authenticated,service_role;

-- Append new view column so existing admin/query dependencies retain their names/order.
create or replace view public.mzs_ops_current_visits
 with(security_invoker=true,security_barrier=true) as
 select v.id,v.profile_id,v.property_id,v.unit_id,v.worked_on,v.actual_minutes,v.task_category,
 v.description,v.created_at,
 c.id as correction_id,coalesce(c.proposed_minutes,v.actual_minutes) as effective_minutes,
 r.decision as review_decision,r.reason as review_reason,r.reviewed_at,
 exists(select 1 from public.mzs_ops_visit_correction_requests pc
 where pc.visit_id=v.id and not exists(select 1 from public.mzs_ops_visit_correction_decisions pd
 where pd.correction_id=pc.id)) as correction_pending,
 v.task_id, v.work_area_id
 from public.mzs_ops_staff_visits v
 left join lateral(
  select c.id,c.proposed_minutes from public.mzs_ops_visit_correction_requests c
  join public.mzs_ops_visit_correction_decisions d on d.correction_id=c.id and d.decision='approved'
  where c.visit_id=v.id order by c.sequence_no desc limit 1
 ) c on true
 left join public.mzs_ops_staff_review_status r
 on r.visit_id=v.id and r.correction_id is not distinct from c.id;
revoke all on public.mzs_ops_current_visits from public,anon,authenticated,service_role;
grant select on public.mzs_ops_current_visits to authenticated;

-- Reporter progress is an append-only audit trail; official ticket status,
-- planning, approval and supplier order remain admin-controlled.
create table public.mzs_ops_staff_ticket_notes(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.mzs_ops_maintenance_tickets(id) on delete restrict,
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 note_kind text not null check(note_kind in ('progress','blocked','ready_for_review')),
 note text not null check(length(btrim(note)) between 8 and 1500 and note !~ '[[:cntrl:]]'),
 created_at timestamptz not null default now()
);
create index ops_staff_ticket_notes_order on public.mzs_ops_staff_ticket_notes(ticket_id,created_at desc,id);
alter table public.mzs_ops_staff_ticket_notes enable row level security;
revoke all on public.mzs_ops_staff_ticket_notes from public,anon,authenticated,service_role;
grant select on public.mzs_ops_staff_ticket_notes to authenticated;
grant insert(ticket_id,note_kind,note) on public.mzs_ops_staff_ticket_notes to authenticated;
create policy ops_staff_ticket_notes_read on public.mzs_ops_staff_ticket_notes
 for select to authenticated using((select public.is_admin()) or
 (created_by=(select auth.uid()) and exists(
   select 1 from public.mzs_ops_maintenance_tickets t
   where t.id=ticket_id and t.reported_by=(select auth.uid())
    and mzs_private.ops_can_work_on_property(t.property_id))));
create policy ops_staff_ticket_notes_write on public.mzs_ops_staff_ticket_notes
 for insert to authenticated with check(
 created_by=(select auth.uid()) and exists(
  select 1 from public.mzs_ops_maintenance_tickets t
  where t.id=ticket_id and t.reported_by=(select auth.uid())
   and mzs_private.ops_can_work_on_property(t.property_id)
   and not exists(
    select 1 from public.mzs_ops_maintenance_events e
     where e.ticket_id=t.id and e.action='closed'
     and e.sequence_no=(select max(z.sequence_no) from public.mzs_ops_maintenance_events z where z.ticket_id=t.id)
   )
 ));
create or replace function mzs_private.ops_staff_ticket_note_guard()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_property uuid;v_reporter uuid;v_stage text;
begin
 if auth.uid() is null or new.created_by is distinct from auth.uid() then
  raise exception 'Note author mismatch' using errcode='42501';end if;
 select property_id,reported_by into v_property,v_reporter
  from public.mzs_ops_maintenance_tickets where id=new.ticket_id for update;
 if not found or v_reporter is distinct from auth.uid() or
  not mzs_private.ops_can_work_on_property(v_property) then
  raise exception 'Maintenance note access denied' using errcode='42501';end if;
 select action into v_stage from public.mzs_ops_maintenance_events where ticket_id=new.ticket_id
  order by sequence_no desc limit 1;
 if v_stage='closed' then raise exception 'Closed report cannot be changed by staff' using errcode='42501';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_staff_ticket_note_guard() from public,anon,authenticated,service_role;
create trigger ops_staff_ticket_note_guard before insert on public.mzs_ops_staff_ticket_notes
 for each row execute function mzs_private.ops_staff_ticket_note_guard();

create function mzs_private.ops_staff_ticket_note_immutable()
returns trigger language plpgsql set search_path='' as $fn$
begin raise exception 'Progress notes are immutable' using errcode='42501';end $fn$;
revoke all on function mzs_private.ops_staff_ticket_note_immutable() from public,anon,authenticated,service_role;
create trigger ops_staff_ticket_note_no_edit before update or delete on public.mzs_ops_staff_ticket_notes
 for each row execute function mzs_private.ops_staff_ticket_note_immutable();
commit;
