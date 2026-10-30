begin;
set local lock_timeout='3s';
-- Task delegation never grants access to accounting source tables or private PDFs.
create function mzs_private.accountancy_followup_worker(p_profile uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (public.is_admin() or p_profile=auth.uid()) and exists(
  select 1 from public.profiles p where p.id=p_profile and p.is_active and
  (p.role::text='admin' or (p.role::text in ('client','partner') and exists(
   select 1 from (select distinct on (property_id) action from public.mzs_ops_staff_scope_events
    where profile_id=p_profile order by property_id,sequence_no desc) s where s.action='grant'))))
$$;
revoke all on function mzs_private.accountancy_followup_worker(uuid) from public,anon,authenticated,service_role;
grant execute on function mzs_private.accountancy_followup_worker(uuid) to authenticated;
create table public.mzs_accountancy_followups(
 id uuid primary key default gen_random_uuid(),
 year_id uuid not null references public.mzs_accountancy_years(id) on delete restrict,
 item_key text not null check(length(item_key)<=60),
 title text not null check(length(btrim(title)) between 1 and 240 and title !~ '[[:cntrl:]]'),
 assigned_profile_id uuid references public.profiles(id) on delete restrict,
 due_on date check(due_on between date '2000-01-01' and date '2099-12-31'),
 status text not null default 'open' check(status in ('open','in_progress','blocked','done','cancelled')),
 note text not null default '' check(length(note)<=1500 and note !~ '[[:cntrl:]]'),
 revision integer not null default 1,
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(year_id,item_key)
);
create index accountancy_followups_assignee on public.mzs_accountancy_followups(assigned_profile_id,status,due_on);
create table public.mzs_accountancy_followup_events(
 id bigint generated always as identity primary key,
 task_id uuid not null references public.mzs_accountancy_followups(id),
 actor_id uuid not null references public.profiles(id),
 old_record jsonb,new_record jsonb not null,created_at timestamptz not null default now()
);
alter table public.mzs_accountancy_followups enable row level security;
alter table public.mzs_accountancy_followup_events enable row level security;
revoke all on public.mzs_accountancy_followups,public.mzs_accountancy_followup_events from public,anon,authenticated,service_role;
grant select on public.mzs_accountancy_followups,public.mzs_accountancy_followup_events to authenticated;
grant insert(year_id,item_key,title,assigned_profile_id,due_on) on public.mzs_accountancy_followups to authenticated;
grant update(assigned_profile_id,due_on,status,note,revision) on public.mzs_accountancy_followups to authenticated;
create policy followups_read on public.mzs_accountancy_followups for select to authenticated using(
 public.is_admin() or (assigned_profile_id=auth.uid() and mzs_private.accountancy_followup_worker(auth.uid())));
create policy followups_insert on public.mzs_accountancy_followups for insert to authenticated with check(public.is_admin());
create policy followups_update on public.mzs_accountancy_followups for update to authenticated
 using(public.is_admin() or (assigned_profile_id=auth.uid() and mzs_private.accountancy_followup_worker(auth.uid())))
 with check(public.is_admin() or (assigned_profile_id=auth.uid() and mzs_private.accountancy_followup_worker(auth.uid())));
create policy followup_events_read on public.mzs_accountancy_followup_events for select to authenticated using(
 exists(select 1 from public.mzs_accountancy_followups t where t.id=task_id));
create function mzs_private.accountancy_followup_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare y public.mzs_accountancy_years;k text;ref uuid;valid boolean:=false;
begin
 if auth.uid() is null or not mzs_private.accountancy_followup_worker(auth.uid()) then raise exception 'Active worker required' using errcode='42501';end if;
 if tg_op='INSERT' then
  if not public.is_admin() or new.created_by<>auth.uid() then raise exception 'Admin required' using errcode='42501';end if;
  select * into strict y from public.mzs_accountancy_years where id=new.year_id;
  k:=split_part(new.item_key,':',1);
  if k='check' then valid:=split_part(new.item_key,':',2) in ('income','costs','assets','financing','tax','documents');
  else
   ref:=split_part(new.item_key,':',2)::uuid;
   if k='cost' then select exists(select 1 from public.mzs_ops_expense_drafts where id=ref and legal_entity_id=y.issuer_id and extract(year from invoice_date)=y.fiscal_year) into valid;
   elsif k='document' then select exists(select 1 from public.mzs_accountancy_documents where id=ref and issuer_id=y.issuer_id and fiscal_year=y.fiscal_year) into valid;
   elsif k='supplier' then select exists(select 1 from public.mzs_ops_expense_drafts where supplier_relationship_id=ref and legal_entity_id=y.issuer_id and extract(year from invoice_date)=y.fiscal_year) into valid;
   end if;
  end if;
  if not valid or array_length(string_to_array(new.item_key,':'),1)<>2 then raise exception 'Source outside administration';end if;
 else
  if (new.id,new.year_id,new.item_key,new.title,new.created_by,new.created_at) is distinct from
     (old.id,old.year_id,old.item_key,old.title,old.created_by,old.created_at) then raise exception 'Source is immutable';end if;
  if new.revision<>old.revision+1 then raise exception 'Refresh stale task';end if;
  if length(btrim(new.note))<3 then raise exception 'Progress note required';end if;
  if not public.is_admin() and (old.assigned_profile_id is distinct from auth.uid() or
   (new.assigned_profile_id,new.due_on) is distinct from (old.assigned_profile_id,old.due_on) or
   old.status in ('done','cancelled') or new.status not in ('in_progress','blocked','done')) then
    raise exception 'Task update denied' using errcode='42501';end if;
 end if;
 if new.assigned_profile_id is not null and not mzs_private.accountancy_followup_worker(new.assigned_profile_id) then raise exception 'Assignee requires active admin or staff access';end if;
 new.updated_at:=now();return new;
end $$;
revoke all on function mzs_private.accountancy_followup_guard() from public,anon,authenticated,service_role;
create trigger accountancy_followup_guard before insert or update on public.mzs_accountancy_followups for each row execute function mzs_private.accountancy_followup_guard();
create function mzs_private.accountancy_followup_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.mzs_accountancy_followup_events(task_id,actor_id,old_record,new_record)
 values(new.id,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;
end $$;
revoke all on function mzs_private.accountancy_followup_audit() from public,anon,authenticated,service_role;
create trigger accountancy_followup_audit after insert or update on public.mzs_accountancy_followups for each row execute function mzs_private.accountancy_followup_audit();
create function public.mzs_create_accountancy_followups(p_year uuid,p_items jsonb,p_assignee uuid,p_due date)
returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Select 1 to 50 items';end if;
 insert into public.mzs_accountancy_followups(year_id,item_key,title,assigned_profile_id,due_on)
 select p_year,x->>'id',x->>'label',p_assignee,p_due from jsonb_array_elements(p_items) x
 on conflict(year_id,item_key) do nothing;
 get diagnostics n=row_count;return n;
end $$;
revoke all on function public.mzs_create_accountancy_followups(uuid,jsonb,uuid,date) from public,anon,authenticated,service_role;
grant execute on function public.mzs_create_accountancy_followups(uuid,jsonb,uuid,date) to authenticated;
create view public.mzs_accountancy_followup_assignees with(security_invoker=true) as
 select id,full_name from public.profiles where public.is_admin() and mzs_private.accountancy_followup_worker(id);
revoke all on public.mzs_accountancy_followup_assignees from public,anon,authenticated,service_role;
grant select on public.mzs_accountancy_followup_assignees to authenticated;
comment on table public.mzs_accountancy_followups is 'Delegated follow-up only. Completion never changes accounting review, tax, payment, or document status. One persistent task per source/year. No email notifications.';
commit;
