-- MZS Group — isolated, default-OFF Property Operations pilot / REVIEW-ONLY DDL PLAN.
-- Not a migration. Do not execute on Production without separate owner approval.
-- Self-contained pilot register: NOTHING here inserts into leases, bookings, invoices,
-- capital, financial cockpit, staff production tables or customer email queues.
begin;

create table public.mzs_ops_pilot_runs (
 id uuid primary key default gen_random_uuid(),
 property_id uuid not null references public.mzs_estate_properties(id) on delete restrict,
 purpose text not null check(length(btrim(purpose)) between 12 and 300 and purpose !~ '[[:cntrl:]]'),
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index ops_pilot_runs_property on public.mzs_ops_pilot_runs(property_id);
alter table public.mzs_ops_pilot_runs enable row level security;
revoke all on public.mzs_ops_pilot_runs from public,anon,authenticated,service_role;
grant select on public.mzs_ops_pilot_runs to authenticated;
grant insert(property_id,purpose) on public.mzs_ops_pilot_runs to authenticated;
create policy ops_pilot_runs_admin_read on public.mzs_ops_pilot_runs
 for select to authenticated using ((select public.is_admin()));
create policy ops_pilot_runs_admin_write on public.mzs_ops_pilot_runs
 for insert to authenticated with check ((select public.is_admin()) and created_by=(select auth.uid()));

create table public.mzs_ops_pilot_run_events (
 id uuid primary key default gen_random_uuid(),
 sequence_no bigint generated always as identity unique,
 run_id uuid not null references public.mzs_ops_pilot_runs(id) on delete restrict,
 action text not null check(action in ('activate','deactivate')),
 reason text not null check(length(btrim(reason)) between 10 and 500 and reason !~ '[[:cntrl:]]'),
 recorded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index ops_pilot_run_events_latest on public.mzs_ops_pilot_run_events(run_id,sequence_no desc);
alter table public.mzs_ops_pilot_run_events enable row level security;
revoke all on public.mzs_ops_pilot_run_events from public,anon,authenticated,service_role;
grant select on public.mzs_ops_pilot_run_events to authenticated;
grant insert(run_id,action,reason) on public.mzs_ops_pilot_run_events to authenticated;
create policy ops_pilot_run_events_admin_read on public.mzs_ops_pilot_run_events
 for select to authenticated using ((select public.is_admin()));
create policy ops_pilot_run_events_admin_add on public.mzs_ops_pilot_run_events
 for insert to authenticated with check ((select public.is_admin()) and recorded_by=(select auth.uid()));

-- No run is enabled on creation: only an explicit, immutable ACTIVATE event enables it.
create function mzs_private.ops_pilot_run_active(p_run_id uuid)
returns boolean language sql stable security definer set search_path='' as $fn$
 select coalesce((
  select e.action='activate' from public.mzs_ops_pilot_run_events e
  where e.run_id=p_run_id order by e.sequence_no desc limit 1
 ),false)
$fn$;
revoke all on function mzs_private.ops_pilot_run_active(uuid)
 from public,anon,authenticated,service_role;

create function mzs_private.ops_pilot_validate_run_event()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare target public.mzs_ops_pilot_runs;previous text;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
    or new.recorded_by is distinct from (select auth.uid())
 then raise exception 'Active Group Administrator required' using errcode='42501';end if;
 select * into target from public.mzs_ops_pilot_runs where id=new.run_id for update;
 if not found then raise exception 'Pilot run missing';end if;
 -- Serialize activation of distinct runs on the same physical property.
 perform 1 from public.mzs_estate_properties where id=target.property_id for update;
 select e.action into previous from public.mzs_ops_pilot_run_events e
  where e.run_id=new.run_id order by e.sequence_no desc limit 1;
 if (new.action='activate' and previous is not null)
  or (new.action='deactivate' and previous is distinct from 'activate')
 then raise exception 'Pilot run can activate only once and deactivate only after activation';end if;
 if new.action='activate' and exists(
  select 1 from public.mzs_ops_pilot_runs r where r.property_id=target.property_id
   and r.id<>target.id and mzs_private.ops_pilot_run_active(r.id)
 ) then raise exception 'Another pilot is active for this property';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_pilot_validate_run_event()
 from public,anon,authenticated,service_role;
create trigger ops_pilot_run_event_guard before insert on public.mzs_ops_pilot_run_events
 for each row execute function mzs_private.ops_pilot_validate_run_event();

create table public.mzs_ops_pilot_access_events (
 id uuid primary key default gen_random_uuid(),
 sequence_no bigint generated always as identity unique,
 run_id uuid not null references public.mzs_ops_pilot_runs(id) on delete restrict,
 profile_id uuid not null references public.profiles(id) on delete restrict,
 action text not null check(action in ('grant','revoke')),
 reason text not null check(length(btrim(reason)) between 10 and 500 and reason !~ '[[:cntrl:]]'),
 recorded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index ops_pilot_access_latest on public.mzs_ops_pilot_access_events(run_id,profile_id,sequence_no desc);
alter table public.mzs_ops_pilot_access_events enable row level security;
revoke all on public.mzs_ops_pilot_access_events from public,anon,authenticated,service_role;
grant select on public.mzs_ops_pilot_access_events to authenticated;
grant insert(run_id,profile_id,action,reason) on public.mzs_ops_pilot_access_events to authenticated;
create policy ops_pilot_access_admin_read on public.mzs_ops_pilot_access_events
 for select to authenticated using ((select public.is_admin()));
create policy ops_pilot_access_admin_add on public.mzs_ops_pilot_access_events
 for insert to authenticated with check ((select public.is_admin()) and recorded_by=(select auth.uid()));

create function mzs_private.ops_pilot_validate_access_event()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare previous text;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
    or new.recorded_by is distinct from (select auth.uid())
 then raise exception 'Active Group Administrator required' using errcode='42501';end if;
 perform 1 from public.mzs_ops_pilot_runs where id=new.run_id for update;
 if not found then raise exception 'Pilot run missing';end if;
 if new.action='grant' and (
  not mzs_private.ops_pilot_run_active(new.run_id)
  or not exists(select 1 from public.profiles p
    where p.id=new.profile_id and p.is_active=true and p.role::text in ('client','partner'))
 ) then raise exception 'Enabled run and active client/partner required';end if;
 select e.action into previous from public.mzs_ops_pilot_access_events e
  where e.run_id=new.run_id and e.profile_id=new.profile_id
  order by e.sequence_no desc limit 1;
 if (new.action='grant' and previous='grant')
    or (new.action='revoke' and previous is distinct from 'grant')
 then raise exception 'Pilot scope already has this state';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_pilot_validate_access_event()
 from public,anon,authenticated,service_role;
create trigger ops_pilot_access_event_guard before insert on public.mzs_ops_pilot_access_events
 for each row execute function mzs_private.ops_pilot_validate_access_event();

-- The worker's identity comes only from Supabase authentication, not browser form data.
create function mzs_private.ops_pilot_can_work(p_run_id uuid)
returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.profiles p
   where p.id=(select auth.uid()) and p.is_active=true and p.role::text in ('client','partner'))
  and mzs_private.ops_pilot_run_active(p_run_id)
  and coalesce((
   select e.action='grant' from public.mzs_ops_pilot_access_events e
    where e.run_id=p_run_id and e.profile_id=(select auth.uid())
    order by e.sequence_no desc limit 1
  ),false)
$fn$;
revoke all on function mzs_private.ops_pilot_can_work(uuid)
 from public,anon,service_role;
grant usage on schema mzs_private to authenticated;
grant execute on function mzs_private.ops_pilot_can_work(uuid) to authenticated;

-- Only narrow safe labels, never the full ownership/tenant/property register.
create function mzs_private.ops_pilot_my_property_labels()
returns table(run_id uuid,property_id uuid,property_name text,property_address text)
language sql stable security definer set search_path='' as $fn$
 select r.id,r.property_id,p.name,p.address
 from public.mzs_ops_pilot_runs r
 join public.mzs_estate_properties p on p.id=r.property_id
 where mzs_private.ops_pilot_can_work(r.id)
$fn$;
revoke all on function mzs_private.ops_pilot_my_property_labels()
 from public,anon,service_role;
grant execute on function mzs_private.ops_pilot_my_property_labels() to authenticated;
create view public.mzs_ops_pilot_my_properties
 with (security_invoker=true,security_barrier=true) as
 select x.run_id,x.property_id,x.property_name,x.property_address
 from mzs_private.ops_pilot_my_property_labels() x;
revoke all on public.mzs_ops_pilot_my_properties from public,anon,authenticated,service_role;
grant select on public.mzs_ops_pilot_my_properties to authenticated;

create table public.mzs_ops_pilot_visits (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.mzs_ops_pilot_runs(id) on delete restrict,
 property_id uuid not null references public.mzs_estate_properties(id) on delete restrict,
 submitted_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 worked_on date not null,
 actual_minutes integer not null check(actual_minutes between 1 and 960),
 description text not null check(length(btrim(description)) between 8 and 1200 and description !~ '[[:cntrl:]]'),
 created_at timestamptz not null default now()
);
create index ops_pilot_visits_run_actor on public.mzs_ops_pilot_visits(run_id,submitted_by,worked_on desc);
alter table public.mzs_ops_pilot_visits enable row level security;
revoke all on public.mzs_ops_pilot_visits from public,anon,authenticated,service_role;
grant select on public.mzs_ops_pilot_visits to authenticated;
grant insert(run_id,property_id,worked_on,actual_minutes,description)
 on public.mzs_ops_pilot_visits to authenticated;
create policy ops_pilot_visit_read on public.mzs_ops_pilot_visits
 for select to authenticated using ((select public.is_admin()) or
  (submitted_by=(select auth.uid()) and (select mzs_private.ops_pilot_can_work(run_id))));
create policy ops_pilot_visit_add on public.mzs_ops_pilot_visits
 for insert to authenticated with check (
  submitted_by=(select auth.uid()) and (select mzs_private.ops_pilot_can_work(run_id)));

create table public.mzs_ops_pilot_tickets (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.mzs_ops_pilot_runs(id) on delete restrict,
 property_id uuid not null references public.mzs_estate_properties(id) on delete restrict,
 reported_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 priority text not null check(priority in ('routine','soon','urgent')),
 title text not null check(length(btrim(title)) between 5 and 120 and title !~ '[[:cntrl:]]'),
 description text not null check(length(btrim(description)) between 8 and 1200 and description !~ '[[:cntrl:]]'),
 created_at timestamptz not null default now()
);
create index ops_pilot_tickets_run_reporter on public.mzs_ops_pilot_tickets(run_id,reported_by,created_at desc);
alter table public.mzs_ops_pilot_tickets enable row level security;
revoke all on public.mzs_ops_pilot_tickets from public,anon,authenticated,service_role;
grant select on public.mzs_ops_pilot_tickets to authenticated;
grant insert(run_id,property_id,priority,title,description)
 on public.mzs_ops_pilot_tickets to authenticated;
create policy ops_pilot_ticket_read on public.mzs_ops_pilot_tickets
 for select to authenticated using ((select public.is_admin()) or
  (reported_by=(select auth.uid()) and (select mzs_private.ops_pilot_can_work(run_id))));
create policy ops_pilot_ticket_add on public.mzs_ops_pilot_tickets
 for insert to authenticated with check (
  reported_by=(select auth.uid()) and (select mzs_private.ops_pilot_can_work(run_id)));

-- Never trust a browser-supplied property ID to match the selected pilot run.
create function mzs_private.ops_pilot_validate_record()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare target_property uuid;record_actor uuid;
begin
 select r.property_id into target_property from public.mzs_ops_pilot_runs r where r.id=new.run_id;
 if not found or new.property_id is distinct from target_property
 then raise exception 'Pilot run and physical property mismatch' using errcode='42501';end if;
 if TG_TABLE_NAME='mzs_ops_pilot_visits' then
  record_actor:=new.submitted_by;
  if new.worked_on>current_date+1 or new.worked_on<current_date-366
  then raise exception 'Pilot visit date outside accepted range';end if;
 else
  record_actor:=new.reported_by;
 end if;
 if record_actor is distinct from (select auth.uid())
    or not mzs_private.ops_pilot_can_work(new.run_id)
 then raise exception 'No current pilot assignment' using errcode='42501';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_pilot_validate_record()
 from public,anon,authenticated,service_role;
create trigger ops_pilot_visit_guard before insert on public.mzs_ops_pilot_visits
 for each row execute function mzs_private.ops_pilot_validate_record();
create trigger ops_pilot_ticket_guard before insert on public.mzs_ops_pilot_tickets
 for each row execute function mzs_private.ops_pilot_validate_record();

comment on table public.mzs_ops_pilot_runs is 'Trial runs are disabled until administrator appends ACTIVATE; pilot only, no real money.';
comment on table public.mzs_ops_pilot_visits is 'Synthetic pilot records never feed payroll, invoices, Financial Cockpit or accountant export.';
comment on table public.mzs_ops_pilot_tickets is 'Synthetic maintenance tickets, no external orders, photos or supplier notifications.';
commit;
