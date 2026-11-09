begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

-- Private CRM notes and tasks: explicit administrator-only access, no external
-- notifications, no alteration of client accounts or underlying invoices.
create table public.mzs_crm_activities (
 id uuid primary key default gen_random_uuid(),
 relationship_id uuid not null references public.mzs_lease_relationships(id) on delete restrict,
 kind text not null check(kind in ('note','call','email','meeting','task')),
 title text not null check(length(btrim(title)) between 3 and 180 and title !~ '[[:cntrl:]]'),
 detail text not null default '' check(length(detail)<=4000),
 due_on date check(due_on between date '2000-01-01' and date '2099-12-31'),
 status text not null default 'done' check(status in ('open','done')),
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 completed_by uuid references public.profiles(id) on delete restrict,
 completed_at timestamptz,
 version integer not null default 1 check(version>=1),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint crm_activity_status check (
   (kind='task') or (status='done' and due_on is null)
 ),
 constraint crm_activity_completion check (
   (status='open' and completed_at is null and completed_by is null) or
   (status='done' and completed_at is not null and completed_by is not null)
 )
);
create index crm_activities_relation_history on public.mzs_crm_activities(relationship_id,created_at desc,id);
create index crm_activities_task_queue on public.mzs_crm_activities(status,due_on,id) where kind='task';

create table public.mzs_crm_activity_events (
 id bigint generated always as identity primary key,
 activity_id uuid not null references public.mzs_crm_activities(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 operation text not null check(operation in ('create','update')),
 previous jsonb,
 current jsonb not null,
 created_at timestamptz not null default now()
);
create index crm_activity_events_by_activity on public.mzs_crm_activity_events(activity_id,id);

alter table public.mzs_crm_activities enable row level security;
alter table public.mzs_crm_activity_events enable row level security;
revoke all on public.mzs_crm_activities, public.mzs_crm_activity_events from public,anon,authenticated,service_role;
revoke all on sequence public.mzs_crm_activity_events_id_seq from public,anon,authenticated,service_role;
grant select on public.mzs_crm_activities, public.mzs_crm_activity_events to authenticated;
grant insert(relationship_id,kind,title,detail,due_on,status) on public.mzs_crm_activities to authenticated;
grant update(status,due_on,version) on public.mzs_crm_activities to authenticated;
create policy crm_activity_admin_read on public.mzs_crm_activities
 for select to authenticated using (public.is_admin());
create policy crm_activity_admin_create on public.mzs_crm_activities
 for insert to authenticated with check(public.is_admin());
create policy crm_activity_admin_update on public.mzs_crm_activities
 for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy crm_activity_events_admin_read on public.mzs_crm_activity_events
 for select to authenticated using(public.is_admin());

-- Validates insert/update and stamps completion inside the database. Explicit
-- optimistic revisions prevent overwriting tasks that another admin changed.
create function mzs_private.crm_activity_guard() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin() then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 if tg_op='INSERT' then
  if new.created_by is distinct from auth.uid() or new.version<>1 then
   raise exception 'CRM actor or revision invalid' using errcode='42501';
  end if;
  if new.kind='task' and new.status='open' then
   new.completed_at:=null;new.completed_by:=null;
  else
   if new.kind<>'task' and new.status<>'done' then
    raise exception 'Contact records are completed at creation';
   end if;
   new.completed_at:=now();new.completed_by:=auth.uid();
  end if;
 else
  if (new.id,new.relationship_id,new.kind,new.title,new.detail,
      new.created_by,new.created_at) is distinct from
     (old.id,old.relationship_id,old.kind,old.title,old.detail,
      old.created_by,old.created_at) then
   raise exception 'CRM source fields are immutable';
  end if;
  if old.kind<>'task' then
   raise exception 'Contact history cannot be overwritten';
  end if;
  if new.version<>old.version+1 then
   raise exception 'Task changed; reload before updating';
  end if;
  if new.status=old.status and new.due_on is not distinct from old.due_on then
   raise exception 'No task change recorded';
  end if;
  if new.status='done' and old.status<>'done' then
   new.completed_at:=now();new.completed_by:=auth.uid();
  elsif new.status='open' then
   new.completed_at:=null;new.completed_by:=null;
  end if;
 end if;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function mzs_private.crm_activity_guard() from public,anon,authenticated,service_role;
create trigger crm_activity_guard before insert or update on public.mzs_crm_activities
 for each row execute function mzs_private.crm_activity_guard();

-- Append-only audit retained independently of CRM user interfaces.
create function mzs_private.crm_activity_audit() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 insert into public.mzs_crm_activity_events(activity_id,actor_id,operation,previous,current)
 values(new.id,auth.uid(),case when tg_op='INSERT' then 'create' else 'update' end,
        case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function mzs_private.crm_activity_audit() from public,anon,authenticated,service_role;
create trigger crm_activity_audit after insert or update on public.mzs_crm_activities
 for each row execute function mzs_private.crm_activity_audit();

comment on table public.mzs_crm_activities is
 'Internal CRM contact moments and follow-up tasks only; no email sends, client role grants, invoice or payment changes.';
comment on table public.mzs_crm_activity_events is
 'Append-only administrator action history for CRM activities; no direct client mutations.';
commit;
