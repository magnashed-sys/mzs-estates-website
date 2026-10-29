-- Property manager tasks and optional actual-time references. Zero seeds; no supplier orders or invoices.
begin;
set local lock_timeout='2s';
create table public.mzs_ops_property_tasks (
 id uuid primary key default gen_random_uuid(),
 property_id uuid not null references public.mzs_estate_properties(id) on delete restrict,
 unit_id uuid references public.mzs_estate_units(id) on delete restrict,
 assigned_profile_id uuid references public.profiles(id) on delete restrict,
 title text not null check(length(btrim(title)) between 5 and 160 and title !~ '[[:cntrl:]]'),
 description text not null default '' check(length(description)<=2000 and description !~ '[[:cntrl:]]'),
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 due_on date check(due_on between date '2000-01-01' and date '2099-12-31'),
 source_reference text not null default '' check(length(source_reference)<=250 and source_reference !~ '[[:cntrl:]]'),
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index ops_property_tasks_owner on public.mzs_ops_property_tasks(assigned_profile_id,due_on,id);
create index ops_property_tasks_property on public.mzs_ops_property_tasks(property_id,due_on,id);
create table public.mzs_ops_property_task_updates (
 id uuid primary key default gen_random_uuid(),
 sequence_no bigint generated always as identity unique,
 task_id uuid not null references public.mzs_ops_property_tasks(id) on delete restrict,
 status text not null check(status in ('open','in_progress','blocked','done','cancelled')),
 note text not null check(length(btrim(note)) between 3 and 1500 and note !~ '[[:cntrl:]]'),
 actor_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index ops_task_updates_by_task on public.mzs_ops_property_task_updates(task_id,sequence_no desc);
create table public.mzs_ops_property_task_admin_audit(
 id bigint generated always as identity primary key,
 task_id uuid not null references public.mzs_ops_property_tasks(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 old_snapshot jsonb not null,
 new_snapshot jsonb not null,
 changed_at timestamptz not null default now()
);
alter table public.mzs_ops_property_tasks enable row level security;
alter table public.mzs_ops_property_task_updates enable row level security;
alter table public.mzs_ops_property_task_admin_audit enable row level security;
revoke all on public.mzs_ops_property_tasks,public.mzs_ops_property_task_updates,public.mzs_ops_property_task_admin_audit from public,anon,authenticated,service_role;
grant select on public.mzs_ops_property_tasks,public.mzs_ops_property_task_updates to authenticated;
grant insert(property_id,unit_id,assigned_profile_id,title,description,priority,due_on,source_reference) on public.mzs_ops_property_tasks to authenticated;
grant update(unit_id,assigned_profile_id,title,description,priority,due_on,source_reference) on public.mzs_ops_property_tasks to authenticated;
grant insert(task_id,status,note) on public.mzs_ops_property_task_updates to authenticated;
grant select on public.mzs_ops_property_task_admin_audit to authenticated;
create policy ops_tasks_read on public.mzs_ops_property_tasks for select to authenticated using(
 (select public.is_admin()) OR
 (assigned_profile_id=(select auth.uid()) AND mzs_private.ops_can_work_on_property(property_id))
);
create policy ops_tasks_write on public.mzs_ops_property_tasks for insert to authenticated with check(
 created_by=(select auth.uid()) AND
 ((select public.is_admin()) OR
  (assigned_profile_id=(select auth.uid()) AND mzs_private.ops_can_work_on_property(property_id)))
);
create policy ops_tasks_admin_update on public.mzs_ops_property_tasks for update to authenticated
 using((select public.is_admin())) with check((select public.is_admin()));
create policy ops_task_updates_read on public.mzs_ops_property_task_updates for select to authenticated using(
 (select public.is_admin()) OR EXISTS(
 SELECT 1 FROM public.mzs_ops_property_tasks t
 WHERE t.id=task_id AND t.assigned_profile_id=(select auth.uid())
 AND mzs_private.ops_can_work_on_property(t.property_id))
);
create policy ops_task_updates_insert on public.mzs_ops_property_task_updates for insert to authenticated with check(
 actor_id=(select auth.uid()) AND ((select public.is_admin()) OR EXISTS(
 SELECT 1 FROM public.mzs_ops_property_tasks t WHERE t.id=task_id
 AND t.assigned_profile_id=(select auth.uid()) AND mzs_private.ops_can_work_on_property(t.property_id)))
);
create policy ops_task_audit_admin_read on public.mzs_ops_property_task_admin_audit for select to authenticated using((select public.is_admin()));
create function mzs_private.ops_property_task_guard()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if auth.uid() is null or (select not is_active from public.profiles where id=auth.uid()) then
  raise exception 'Active account required' using errcode='42501';
 end if;
 if tg_op='UPDATE' then
  if public.is_admin() is distinct from true or new.id<>old.id or new.property_id<>old.property_id or
     new.created_by<>old.created_by or new.created_at<>old.created_at then
    raise exception 'Only admin can edit task metadata' using errcode='42501';
  end if;
 else
  if new.created_by is distinct from auth.uid() then raise exception 'Task creator mismatch' using errcode='42501';end if;
  if not public.is_admin() and
    (new.assigned_profile_id is distinct from auth.uid() OR
     NOT mzs_private.ops_can_work_on_property(new.property_id)) then
    raise exception 'Staff can create tasks for themselves only within their property scope' using errcode='42501';
  end if;
 end if;
 if new.unit_id is not null and not exists(
  select 1 from public.mzs_estate_units u where u.id=new.unit_id and u.property_id=new.property_id
 ) then raise exception 'Task unit does not belong to this property' using errcode='22023';end if;
 if new.assigned_profile_id is not null and not exists(
  select 1 from public.profiles p where p.id=new.assigned_profile_id and p.is_active
  and p.role::text in ('client','partner')
  and mzs_private.ops_can_work_on_property_as(p.id,new.property_id)
 ) then
  raise exception 'Assignee must have active staff access to task property' using errcode='22023';
 end if;
 return new;
end $fn$;
-- Scoped helper resolves effective grant of an explicitly named profile for assignment validation.
-- It never grants caller rights and is in a non-exposed schema.
create function mzs_private.ops_can_work_on_property_as(p_profile uuid,p_property uuid)
returns boolean language sql security definer stable set search_path='' as $fn$
 select coalesce((
  select e.action='grant' from public.mzs_ops_staff_scope_events e
  where e.profile_id=p_profile and e.property_id=p_property
  order by e.sequence_no desc limit 1
 ),false)
$fn$;
revoke all on function mzs_private.ops_can_work_on_property_as(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function mzs_private.ops_property_task_guard() from public,anon,authenticated,service_role;
create trigger ops_property_task_guard before insert or update on public.mzs_ops_property_tasks
 for each row execute function mzs_private.ops_property_task_guard();
create function mzs_private.ops_property_task_audit() returns trigger
 language plpgsql security definer set search_path='' as $fn$
begin
 insert into public.mzs_ops_property_task_admin_audit(task_id,actor_id,old_snapshot,new_snapshot)
 values(new.id,auth.uid(),to_jsonb(old),to_jsonb(new));
 return new;
end $fn$;
revoke all on function mzs_private.ops_property_task_audit() from public,anon,authenticated,service_role;
create trigger ops_property_task_admin_audit after update on public.mzs_ops_property_tasks
 for each row when(old.* is distinct from new.*) execute function mzs_private.ops_property_task_audit();
create function mzs_private.ops_property_task_update_guard() returns trigger
 language plpgsql security definer set search_path='' as $fn$
declare t public.mzs_ops_property_tasks;old_status text;is_manager boolean;
begin
 if auth.uid() is null or new.actor_id is distinct from auth.uid() then
  raise exception 'Authenticated task actor required' using errcode='42501';end if;
 select * into t from public.mzs_ops_property_tasks where id=new.task_id for update;
 if not found then raise exception 'Unknown task' using errcode='22023';end if;
 is_manager:=public.is_admin();
 if not is_manager and (t.assigned_profile_id is distinct from auth.uid() OR
   not mzs_private.ops_can_work_on_property(t.property_id)) then
  raise exception 'Task access denied' using errcode='42501';end if;
 select status into old_status from public.mzs_ops_property_task_updates
 where task_id=t.id order by sequence_no desc limit 1;
 old_status:=coalesce(old_status,'open');
 if not is_manager and (old_status in ('done','cancelled') OR
  new.status='cancelled' OR new.status='open') then
  raise exception 'Completed or cancelled tasks require administrator to reopen' using errcode='42501';end if;
 if is_manager and old_status='cancelled' and new.status<>'open' then
  raise exception 'Cancelled task must be reopened before other changes' using errcode='22023';end if;
 if not is_manager and new.status not in ('in_progress','blocked','done') then
  raise exception 'Staff task transition not permitted' using errcode='42501';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_property_task_update_guard() from public,anon,authenticated,service_role;
create trigger ops_property_task_update_guard before insert on public.mzs_ops_property_task_updates
 for each row execute function mzs_private.ops_property_task_update_guard();
create function mzs_private.ops_task_immutable() returns trigger
 language plpgsql security invoker set search_path='' as $fn$
begin raise exception 'Task audit history cannot be changed' using errcode='42501';end $fn$;
revoke all on function mzs_private.ops_task_immutable() from public,anon,authenticated,service_role;
create trigger ops_task_updates_immutable before update or delete on public.mzs_ops_property_task_updates
 for each row execute function mzs_private.ops_task_immutable();
create trigger ops_task_admin_audit_immutable before update or delete on public.mzs_ops_property_task_admin_audit
 for each row execute function mzs_private.ops_task_immutable();
create view public.mzs_ops_current_property_tasks with (security_invoker=true,security_barrier=true) as
select t.id,t.property_id,t.unit_id,t.assigned_profile_id,t.title,t.description,t.priority,t.due_on,
 t.source_reference,t.created_by,t.created_at,
 coalesce(x.status,'open') as status,x.note as latest_note,x.created_at as status_updated_at
from public.mzs_ops_property_tasks t
left join lateral(
 select u.status,u.note,u.created_at from public.mzs_ops_property_task_updates u
 where u.task_id=t.id order by u.sequence_no desc limit 1
) x on true;
revoke all on public.mzs_ops_current_property_tasks from public,anon,authenticated,service_role;
grant select on public.mzs_ops_current_property_tasks to authenticated;
alter table public.mzs_ops_staff_visits add column task_id uuid references public.mzs_ops_property_tasks(id) on delete restrict;
grant insert(task_id) on public.mzs_ops_staff_visits to authenticated;
create index ops_staff_visits_task on public.mzs_ops_staff_visits(task_id) where task_id is not null;
create function mzs_private.ops_staff_visit_task_guard() returns trigger
 language plpgsql security definer set search_path='' as $fn$
declare t public.mzs_ops_property_tasks;
begin
 if new.task_id is null then return new;end if;
 select * into t from public.mzs_ops_property_tasks where id=new.task_id;
 if not found OR t.property_id<>new.property_id OR
   (t.unit_id is not null and t.unit_id is distinct from new.unit_id) OR
   t.assigned_profile_id is distinct from new.profile_id then
  raise exception 'Time entry task must belong to this worker, property and unit' using errcode='22023';
 end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_staff_visit_task_guard() from public,anon,authenticated,service_role;
create trigger ops_staff_visit_task_guard before insert on public.mzs_ops_staff_visits
 for each row execute function mzs_private.ops_staff_visit_task_guard();
comment on table public.mzs_ops_property_tasks is 'Scoped, nonfinancial property manager tasks; no commercial work orders, client invoices or payment authorization.';
comment on table public.mzs_ops_property_task_updates is 'Append-only task progress; staff own tasks, admin all; no billing effect.';
comment on column public.mzs_ops_staff_visits.task_id is 'Optional property/unit-scoped work task associated with actual minutes; never automatically billable.';
commit;