begin;
create table public.mzs_accountancy_handovers (
 year_id uuid primary key references public.mzs_accountancy_years(id) on delete restrict,
 status text not null check(status in ('preparing','ready','delivered','questions','completed')),
 accountant text not null check(length(accountant)<=200),
 delivered_on date,
 package_reference text not null check(length(package_reference)<=500),
 note text not null check(length(note) between 3 and 2000),
 revision integer not null default 1 check(revision>0),
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 check(status not in ('delivered','questions','completed') or (delivered_on is not null and length(btrim(accountant))>=2 and length(btrim(package_reference))>=3))
);
create table public.mzs_accountancy_handover_questions (
 id uuid primary key,
 year_id uuid not null references public.mzs_accountancy_years(id) on delete restrict,
 question text not null check(length(question) between 3 and 2000),
 answer text not null default '' check(length(answer)<=4000),
 status text not null check(status in ('open','resolved')),
 due_on date,
 revision integer not null default 1 check(revision>0),
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 check(status<>'resolved' or length(btrim(answer))>=3)
);
create index mzs_handover_questions_year_idx on public.mzs_accountancy_handover_questions(year_id,status);
create index mzs_handover_questions_actor_idx on public.mzs_accountancy_handover_questions(updated_by);
create index mzs_handovers_actor_idx on public.mzs_accountancy_handovers(updated_by);
create table public.mzs_accountancy_handover_events (
 id bigint generated always as identity primary key,
 year_id uuid not null references public.mzs_accountancy_years(id) on delete restrict,
 kind text not null check(kind in ('handover','question')),
 record_id uuid not null,
 before_record jsonb,
 after_record jsonb not null,
 actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create index mzs_handover_events_year_idx on public.mzs_accountancy_handover_events(year_id,id desc);
create index mzs_handover_events_actor_idx on public.mzs_accountancy_handover_events(actor_id);
alter table public.mzs_accountancy_handovers enable row level security;
alter table public.mzs_accountancy_handover_questions enable row level security;
alter table public.mzs_accountancy_handover_events enable row level security;
revoke all on public.mzs_accountancy_handovers,public.mzs_accountancy_handover_questions,public.mzs_accountancy_handover_events from public,anon,authenticated,service_role;
revoke all on sequence public.mzs_accountancy_handover_events_id_seq from public,anon,authenticated,service_role;
grant select on public.mzs_accountancy_handovers,public.mzs_accountancy_handover_questions,public.mzs_accountancy_handover_events to authenticated;
create policy handover_admin_read on public.mzs_accountancy_handovers for select to authenticated using ((select public.is_admin()));
create policy handover_questions_admin_read on public.mzs_accountancy_handover_questions for select to authenticated using ((select public.is_admin()));
create policy handover_events_admin_read on public.mzs_accountancy_handover_events for select to authenticated using ((select public.is_admin()));
-- Serialize both question and handover changes per administration: closing a handover
-- cannot race with adding/reopening a question. No browser role has direct writes.
create function mzs_private.save_accountant_handover(p_year uuid,p_id uuid,p_kind text,p_revision integer,p_data jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare old_record jsonb;new_record jsonb;current_revision integer;v_status text;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_year is null or p_id is null or p_kind is null or p_kind not in ('handover','question') or p_revision is null or p_revision<0 or p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid input' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 perform 1 from public.mzs_accountancy_years where id=p_year for update;
 if not found then raise exception 'Unknown administration' using errcode='22023';end if;
 v_status:=p_data->>'status';
 if p_kind='handover' then
  if p_id<>p_year then raise exception 'Wrong administration' using errcode='22023';end if;
  select to_jsonb(h),h.revision into old_record,current_revision from public.mzs_accountancy_handovers h where year_id=p_year;
 else
  select to_jsonb(q),q.revision into old_record,current_revision from public.mzs_accountancy_handover_questions q where id=p_id;
  if old_record is not null and (old_record->>'year_id')::uuid<>p_year then raise exception 'Wrong administration' using errcode='22023';end if;
 end if;
 if coalesce(current_revision,0)<>p_revision then raise exception 'Changed record; refresh' using errcode='40001';end if;
 if p_kind='handover' then
  if nullif(p_data->>'delivered_on','')::date>(now() at time zone 'Europe/Madrid')::date or nullif(p_data->>'delivered_on','')::date<'2000-01-01' then raise exception 'Invalid delivery date' using errcode='22023';end if;
  if v_status='completed' and exists(select 1 from public.mzs_accountancy_handover_questions where year_id=p_year and status='open') then raise exception 'Resolve open questions first' using errcode='23514';end if;
  insert into public.mzs_accountancy_handovers(year_id,status,accountant,delivered_on,package_reference,note,updated_by)
  values(p_year,v_status,btrim(coalesce(p_data->>'accountant','')),nullif(p_data->>'delivered_on','')::date,btrim(coalesce(p_data->>'package_reference','')),btrim(coalesce(p_data->>'note','')),auth.uid())
  on conflict(year_id) do update set status=excluded.status,accountant=excluded.accountant,delivered_on=excluded.delivered_on,package_reference=excluded.package_reference,note=excluded.note,revision=mzs_accountancy_handovers.revision+1,updated_by=auth.uid(),updated_at=now()
  returning to_jsonb(mzs_accountancy_handovers.*) into new_record;
 else
  if v_status='open' and exists(select 1 from public.mzs_accountancy_handovers where year_id=p_year and status='completed') then raise exception 'Reopen handover first' using errcode='23514';end if;
  if nullif(p_data->>'due_on','')::date not between '2000-01-01'::date and '2099-12-31'::date then raise exception 'Invalid deadline' using errcode='22023';end if;
  insert into public.mzs_accountancy_handover_questions(id,year_id,question,answer,status,due_on,updated_by)
  values(p_id,p_year,btrim(coalesce(p_data->>'question','')),btrim(coalesce(p_data->>'answer','')),v_status,nullif(p_data->>'due_on','')::date,auth.uid())
  on conflict(id) do update set question=excluded.question,answer=excluded.answer,status=excluded.status,due_on=excluded.due_on,revision=mzs_accountancy_handover_questions.revision+1,updated_by=auth.uid(),updated_at=now()
  returning to_jsonb(mzs_accountancy_handover_questions.*) into new_record;
 end if;
 insert into public.mzs_accountancy_handover_events(year_id,kind,record_id,before_record,after_record,actor_id) values(p_year,p_kind,p_id,old_record,new_record,auth.uid());
end $$;
revoke all on function mzs_private.save_accountant_handover(uuid,uuid,text,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function mzs_private.save_accountant_handover(uuid,uuid,text,integer,jsonb) to authenticated;
create function public.mzs_save_accountant_handover(p_year uuid,p_id uuid,p_kind text,p_revision integer,p_data jsonb)
returns void language sql security invoker set search_path='' as $$select mzs_private.save_accountant_handover(p_year,p_id,p_kind,p_revision,p_data)$$;
revoke all on function public.mzs_save_accountant_handover(uuid,uuid,text,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.mzs_save_accountant_handover(uuid,uuid,text,integer,jsonb) to authenticated;
commit;
