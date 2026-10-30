begin;
set local lock_timeout='2s';
create table public.mzs_ops_recurring_plans (
 id uuid primary key,
 property_id uuid references public.mzs_estate_properties(id) on delete restrict,
 work_area_id text references public.mzs_ops_staff_work_areas(id) on delete restrict,
 unit_id uuid references public.mzs_estate_units(id) on delete restrict,
 assigned_profile_id uuid not null references public.profiles(id) on delete restrict,
 title text not null check(length(btrim(title)) between 5 and 160 and title !~ '[[:cntrl:]]'),
 description text not null default '' check(length(description)<=2000 and description !~ '[[:cntrl:]]'),
 priority text not null check(priority in ('low','normal','high','urgent')),
 frequency text not null check(frequency in ('daily','weekly','monthly')),
 every_n integer not null check(every_n between 1 and 365),
 start_on date not null check(start_on between date '2000-01-01' and date '2099-12-31'),
 end_on date check(end_on>=start_on and end_on<=date '2099-12-31'),
 lead_days integer not null default 0 check(lead_days between 0 and 30),
 is_active boolean not null default true,
 occurrence_no integer not null default 0 check(occurrence_no>=0),
 next_on date not null,
 skipped_on_resume integer not null default 0,
 revision integer not null default 1,
 created_by uuid not null references public.profiles(id) on delete restrict,
 authorized_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 last_generated_at timestamptz,
 last_error text,
 check((property_id is null)<>(work_area_id is null)),
 check(work_area_id is null or unit_id is null)
);
create index ops_recurring_due on public.mzs_ops_recurring_plans(next_on,id) where is_active;
create index ops_recurring_property on public.mzs_ops_recurring_plans(property_id);
create index ops_recurring_area on public.mzs_ops_recurring_plans(work_area_id);
create index ops_recurring_unit on public.mzs_ops_recurring_plans(unit_id);
create index ops_recurring_assignee on public.mzs_ops_recurring_plans(assigned_profile_id);
create index ops_recurring_creator on public.mzs_ops_recurring_plans(created_by);
create index ops_recurring_authorizer on public.mzs_ops_recurring_plans(authorized_by);
create table public.mzs_ops_recurring_occurrences (
 plan_id uuid not null references public.mzs_ops_recurring_plans(id) on delete restrict,
 due_on date not null,
 task_id uuid not null unique references public.mzs_ops_property_tasks(id) on delete restrict,
 generation_mode text not null check(generation_mode in ('admin','scheduler')),
 authorized_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 primary key(plan_id,due_on)
);
create index ops_recurring_occurrence_authorizer on public.mzs_ops_recurring_occurrences(authorized_by);
create table public.mzs_ops_recurring_audit (
 id bigint generated always as identity primary key,
 plan_id uuid not null references public.mzs_ops_recurring_plans(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 before_record jsonb,
 after_record jsonb not null,
 created_at timestamptz not null default now()
);
create index ops_recurring_audit_plan on public.mzs_ops_recurring_audit(plan_id,created_at);
create index ops_recurring_audit_actor on public.mzs_ops_recurring_audit(actor_id);
alter table public.mzs_ops_recurring_plans enable row level security;
alter table public.mzs_ops_recurring_occurrences enable row level security;
alter table public.mzs_ops_recurring_audit enable row level security;
revoke all on public.mzs_ops_recurring_plans,public.mzs_ops_recurring_occurrences,public.mzs_ops_recurring_audit from public,anon,authenticated,service_role;
grant select on public.mzs_ops_recurring_plans,public.mzs_ops_recurring_occurrences,public.mzs_ops_recurring_audit to authenticated;
create policy recurring_admin_read on public.mzs_ops_recurring_plans for select to authenticated using((select public.is_admin()));
create policy recurring_occurrence_admin_read on public.mzs_ops_recurring_occurrences for select to authenticated using((select public.is_admin()));
create policy recurring_audit_admin_read on public.mzs_ops_recurring_audit for select to authenticated using((select public.is_admin()));
create trigger recurring_audit_immutable before update or delete on public.mzs_ops_recurring_audit for each row execute function mzs_private.ops_task_immutable();
create trigger recurring_occurrence_immutable before update or delete on public.mzs_ops_recurring_occurrences for each row execute function mzs_private.ops_task_immutable();

-- Month-end dates always derive from the original anchor, so Jan 31 -> Feb 28 -> Mar 31.
create function mzs_private.recurring_due(p_start date,p_frequency text,p_every integer,p_index integer)
returns date language plpgsql immutable security invoker set search_path='' as $$
begin
 if p_start is null or p_frequency not in ('daily','weekly','monthly') or p_every not between 1 and 365 or p_index not between 0 and 40000 then raise exception 'Invalid recurrence';end if;
 if p_frequency='monthly' then return (p_start+make_interval(months=>p_every*p_index))::date;end if;
 return p_start+(p_every*p_index*case when p_frequency='weekly' then 7 else 1 end);
end $$;
revoke all on function mzs_private.recurring_due(date,text,integer,integer) from public,anon,authenticated,service_role;
create function mzs_private.recurring_first_index(p_start date,p_frequency text,p_every integer,p_today date)
returns integer language plpgsql immutable security invoker set search_path='' as $$
declare n integer;
begin
 if p_frequency='monthly' then
  n:=greatest(0,((extract(year from p_today)::integer-extract(year from p_start)::integer)*12+extract(month from p_today)::integer-extract(month from p_start)::integer)/p_every);
  if mzs_private.recurring_due(p_start,p_frequency,p_every,n)<p_today then n:=n+1;end if;
  return n;
 end if;
 return greatest(0,ceil((p_today-p_start)::numeric/(p_every*case when p_frequency='weekly' then 7 else 1 end))::integer);
end $$;
revoke all on function mzs_private.recurring_first_index(date,text,integer,date) from public,anon,authenticated,service_role;

create function mzs_private.save_recurring_plan(p_id uuid,p_revision integer,p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare old public.mzs_ops_recurring_plans;v public.mzs_ops_recurring_plans;changing boolean;today date:=(now() at time zone 'Europe/Madrid')::date;n integer;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_id is null or p_revision is null or p_revision<0 or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid plan';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into old from public.mzs_ops_recurring_plans where id=p_id for update;
 if (old.id is null and p_revision<>0) or (old.id is not null and old.revision<>p_revision) then raise exception 'Plan changed; refresh before saving' using errcode='40001';end if;
 v.id:=p_id;v.property_id:=nullif(p_data->>'property_id','')::uuid;v.work_area_id:=nullif(p_data->>'work_area_id','');v.unit_id:=nullif(p_data->>'unit_id','')::uuid;
 v.assigned_profile_id:=(p_data->>'assigned_profile_id')::uuid;v.title:=btrim(p_data->>'title');v.description:=btrim(coalesce(p_data->>'description',''));v.priority:=p_data->>'priority';
 v.frequency:=p_data->>'frequency';v.every_n:=(p_data->>'every_n')::integer;v.start_on:=(p_data->>'start_on')::date;v.end_on:=nullif(p_data->>'end_on','')::date;
 v.lead_days:=(p_data->>'lead_days')::integer;v.is_active:=(p_data->>'is_active')::boolean;
 if (v.property_id is null)=(v.work_area_id is null) or (v.work_area_id is not null and v.unit_id is not null) then raise exception 'Choose one location';end if;
 if v.unit_id is not null and not exists(select 1 from public.mzs_estate_units where id=v.unit_id and property_id=v.property_id) then raise exception 'Unit does not belong to property';end if;
 if v.is_active and not exists(select 1 from public.profiles p where p.id=v.assigned_profile_id and p.is_active and p.role::text in ('client','partner') and
 ((v.property_id is not null and mzs_private.ops_can_work_on_property_as(p.id,v.property_id)) or (v.work_area_id is not null and mzs_private.ops_can_work_on_area_as(p.id,v.work_area_id)))) then raise exception 'Assignee lacks location access';end if;
 changing:=old.id is null or (v.start_on,v.frequency,v.every_n) is distinct from (old.start_on,old.frequency,old.every_n);
 if changing and v.start_on<today then raise exception 'New schedule must start today or later';end if;
 n:=case when changing then 0 else old.occurrence_no end;
 v.skipped_on_resume:=coalesce(old.skipped_on_resume,0);
 if not changing and not old.is_active and v.is_active then
  n:=greatest(n,mzs_private.recurring_first_index(v.start_on,v.frequency,v.every_n,today));
  v.skipped_on_resume:=v.skipped_on_resume+n-old.occurrence_no;
 end if;
 v.next_on:=mzs_private.recurring_due(v.start_on,v.frequency,v.every_n,n);
 if v.next_on>date '2099-12-31' then raise exception 'Schedule outside supported range';end if;
 insert into public.mzs_ops_recurring_plans(id,property_id,work_area_id,unit_id,assigned_profile_id,title,description,priority,frequency,every_n,start_on,end_on,lead_days,is_active,occurrence_no,next_on,skipped_on_resume,created_by,authorized_by)
 values(v.id,v.property_id,v.work_area_id,v.unit_id,v.assigned_profile_id,v.title,v.description,v.priority,v.frequency,v.every_n,v.start_on,v.end_on,v.lead_days,v.is_active,n,v.next_on,v.skipped_on_resume,auth.uid(),auth.uid())
 on conflict(id) do update set property_id=excluded.property_id,work_area_id=excluded.work_area_id,unit_id=excluded.unit_id,assigned_profile_id=excluded.assigned_profile_id,title=excluded.title,description=excluded.description,priority=excluded.priority,
 frequency=excluded.frequency,every_n=excluded.every_n,start_on=excluded.start_on,end_on=excluded.end_on,lead_days=excluded.lead_days,is_active=excluded.is_active,occurrence_no=excluded.occurrence_no,next_on=excluded.next_on,skipped_on_resume=excluded.skipped_on_resume,
 revision=mzs_ops_recurring_plans.revision+1,authorized_by=auth.uid(),updated_at=now(),last_error=null;
 insert into public.mzs_ops_recurring_audit(plan_id,actor_id,before_record,after_record)
 select p_id,auth.uid(),case when old.id is null then null else to_jsonb(old) end,to_jsonb(p) from public.mzs_ops_recurring_plans p where id=p_id;
 return p_id;
end $$;
revoke all on function mzs_private.save_recurring_plan(uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function mzs_private.save_recurring_plan(uuid,integer,jsonb) to authenticated;
create function public.mzs_save_recurring_plan(p_id uuid,p_revision integer,p_data jsonb)
returns uuid language sql security invoker set search_path='' as $$select mzs_private.save_recurring_plan(p_id,p_revision,p_data)$$;
revoke all on function public.mzs_save_recurring_plan(uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.mzs_save_recurring_plan(uuid,integer,jsonb) to authenticated;

-- Internal worker: callable only by database owner/cron or the guarded admin wrapper.
-- It uses the last authorizing admin for existing task guards, records scheduler provenance
-- separately and restores the caller's auth context. Clients cannot invoke this function.
create function mzs_private.generate_recurring_tasks(p_mode text,p_today date default (now() at time zone 'Europe/Madrid')::date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.mzs_ops_recurring_plans;task uuid;made integer:=0;errors integer:=0;seen integer:=0;prior_sub text:=current_setting('request.jwt.claim.sub',true);next_date date;created boolean;
begin
 if p_mode not in ('admin','scheduler') or p_today is null then raise exception 'Invalid worker mode';end if;
 for p in select * from public.mzs_ops_recurring_plans where is_active and next_on<=p_today+lead_days and next_on<=date '2099-12-31' and (end_on is null or next_on<=end_on)
 order by (last_error is not null),next_on,id limit 50 for update skip locked loop
  begin
   created:=false;
   if not exists(select 1 from public.profiles where id=p.authorized_by and is_active and role::text='admin') then raise exception 'Authorizer inactive';end if;
   perform set_config('request.jwt.claim.sub',p.authorized_by::text,true);
   if not exists(select 1 from public.mzs_ops_recurring_occurrences where plan_id=p.id and due_on=p.next_on) then
    insert into public.mzs_ops_property_tasks(property_id,work_area_id,unit_id,assigned_profile_id,title,description,priority,due_on,source_reference,created_by)
    values(p.property_id,p.work_area_id,p.unit_id,p.assigned_profile_id,p.title,p.description,p.priority,p.next_on,'Recurring plan '||p.id::text||' · '||p.next_on::text,p.authorized_by) returning id into task;
    insert into public.mzs_ops_recurring_occurrences(plan_id,due_on,task_id,generation_mode,authorized_by) values(p.id,p.next_on,task,p_mode,p.authorized_by);
    created:=true;
   end if;
   next_date:=mzs_private.recurring_due(p.start_on,p.frequency,p.every_n,p.occurrence_no+1);
   update public.mzs_ops_recurring_plans set occurrence_no=p.occurrence_no+1,next_on=next_date,last_generated_at=now(),last_error=null where id=p.id;
   if created then made:=made+1;else seen:=seen+1;end if;
  exception when others then
   errors:=errors+1;
   update public.mzs_ops_recurring_plans set last_error='Check authorizing administrator, employee access, location and schedule.' where id=p.id;
  end;
  perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
 end loop;
 return jsonb_build_object('created',made,'existing',seen,'errors',errors);
end $$;
revoke all on function mzs_private.generate_recurring_tasks(text,date) from public,anon,authenticated,service_role;
create function mzs_private.generate_recurring_tasks_admin()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 return mzs_private.generate_recurring_tasks('admin');
end $$;
revoke all on function mzs_private.generate_recurring_tasks_admin() from public,anon,authenticated,service_role;
grant execute on function mzs_private.generate_recurring_tasks_admin() to authenticated;
create function public.mzs_generate_recurring_tasks() returns jsonb language sql security invoker set search_path='' as $$select mzs_private.generate_recurring_tasks_admin()$$;
revoke all on function public.mzs_generate_recurring_tasks() from public,anon,authenticated,service_role;
grant execute on function public.mzs_generate_recurring_tasks() to authenticated;
-- Hourly UTC tick; business dates and lead times are always evaluated in Europe/Madrid.
select cron.schedule('mzs-recurring-property-tasks','15 * * * *',$cron$select mzs_private.generate_recurring_tasks('scheduler');$cron$);
commit;
