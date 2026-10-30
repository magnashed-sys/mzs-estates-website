-- Property Manager operational work locations are NOT rental/owned properties.
-- They share the audited task workflow but never enter the estate property register.
begin;
set local lock_timeout='3s';

create table public.mzs_ops_staff_work_areas(
 id text primary key check(id in ('maintenance-beverwijk','private-magdy')),
 name text not null unique,
 created_at timestamptz not null default now()
);
insert into public.mzs_ops_staff_work_areas(id,name) values
 ('maintenance-beverwijk','Onderhoud Beverwijk'),
 ('private-magdy','Prive Magdy');
alter table public.mzs_ops_staff_work_areas enable row level security;
revoke all on public.mzs_ops_staff_work_areas from public,anon,authenticated,service_role;
grant select on public.mzs_ops_staff_work_areas to authenticated;

create table public.mzs_ops_staff_area_scopes(
 id uuid primary key default gen_random_uuid(),
 sequence_no bigint generated always as identity unique,
 profile_id uuid not null references public.profiles(id) on delete restrict,
 area_id text not null references public.mzs_ops_staff_work_areas(id) on delete restrict,
 action text not null check(action in ('grant','revoke')),
 recorded_by uuid not null references public.profiles(id) on delete restrict,
 reason text not null check(length(btrim(reason)) between 8 and 500),
 recorded_at timestamptz not null default now()
);
create index ops_area_scope_latest on public.mzs_ops_staff_area_scopes(profile_id,area_id,sequence_no desc);
alter table public.mzs_ops_staff_area_scopes enable row level security;
revoke all on public.mzs_ops_staff_area_scopes from public,anon,authenticated,service_role;
grant select on public.mzs_ops_staff_area_scopes to authenticated;
create policy ops_area_scope_admin on public.mzs_ops_staff_area_scopes
 for select to authenticated using ((select public.is_admin()));

create function mzs_private.ops_can_work_on_area_as(p_profile uuid,p_area text)
returns boolean language sql stable security definer set search_path='' as $fn$
 select exists (select 1 from public.profiles p
  where p.id=p_profile and p.is_active and p.role::text in ('client','partner'))
 and coalesce((
  select e.action='grant' from public.mzs_ops_staff_area_scopes e
  where e.profile_id=p_profile and e.area_id=p_area
  order by e.sequence_no desc limit 1
 ),false)
$fn$;
revoke all on function mzs_private.ops_can_work_on_area_as(uuid,text) from public,anon,authenticated,service_role;
create function mzs_private.ops_can_work_on_area(p_area text)
returns boolean language sql stable security definer set search_path='' as $fn$
 select mzs_private.ops_can_work_on_area_as(auth.uid(),p_area)
$fn$;
revoke all on function mzs_private.ops_can_work_on_area(text) from public,anon,authenticated,service_role;
grant execute on function mzs_private.ops_can_work_on_area(text) to authenticated;

create policy ops_work_area_read on public.mzs_ops_staff_work_areas
 for select to authenticated using(
  (select public.is_admin()) or mzs_private.ops_can_work_on_area(id)
 );
create view public.mzs_ops_staff_work_area_directory with
 (security_barrier=true,security_invoker=true) as
 select id,name from public.mzs_ops_staff_work_areas
 where mzs_private.ops_can_work_on_area(id);
revoke all on public.mzs_ops_staff_work_area_directory from public,anon,authenticated,service_role;
grant select on public.mzs_ops_staff_work_area_directory to authenticated;

-- Grant ONLY the two existing property-management test/worker accounts.
insert into public.mzs_ops_staff_area_scopes(profile_id,area_id,action,recorded_by,reason)
select p.id,a.id,'grant',admin.id,'Owner-requested operational location for staff tasks; not a real-estate ownership record.'
from public.profiles p
cross join public.mzs_ops_staff_work_areas a
cross join lateral (select id from public.profiles
 where role::text='admin' and is_active order by id limit 1) admin
where lower(p.email) in ('info@mzsestates.es','ledders2@hotmail.com')
 and p.is_active and p.role::text in ('client','partner');

alter table public.mzs_ops_property_tasks add column work_area_id text
 references public.mzs_ops_staff_work_areas(id) on delete restrict;
alter table public.mzs_ops_property_tasks alter column property_id drop not null;
alter table public.mzs_ops_property_tasks
 add constraint ops_task_placement check(
  (property_id is not null and work_area_id is null)
  or (property_id is null and work_area_id is not null and unit_id is null)
 );
grant insert(work_area_id) on public.mzs_ops_property_tasks to authenticated;

drop policy ops_tasks_read on public.mzs_ops_property_tasks;
create policy ops_tasks_read on public.mzs_ops_property_tasks
 for select to authenticated using(
 (select public.is_admin()) OR
 (assigned_profile_id=(select auth.uid()) and
  ((property_id is not null and mzs_private.ops_can_work_on_property(property_id))
  or (work_area_id is not null and mzs_private.ops_can_work_on_area(work_area_id))))
 );
drop policy ops_tasks_write on public.mzs_ops_property_tasks;
create policy ops_tasks_write on public.mzs_ops_property_tasks
 for insert to authenticated with check(
 created_by=(select auth.uid()) and
 ((select public.is_admin()) OR
 (assigned_profile_id=(select auth.uid()) and
  ((property_id is not null and mzs_private.ops_can_work_on_property(property_id))
  or (work_area_id is not null and mzs_private.ops_can_work_on_area(work_area_id)))))
 );
drop policy ops_task_updates_read on public.mzs_ops_property_task_updates;
create policy ops_task_updates_read on public.mzs_ops_property_task_updates
 for select to authenticated using(
 (select public.is_admin()) or exists(
 select 1 from public.mzs_ops_property_tasks t
 where t.id=task_id and t.assigned_profile_id=(select auth.uid()) and
 ((t.property_id is not null and mzs_private.ops_can_work_on_property(t.property_id))
  or (t.work_area_id is not null and mzs_private.ops_can_work_on_area(t.work_area_id))))
 );
drop policy ops_task_updates_insert on public.mzs_ops_property_task_updates;
create policy ops_task_updates_insert on public.mzs_ops_property_task_updates
 for insert to authenticated with check(
 actor_id=(select auth.uid()) and
 ((select public.is_admin()) or exists(
 select 1 from public.mzs_ops_property_tasks t
 where t.id=task_id and t.assigned_profile_id=(select auth.uid()) and
 ((t.property_id is not null and mzs_private.ops_can_work_on_property(t.property_id))
  or (t.work_area_id is not null and mzs_private.ops_can_work_on_area(t.work_area_id))))
  ));

create or replace function mzs_private.ops_property_task_guard()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_active) then
  raise exception 'Active account required' using errcode='42501';end if;
 if (new.property_id is null)=(new.work_area_id is null) or
    (new.work_area_id is not null and new.unit_id is not null) then
  raise exception 'Exactly one property or operational area required' using errcode='22023';end if;
 if tg_op='UPDATE' then
  if public.is_admin() is distinct from true or new.id<>old.id or
     new.property_id is distinct from old.property_id or
     new.work_area_id is distinct from old.work_area_id or
     new.created_by<>old.created_by or new.created_at<>old.created_at then
    raise exception 'Only admin can edit task metadata' using errcode='42501';end if;
 else
  if new.created_by is distinct from auth.uid() then raise exception 'Task creator mismatch' using errcode='42501';end if;
  if not public.is_admin() and
   (new.assigned_profile_id is distinct from auth.uid() or not
    ((new.property_id is not null and mzs_private.ops_can_work_on_property(new.property_id))
    or (new.work_area_id is not null and mzs_private.ops_can_work_on_area(new.work_area_id)))) then
   raise exception 'Task scope denied' using errcode='42501';end if;
 end if;
 if new.unit_id is not null and not exists(
  select 1 from public.mzs_estate_units u where u.id=new.unit_id and u.property_id=new.property_id
 ) then raise exception 'Unit does not belong to task property' using errcode='22023';end if;
 if new.assigned_profile_id is not null and not exists(
  select 1 from public.profiles p where p.id=new.assigned_profile_id
   and p.is_active and p.role::text in ('client','partner') and
   ((new.property_id is not null and mzs_private.ops_can_work_on_property_as(p.id,new.property_id))
    or (new.work_area_id is not null and mzs_private.ops_can_work_on_area_as(p.id,new.work_area_id)))
 ) then raise exception 'Assignee lacks assigned location access' using errcode='22023';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_property_task_guard() from public,anon,authenticated,service_role;

create or replace function mzs_private.ops_property_task_update_guard()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare t public.mzs_ops_property_tasks;old_status text;is_manager boolean;
begin
 if auth.uid() is null or new.actor_id is distinct from auth.uid() then
  raise exception 'Authenticated task actor required' using errcode='42501';end if;
 select * into t from public.mzs_ops_property_tasks where id=new.task_id for update;
 if not found then raise exception 'Unknown task' using errcode='22023';end if;
 is_manager:=public.is_admin();
 if not is_manager and (t.assigned_profile_id is distinct from auth.uid() or not
  ((t.property_id is not null and mzs_private.ops_can_work_on_property(t.property_id))
   or (t.work_area_id is not null and mzs_private.ops_can_work_on_area(t.work_area_id)))) then
  raise exception 'Task access denied' using errcode='42501';end if;
 select status into old_status from public.mzs_ops_property_task_updates
 where task_id=t.id order by sequence_no desc limit 1;
 old_status:=coalesce(old_status,'open');
 if not is_manager and
  (old_status in ('done','cancelled') or new.status in ('cancelled','open')) then
  raise exception 'Task requires admin to reopen' using errcode='42501';end if;
 if is_manager and old_status='cancelled' and new.status<>'open' then
  raise exception 'Cancelled task must be reopened' using errcode='22023';end if;
 if not is_manager and new.status not in ('in_progress','blocked','done') then
  raise exception 'Staff task transition not permitted' using errcode='42501';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_property_task_update_guard() from public,anon,authenticated,service_role;

create or replace view public.mzs_ops_current_property_tasks
 with (security_invoker=true,security_barrier=true) as
 select t.id,t.property_id,t.unit_id,t.assigned_profile_id,
 t.title,t.description,t.priority,t.due_on,t.source_reference,t.created_by,t.created_at,
 coalesce(x.status,'open') AS status,x.note AS latest_note,x.created_at AS status_updated_at,
 t.work_area_id
 from public.mzs_ops_property_tasks t
 left join lateral(
  select u.status,u.note,u.created_at from public.mzs_ops_property_task_updates u
  where u.task_id=t.id order by u.sequence_no desc limit 1
 ) x on true;

-- Preserve the existing email event type, recipient pinning and deduplication.
create or replace function mzs_private.queue_property_staff_task_notice()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_creator text;v_location text;v_unit text;
begin
 if new.created_by is distinct from new.assigned_profile_id or
    not exists(select 1 from public.profiles p where p.id=new.created_by
      and p.is_active and p.role::text in ('client','partner')) or
    not ((new.property_id is not null and mzs_private.ops_can_work_on_property_as(new.created_by,new.property_id))
      or (new.work_area_id is not null and mzs_private.ops_can_work_on_area_as(new.created_by,new.work_area_id)))
 then return new;end if;
 select coalesce(nullif(btrim(full_name),''),'Property manager') into v_creator
  from public.profiles where id=new.created_by;
 if new.property_id is not null then
  select name into v_location from public.mzs_estate_properties where id=new.property_id;
  if new.unit_id is not null then
   select address into v_unit from public.mzs_estate_units
   where id=new.unit_id and property_id=new.property_id;
  end if;
 else
  select name into v_location from public.mzs_ops_staff_work_areas where id=new.work_area_id;
 end if;
 if v_creator is null or v_location is null then
  raise exception 'Task notification location unavailable' using errcode='23503';end if;
 insert into public.mzs_mail_outbox(user_id,event_type,payload,idempotency_key)
 select p.id,'property_staff_task_created',
 jsonb_build_object('task_id',new.id,'title',new.title,'creator',v_creator,'property',v_location,
  'unit',coalesce(v_unit,''),'priority',new.priority,'due_on',coalesce(new.due_on::text,'')),
 'property-staff-task:'||new.id::text||':'||p.id::text
 from public.profiles p where lower(p.email)='magdy@mzsgroup.eu' and p.is_active
 on conflict(idempotency_key) do nothing;
 return new;
end $fn$;
revoke all on function mzs_private.queue_property_staff_task_notice() from public,anon,authenticated,service_role;
commit;
