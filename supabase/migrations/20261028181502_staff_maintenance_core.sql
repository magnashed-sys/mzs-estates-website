-- Reviewed staff core, no seeds or pilot data migration. Existing Staging foundation is preserved.
begin;
do $install$ begin
if to_regclass('public.mzs_ops_staff_scope_events') is null then
 execute $foundation$
-- PROPERTY OPERATIONS STAFF + MAINTENANCE
-- Employee grants never alter profiles.role.
-- Scope is append-only: explicit grant/revoke events per profile and physical property.


create table public.mzs_ops_staff_scope_events (
 id uuid primary key default gen_random_uuid(),
 sequence_no bigint generated always as identity unique,
 profile_id uuid not null references public.profiles(id) on delete restrict,
 property_id uuid not null references public.mzs_estate_properties(id) on delete restrict,
 action text not null check (action in ('grant','revoke')),
 reason text not null check (length(btrim(reason)) between 8 and 500),
 recorded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index ops_staff_event_scope on public.mzs_ops_staff_scope_events(profile_id,property_id,sequence_no desc);
alter table public.mzs_ops_staff_scope_events enable row level security;
revoke all on public.mzs_ops_staff_scope_events from public,anon,authenticated,service_role;
grant select on public.mzs_ops_staff_scope_events to authenticated;
grant insert(profile_id,property_id,action,reason) on public.mzs_ops_staff_scope_events to authenticated;
create policy ops_staff_events_admin_read on public.mzs_ops_staff_scope_events
 for select to authenticated using ((select public.is_admin()));
create policy ops_staff_events_admin_add on public.mzs_ops_staff_scope_events
 for insert to authenticated with check ((select public.is_admin())
    and recorded_by=(select auth.uid()));

create function mzs_private.ops_validate_staff_scope_event()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare previous_action text;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
   or new.recorded_by is distinct from (select auth.uid())
 then raise exception 'Active Group Administrator required' using errcode='42501';end if;
 -- A person stays a Client/Partner. This creates a strictly narrow additional scope.
 if not exists(select 1 from public.profiles p where p.id=new.profile_id
   and p.is_active=true and p.role::text in ('client','partner'))
 then raise exception 'Target account must be an active client or partner';end if;
 -- Serialize changes to this profile's set of property grants.
 perform 1 from public.profiles where id=new.profile_id for update;
 select e.action into previous_action from public.mzs_ops_staff_scope_events e
 where e.profile_id=new.profile_id and e.property_id=new.property_id
 order by e.sequence_no desc limit 1;
 if (new.action='grant' and previous_action='grant') or
   (new.action='revoke' and previous_action is distinct from 'grant')
 then raise exception 'Scope already has this state';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_staff_scope_event()
 from public,anon,authenticated,service_role;
create trigger ops_staff_scope_event_guard before insert on public.mzs_ops_staff_scope_events
 for each row execute function mzs_private.ops_validate_staff_scope_event();

-- Called only from RLS policy; the function is in a non-exposed schema.
create function mzs_private.ops_can_work_on_property(p_property_id uuid)
returns boolean language sql security definer stable set search_path='' as $fn$
 select exists(
  select 1 from public.profiles p
  where p.id=(select auth.uid()) and p.is_active=true and p.role::text in ('client','partner')
 ) and coalesce((
  select e.action='grant' from public.mzs_ops_staff_scope_events e
  where e.profile_id=(select auth.uid()) and e.property_id=p_property_id
  order by e.sequence_no desc limit 1
 ),false)
$fn$;
revoke all on function mzs_private.ops_can_work_on_property(uuid)
 from public,anon,service_role;
grant usage on schema mzs_private to authenticated;
grant execute on function mzs_private.ops_can_work_on_property(uuid) to authenticated;

create table public.mzs_ops_staff_visits (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 property_id uuid not null references public.mzs_estate_properties(id) on delete restrict,
 unit_id uuid references public.mzs_estate_units(id) on delete restrict,
 worked_on date not null,
 actual_minutes integer not null check (actual_minutes between 1 and 960),
 task_category text not null check (task_category in
  ('cleaning','inspection','maintenance','gardening','guest_service','other')),
 description text not null check(length(btrim(description)) between 3 and 1500),
 created_at timestamptz not null default now()
);
create index ops_staff_visits_actor_date on public.mzs_ops_staff_visits(profile_id,worked_on desc);
create index ops_staff_visits_property_date on public.mzs_ops_staff_visits(property_id,worked_on desc);
alter table public.mzs_ops_staff_visits enable row level security;
revoke all on public.mzs_ops_staff_visits from public,anon,authenticated,service_role;
grant select on public.mzs_ops_staff_visits to authenticated;
grant insert(property_id,unit_id,worked_on,actual_minutes,task_category,description)
 on public.mzs_ops_staff_visits to authenticated;
create policy ops_staff_visits_admin_or_self_read on public.mzs_ops_staff_visits
 for select to authenticated using((select public.is_admin()) or
  (profile_id=(select auth.uid()) and
   (select mzs_private.ops_can_work_on_property(property_id))));
create policy ops_staff_visits_self_write on public.mzs_ops_staff_visits
 for insert to authenticated with check(
  profile_id=(select auth.uid()) and
  (select mzs_private.ops_can_work_on_property(property_id))
 );
create function mzs_private.ops_validate_staff_visit()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if new.profile_id is distinct from (select auth.uid()) or
    not mzs_private.ops_can_work_on_property(new.property_id)
 then raise exception 'Staff access to this property is not granted' using errcode='42501';end if;
 if new.unit_id is not null and not exists(select 1 from public.mzs_estate_units u
   where u.id=new.unit_id and u.property_id=new.property_id)
 then raise exception 'Unit is not part of this property';end if;
 if new.worked_on>current_date+1 or new.worked_on<current_date-366
 then raise exception 'Date outside supported staff-entry period';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_staff_visit()
 from public,anon,authenticated,service_role;
create trigger ops_staff_visit_guard before insert on public.mzs_ops_staff_visits
 for each row execute function mzs_private.ops_validate_staff_visit();

create table public.mzs_ops_maintenance_tickets (
 id uuid primary key default gen_random_uuid(),
 reported_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 property_id uuid not null references public.mzs_estate_properties(id) on delete restrict,
 unit_id uuid references public.mzs_estate_units(id) on delete restrict,
 priority text not null check(priority in ('routine','soon','urgent')),
 title text not null check(length(btrim(title)) between 5 and 140),
 description text not null check(length(btrim(description)) between 8 and 3000),
 status text not null default 'reported' check(status='reported'),
 created_at timestamptz not null default now()
);
create index ops_ticket_property_date on public.mzs_ops_maintenance_tickets(property_id,created_at desc);
alter table public.mzs_ops_maintenance_tickets enable row level security;
revoke all on public.mzs_ops_maintenance_tickets from public,anon,authenticated,service_role;
grant select on public.mzs_ops_maintenance_tickets to authenticated;
grant insert(property_id,unit_id,priority,title,description)
 on public.mzs_ops_maintenance_tickets to authenticated;
-- Staff can see their own tickets while assigned. They cannot see other
-- members' tickets, commercial budgets, invoices or loan dossiers.
create policy ops_tickets_admin_or_self_read on public.mzs_ops_maintenance_tickets
 for select to authenticated using ((select public.is_admin()) or
  (reported_by=(select auth.uid()) and
   (select mzs_private.ops_can_work_on_property(property_id))));
create policy ops_tickets_staff_insert on public.mzs_ops_maintenance_tickets
 for insert to authenticated with check(
  reported_by=(select auth.uid()) and
  (select mzs_private.ops_can_work_on_property(property_id))
 );
create function mzs_private.ops_validate_ticket()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if new.reported_by is distinct from (select auth.uid()) or
    not mzs_private.ops_can_work_on_property(new.property_id)
 then raise exception 'Ticket reporter is not assigned to this property' using errcode='42501';end if;
 if new.unit_id is not null and not exists(select 1 from public.mzs_estate_units u
   where u.id=new.unit_id and u.property_id=new.property_id)
 then raise exception 'Ticket unit does not belong to the property';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_ticket()
 from public,anon,authenticated,service_role;
create trigger ops_ticket_guard before insert on public.mzs_ops_maintenance_tickets
 for each row execute function mzs_private.ops_validate_ticket();

-- Dedicated narrow directory views: staff must NOT receive the existing
-- properties/units SELECT policies, which would expose tenant and owner data.
-- The views use explicit current-actor filtering and expose only safe labels.
create view public.mzs_ops_staff_property_directory
 with (security_barrier=true) as
 select p.id,p.name,p.address
 from public.mzs_estate_properties p
 where mzs_private.ops_can_work_on_property(p.id);
create view public.mzs_ops_staff_unit_directory
 with (security_barrier=true) as
 select u.id,u.property_id,u.address
 from public.mzs_estate_units u
 where mzs_private.ops_can_work_on_property(u.property_id);
revoke all on public.mzs_ops_staff_property_directory from public,anon,authenticated,service_role;
revoke all on public.mzs_ops_staff_unit_directory from public,anon,authenticated,service_role;
grant select on public.mzs_ops_staff_property_directory,public.mzs_ops_staff_unit_directory
 to authenticated;

comment on table public.mzs_ops_staff_visits is
 'Actual minutes per individual staff visit. No automatically generated billable minutes, wages or invoices.';
comment on table public.mzs_ops_maintenance_tickets is
 'Reported-only maintenance; no automatic orders, supplier invoices, photos, payments or owner-stay access.';

-- replace security-definer directory views with SECURITY INVOKER
-- views calling strictly-scoped helper functions in the unexposed private schema.

create function mzs_private.ops_staff_property_labels()
returns table (id uuid,name text,address text)
language sql security definer stable set search_path='' as $fn$
 select p.id,p.name,p.address
 from public.mzs_estate_properties p
 where mzs_private.ops_can_work_on_property(p.id)
$fn$;
create function mzs_private.ops_staff_unit_labels()
returns table (id uuid,property_id uuid,address text)
language sql security definer stable set search_path='' as $fn$
 select u.id,u.property_id,u.address
 from public.mzs_estate_units u
 where mzs_private.ops_can_work_on_property(u.property_id)
$fn$;
revoke all on function mzs_private.ops_staff_property_labels()
 from public,anon,authenticated,service_role;
revoke all on function mzs_private.ops_staff_unit_labels()
 from public,anon,authenticated,service_role;
grant execute on function mzs_private.ops_staff_property_labels() to authenticated;
grant execute on function mzs_private.ops_staff_unit_labels() to authenticated;

create or replace view public.mzs_ops_staff_property_directory
 with (security_invoker=true,security_barrier=true) as
 select p.id,p.name,p.address from mzs_private.ops_staff_property_labels() p;
create or replace view public.mzs_ops_staff_unit_directory
 with (security_invoker=true,security_barrier=true) as
 select u.id,u.property_id,u.address from mzs_private.ops_staff_unit_labels() u;
revoke all on public.mzs_ops_staff_property_directory from public,anon,authenticated,service_role;
revoke all on public.mzs_ops_staff_unit_directory from public,anon,authenticated,service_role;
grant select on public.mzs_ops_staff_property_directory,public.mzs_ops_staff_unit_directory
 to authenticated;

comment on view public.mzs_ops_staff_property_directory is
 'Security-invoker narrow directory. Every property row comes from an authenticated current-profile scope check in a private helper.';
comment on view public.mzs_ops_staff_unit_directory is
 'Security-invoker narrow unit names. Never exposes tenant/owner details in full physical registers.';

-- staff visit approval and maintenance ticket workflow.
-- All decisions are append-only. The original visit/time or issue is immutable.
-- Billable minutes are a REVIEW CANDIDATE; never invoice, wages, tax or cash.


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

-- auditable staff correction requests, internal maintenance work orders,
-- and private property-scoped maintenance photo evidence.
-- No automatic vendor commitment, payments, email, client invoice, or corrected billing.


create table public.mzs_ops_visit_correction_requests (
 id uuid primary key default gen_random_uuid(),
 visit_id uuid not null unique references public.mzs_ops_staff_visits(id) on delete restrict,
 proposed_minutes integer not null check (proposed_minutes between 1 and 960),
 reason text not null check(length(btrim(reason)) between 10 and 1000 and reason !~ '[[:cntrl:]]'),
 requested_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index ops_visit_correction_visit on public.mzs_ops_visit_correction_requests(visit_id);
alter table public.mzs_ops_visit_correction_requests enable row level security;
revoke all on public.mzs_ops_visit_correction_requests from public,anon,authenticated,service_role;
grant select on public.mzs_ops_visit_correction_requests to authenticated;
grant insert(visit_id,proposed_minutes,reason) on public.mzs_ops_visit_correction_requests to authenticated;
create policy ops_visit_correction_read on public.mzs_ops_visit_correction_requests
 for select to authenticated using (
 (select public.is_admin()) or
 (requested_by=(select auth.uid()) and exists(
  select 1 from public.mzs_ops_staff_visits v where v.id=visit_id and v.profile_id=(select auth.uid())
   and (select mzs_private.ops_can_work_on_property(v.property_id))))
 );
create policy ops_visit_correction_insert on public.mzs_ops_visit_correction_requests
 for insert to authenticated with check (
 requested_by=(select auth.uid()) and
 (select public.is_admin() or exists(
  select 1 from public.mzs_ops_staff_visits v where v.id=visit_id and v.profile_id=(select auth.uid())
    and (select mzs_private.ops_can_work_on_property(v.property_id))))
 );
create function mzs_private.ops_validate_visit_correction_request()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare original public.mzs_ops_staff_visits;
begin
 if (select auth.uid()) is null or new.requested_by is distinct from (select auth.uid())
 then raise exception 'Authenticated request author required' using errcode='42501';end if;
 select * into original from public.mzs_ops_staff_visits where id=new.visit_id for update;
 if not found then raise exception 'Visit missing';end if;
 if not ( (select public.is_admin()) or
  (original.profile_id=(select auth.uid()) and mzs_private.ops_can_work_on_property(original.property_id)))
 then raise exception 'Only creator or administrator may request visit correction' using errcode='42501';end if;
 if exists(select 1 from public.mzs_ops_visit_reviews r where r.visit_id=new.visit_id)
 then raise exception 'Reviewed visits require separate supervisor reassessment; original preserved';end if;
 if exists(select 1 from public.mzs_ops_visit_correction_requests c where c.visit_id=new.visit_id)
 then raise exception 'A correction proposal already exists';end if;
 if original.actual_minutes=new.proposed_minutes
 then raise exception 'Correction must change actual minutes';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_visit_correction_request() from public,anon,authenticated,service_role;
create trigger ops_visit_correction_request_guard before insert on public.mzs_ops_visit_correction_requests
 for each row execute function mzs_private.ops_validate_visit_correction_request();

create table public.mzs_ops_visit_correction_decisions (
 id uuid primary key default gen_random_uuid(),
 correction_id uuid not null unique references public.mzs_ops_visit_correction_requests(id) on delete restrict,
 decision text not null check(decision in ('approved','rejected')),
 reason text not null check(length(btrim(reason)) between 8 and 1000 and reason !~ '[[:cntrl:]]'),
 decided_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 decided_at timestamptz not null default now()
);
alter table public.mzs_ops_visit_correction_decisions enable row level security;
revoke all on public.mzs_ops_visit_correction_decisions from public,anon,authenticated,service_role;
grant select on public.mzs_ops_visit_correction_decisions to authenticated;
grant insert(correction_id,decision,reason) on public.mzs_ops_visit_correction_decisions to authenticated;
create policy ops_visit_correction_decision_read on public.mzs_ops_visit_correction_decisions
 for select to authenticated using ((select public.is_admin()) or exists(
 select 1 from public.mzs_ops_visit_correction_requests r
 join public.mzs_ops_staff_visits v on v.id=r.visit_id
 where r.id=correction_id and v.profile_id=(select auth.uid()) and
 (select mzs_private.ops_can_work_on_property(v.property_id))));
create policy ops_visit_correction_decision_insert on public.mzs_ops_visit_correction_decisions
 for insert to authenticated with check ((select public.is_admin()) and decided_by=(select auth.uid()));
create function mzs_private.ops_validate_visit_correction_decision()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare proposed public.mzs_ops_visit_correction_requests;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
 or new.decided_by is distinct from (select auth.uid()) then
 raise exception 'Group Admin must decide correction' using errcode='42501';end if;
 select * into proposed from public.mzs_ops_visit_correction_requests where id=new.correction_id for update;
 if not found then raise exception 'Correction request missing';end if;
 perform 1 from public.mzs_ops_staff_visits where id=proposed.visit_id for update;
 if exists(select 1 from public.mzs_ops_visit_reviews where visit_id=proposed.visit_id)
 then raise exception 'Visit has already been reviewed';end if;
 if exists(select 1 from public.mzs_ops_visit_correction_decisions where correction_id=new.correction_id)
 then raise exception 'Correction already decided';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_visit_correction_decision() from public,anon,authenticated,service_role;
create trigger ops_visit_correction_decision_guard before insert on public.mzs_ops_visit_correction_decisions
 for each row execute function mzs_private.ops_validate_visit_correction_decision();

-- If a correction is requested, the supervisor must resolve it before any time
-- review. Approved correction changes the REVIEWED working-time snapshot only,
-- not the immutable worker-submitted actual_minutes.
create or replace function mzs_private.ops_validate_visit_review()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare visit public.mzs_ops_staff_visits;
 corrected_minutes integer;
 requested uuid;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
 or new.reviewed_by is distinct from (select auth.uid())
 then raise exception 'Only active Group Administrator may review visits' using errcode='42501';end if;
 select * into visit from public.mzs_ops_staff_visits where id=new.visit_id for update;
 if not found then raise exception 'Original visit not found';end if;
 if exists(select 1 from public.mzs_ops_visit_reviews where visit_id=visit.id)
 then raise exception 'Visit already reviewed';end if;
 corrected_minutes:=visit.actual_minutes;
 select c.id into requested from public.mzs_ops_visit_correction_requests c where c.visit_id=visit.id;
 if requested is not null then
  if not exists(select 1 from public.mzs_ops_visit_correction_decisions x
   where x.correction_id=requested)
  then raise exception 'Pending staff correction must be decided before review';end if;
  select c.proposed_minutes into corrected_minutes
   from public.mzs_ops_visit_correction_requests c
   join public.mzs_ops_visit_correction_decisions x on x.correction_id=c.id
   where c.id=requested and x.decision='approved';
  corrected_minutes:=coalesce(corrected_minutes,visit.actual_minutes);
 end if;
 if new.decision='approved' and new.recharge_class='review_candidate' then
  if new.minimum_minutes is null or new.increment_minutes is null or
    new.minimum_minutes<0 or new.increment_minutes<=0 then
   raise exception 'Explicit per-visit billing rule required';end if;
  new.billable_minutes:=greatest(new.minimum_minutes,
     ((corrected_minutes+new.increment_minutes-1)/new.increment_minutes)*new.increment_minutes);
  if new.billable_minutes>2000 then raise exception 'Candidate billing duration exceeds limit';end if;
 else
  if new.minimum_minutes is not null or new.increment_minutes is not null then
   raise exception 'No billing rule allowed for internal or rejected time';end if;
  new.billable_minutes:=0;
 end if;
 return new;
end $fn$;


$foundation$;
end if;
end $install$;
commit;
