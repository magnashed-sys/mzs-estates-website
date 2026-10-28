-- PROPERTY OPERATIONS STAFF + MAINTENANCE — STAGING ONLY
-- NO Production changes; employee grants never alter profiles.role.
-- Scope is append-only: explicit grant/revoke events per profile and physical property.
begin;

create table public.mzs_ops_staff_scope_events (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete restrict,
 property_id uuid not null references public.mzs_estate_properties(id) on delete restrict,
 action text not null check (action in ('grant','revoke')),
 reason text not null check (length(btrim(reason)) between 8 and 500),
 recorded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index ops_staff_event_scope on public.mzs_ops_staff_scope_events(profile_id,property_id,created_at desc,id desc);
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
 order by e.created_at desc,e.id desc limit 1;
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
  order by e.created_at desc,e.id desc limit 1
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

comment on table public.mzs_ops_staff_visits is
 'Actual minutes per individual staff visit. No automatically generated billable minutes, wages or invoices.';
comment on table public.mzs_ops_maintenance_tickets is
 'Reported-only maintenance; no automatic orders, supplier invoices, photos, payments or owner-stay access.';
commit;
