begin;
set local lock_timeout='5s';

-- Configuration is explicit, separate from locked rental terms. No customer data is seeded.
create table public.mzs_ops_lease_cleaning_settings (
 work_area_id text primary key check(work_area_id='zorgbalans'),
 contract_id uuid not null unique references public.mzs_lease_contracts(id),
 starts_on date not null check(starts_on>=date '2026-10-26'),
 description text not null default E'Schoonmaak\nGrote kantoor 1 x per 2 weken\nKleine kantoor 1 x per maand\nConform bijlage 1: urenstaat.',
 customer_reference text not null default 'KOSTENPLAATS 652001 Prettig Thuis IJmuiden',
 configured_at timestamptz not null default now(),
 configured_by uuid not null references public.profiles(id)
);
create index lease_cleaning_config_actor on public.mzs_ops_lease_cleaning_settings(configured_by);
create table public.mzs_ops_lease_cleaning_visits (
 visit_id uuid primary key references public.mzs_ops_staff_visits(id),
 draft_id uuid not null references public.mzs_lease_invoice_drafts(id),
 entry jsonb not null,
 created_at timestamptz not null default now()
);
create index lease_cleaning_draft on public.mzs_ops_lease_cleaning_visits(draft_id);
-- Cron has no JWT. Its private read model uses the authoritative review rows, not
-- the staff-facing view which intentionally filters reviews by the signed-in user.
create view mzs_private.lease_cleaning_source with(security_invoker=true) as
 select v.id,v.worked_on,v.work_area_id,v.description,v.actual_minutes,
  coalesce(c.proposed_minutes,v.actual_minutes) as effective_minutes,r.decision as review_decision,
  exists(select 1 from public.mzs_ops_visit_correction_requests pc where pc.visit_id=v.id
   and not exists(select 1 from public.mzs_ops_visit_correction_decisions pd where pd.correction_id=pc.id)) as correction_pending
 from public.mzs_ops_staff_visits v
 left join lateral(select c.id,c.proposed_minutes from public.mzs_ops_visit_correction_requests c
  join public.mzs_ops_visit_correction_decisions d on d.correction_id=c.id and d.decision='approved'
  where c.visit_id=v.id order by c.sequence_no desc limit 1) c on true
 left join public.mzs_ops_visit_reviews r on r.visit_id=v.id and r.correction_id is not distinct from c.id;
revoke all on mzs_private.lease_cleaning_source from public,anon,authenticated,service_role;
do $$declare t text;begin
 foreach t in array array['mzs_ops_lease_cleaning_settings','mzs_ops_lease_cleaning_visits'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy cleaning_admin_read on public.%I for select to authenticated using ((select public.is_admin()))',t);
 end loop;
end $$;

create function mzs_private.configure_lease_cleaning(p_contract uuid,p_starts_on date)
returns void language plpgsql security definer set search_path='' as $$
declare c public.mzs_lease_contracts;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Administrator required' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(20261110,7113);
 select * into strict c from public.mzs_lease_contracts where id=p_contract;
 if c.status<>'active' or lower(c.tenant_name) not like '%zorgbalans%' or not exists(
  select 1 from public.mzs_lease_issuers e where e.id=c.issuer_id and e.kind='person'
 ) then raise exception 'Select the active Zorgbalans rental contract and its private issuer';end if;
 if exists(select 1 from public.mzs_ops_lease_cleaning_settings where contract_id<>p_contract or starts_on<>p_starts_on)
 then raise exception 'Existing cleaning configuration must be reviewed before changing the contract or start date';end if;
 insert into public.mzs_ops_lease_cleaning_settings(work_area_id,contract_id,starts_on,configured_by)
 values('zorgbalans',p_contract,p_starts_on,auth.uid()) on conflict(work_area_id) do nothing;
 insert into public.mzs_lease_audit(contract_id,actor_id,action,new_record)
 values(p_contract,auth.uid(),'cleaning:configured',jsonb_build_object('starts_on',p_starts_on));
end $$;
create function public.mzs_configure_lease_cleaning(p_contract uuid,p_starts_on date)
returns void language sql security invoker set search_path='' as $$select mzs_private.configure_lease_cleaning(p_contract,p_starts_on);$$;

-- A single lock serializes reservations, standalone billing and changes to source approvals.
-- The unique visit key also protects repeat/catch-up monthly runs.
create function mzs_private.refresh_lease_cleaning(p_draft uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare d public.mzs_lease_invoice_drafts;cfg public.mzs_ops_lease_cleaning_settings;
 entries jsonb;out_lines jsonb;hours integer;net numeric;tax numeric;v_count integer;cutoff date;
begin
 if current_user not in ('postgres','supabase_admin') and (auth.uid() is null or public.is_admin() is distinct from true)
 then raise exception 'Administrator required' using errcode='42501';end if;
 select * into strict d from public.mzs_lease_invoice_drafts where id=p_draft for update;
 select * into cfg from public.mzs_ops_lease_cleaning_settings where contract_id=d.contract_id;
 if not found then return 0;end if;
 if exists(select 1 from public.mzs_lease_invoices where draft_id=d.id) then raise exception 'Issued invoice cannot be refreshed';end if;
 if d.review_status<>'pending' then raise exception 'Keep this invoice for review before refreshing cleaning hours';end if;
 perform pg_catalog.pg_advisory_xact_lock(20261110,7113);
 cutoff:=least((now() at time zone 'Europe/Amsterdam')::date,d.period_start-1);
 delete from public.mzs_ops_lease_cleaning_visits where draft_id=d.id;
 insert into public.mzs_ops_lease_cleaning_visits(visit_id,draft_id,entry)
 select v.id,d.id,jsonb_build_object('visit_id',v.id,'worked_on',v.worked_on,'description',v.description,
  'actual_minutes',v.actual_minutes,'approved_minutes',v.effective_minutes,
  'hours',greatest(1,(v.effective_minutes+59)/60),'rate_cents',2500,
  'net_cents',greatest(1,(v.effective_minutes+59)/60)*2500)
 from mzs_private.lease_cleaning_source v
 where v.work_area_id=cfg.work_area_id and v.worked_on between cfg.starts_on and cutoff
  and v.review_decision='approved' and not v.correction_pending
  and not exists(select 1 from public.mzs_ops_zorgbalans_invoice_lines l where l.visit_id=v.id)
  and not exists(select 1 from public.mzs_ops_lease_cleaning_visits l where l.visit_id=v.id)
 order by v.worked_on,v.id;
 select count(*)::int,coalesce(jsonb_agg(entry order by entry->>'worked_on',visit_id),'[]'::jsonb),
  coalesce(sum((entry->>'hours')::integer),0)::integer
 into v_count,entries,hours from public.mzs_ops_lease_cleaning_visits where draft_id=d.id;
 net:=hours*25;tax:=round(net*.21,2);
 select coalesce(jsonb_agg(l order by n),'[]'::jsonb) into out_lines
 from jsonb_array_elements(d.lines) with ordinality x(l,n) where l->>'source' is distinct from 'zorgbalans_cleaning';
 if hours>0 then out_lines:=out_lines||jsonb_build_array(jsonb_build_object(
  'source','zorgbalans_cleaning','description',cfg.description,'amount',net::text,'vat','21',
  'net',net,'tax',tax,'total',net+tax));end if;
 update public.mzs_lease_invoice_drafts set lines=out_lines,
  subtotal=(select sum((l->>'net')::numeric) from jsonb_array_elements(out_lines) l),
  tax_total=(select sum((l->>'tax')::numeric) from jsonb_array_elements(out_lines) l),
  total=(select sum((l->>'total')::numeric) from jsonb_array_elements(out_lines) l),
  snapshot=d.snapshot||jsonb_build_object('cleaning',jsonb_build_object('version',1,'description',cfg.description,
   'customer_reference',cfg.customer_reference,'cutoff',cutoff,'entries',entries,'hours',hours,
   'net_cents',hours*2500,'vat_cents',round(hours*2500*.21),'gross_cents',hours*2500+round(hours*2500*.21)))
 where id=d.id;
 return v_count;
end $$;
-- Separate authenticated adapter: the trigger helper is not callable through the Data API.
create function mzs_private.admin_refresh_lease_cleaning(p_draft uuid)
returns integer language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Administrator required' using errcode='42501';end if;
 return mzs_private.refresh_lease_cleaning(p_draft);
end $$;
create function public.mzs_refresh_lease_cleaning(p_draft uuid)
returns integer language sql security invoker set search_path='' as $$select mzs_private.admin_refresh_lease_cleaning(p_draft);$$;
create function mzs_private.attach_lease_cleaning() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.mzs_ops_lease_cleaning_settings where contract_id=new.contract_id)
 then perform mzs_private.refresh_lease_cleaning(new.id);end if;
 return new;
end $$;
-- AFTER INSERT runs after the existing rent/pricing BEFORE trigger has finalized rental amounts.
create trigger lease_attach_cleaning after insert on public.mzs_lease_invoice_drafts
for each row execute function mzs_private.attach_lease_cleaning();

create or replace view public.mzs_ops_zorgbalans_billable_visits with(security_invoker=true,security_barrier=true) as
 select v.id,v.profile_id,v.worked_on,v.actual_minutes,v.effective_minutes,v.description,
  greatest(1,(v.effective_minutes+59)/60) as invoiced_hours,
  greatest(1,(v.effective_minutes+59)/60)*2500::bigint as net_cents,
  v.review_decision,v.correction_pending,v.work_area_id
 from public.mzs_ops_current_visits v
 where (select public.is_admin()) and v.work_area_id='zorgbalans'
  and v.worked_on between date '2026-10-26' and (now() at time zone 'Europe/Amsterdam')::date
  and v.review_decision='approved' and not v.correction_pending
  and not exists(select 1 from public.mzs_ops_zorgbalans_invoice_lines l where l.visit_id=v.id)
  and not exists(select 1 from public.mzs_ops_lease_cleaning_visits l where l.visit_id=v.id);

create function mzs_private.guard_standalone_cleaning() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(20261110,7113);
 if exists(select 1 from public.mzs_ops_lease_cleaning_settings)
 then raise exception 'Zorgbalans cleaning is included in the monthly rental invoice. Use the rental invoice workflow.';end if;
 return new;
end $$;
create trigger zorgbalans_monthly_billing_guard before insert on public.mzs_ops_zorgbalans_invoices
for each row execute function mzs_private.guard_standalone_cleaning();
-- Direct legacy line insertion is also guarded; hiding a UI button is not a duplicate guard.
create trigger zorgbalans_monthly_line_guard before insert on public.mzs_ops_zorgbalans_invoice_lines
for each row execute function mzs_private.guard_standalone_cleaning();

create function mzs_private.validate_lease_cleaning_issue() returns trigger language plpgsql security definer set search_path='' as $$
declare e jsonb;expected jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(20261110,7113);
 select coalesce(jsonb_agg(entry order by entry->>'worked_on',visit_id),'[]'::jsonb) into expected
 from public.mzs_ops_lease_cleaning_visits where draft_id=new.draft_id;
 if expected is distinct from coalesce(new.payload->'snapshot'->'cleaning'->'entries','[]'::jsonb)
 then raise exception 'Cleaning attachment does not reconcile. Refresh cleaning hours and review again.';end if;
 for e in select value from jsonb_array_elements(expected) loop
  if not exists(select 1 from mzs_private.lease_cleaning_source v where v.id=(e->>'visit_id')::uuid
   and v.review_decision='approved' and not v.correction_pending
   and v.effective_minutes=(e->>'approved_minutes')::int and v.actual_minutes=(e->>'actual_minutes')::int
   and v.worked_on=(e->>'worked_on')::date and v.description=e->>'description')
  then raise exception 'Cleaning hours changed after preparation. Keep for review, refresh cleaning hours and check again.';end if;
 end loop;
 return new;
end $$;
create trigger lease_validate_cleaning_issue before insert on public.mzs_lease_invoices
for each row execute function mzs_private.validate_lease_cleaning_issue();

create function mzs_private.guard_issued_cleaning_source() returns trigger language plpgsql security definer set search_path='' as $$
declare v_visit uuid;
begin
 if tg_table_name='mzs_ops_visit_correction_decisions' then
  select visit_id into v_visit from public.mzs_ops_visit_correction_requests where id=new.correction_id;
 else v_visit:=new.visit_id;end if;
 perform pg_catalog.pg_advisory_xact_lock(20261110,7113);
 if exists(select 1 from public.mzs_ops_lease_cleaning_visits l join public.mzs_lease_invoices i on i.draft_id=l.draft_id where l.visit_id=v_visit)
 then raise exception 'These hours are on an issued rental invoice and cannot be changed';end if;
 return new;
end $$;
create trigger aaa_cleaning_review_guard before insert on public.mzs_ops_visit_reviews for each row execute function mzs_private.guard_issued_cleaning_source();
create trigger aaa_cleaning_correction_guard before insert on public.mzs_ops_visit_correction_requests for each row execute function mzs_private.guard_issued_cleaning_source();
create trigger aaa_cleaning_decision_guard before insert on public.mzs_ops_visit_correction_decisions for each row execute function mzs_private.guard_issued_cleaning_source();

do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','mzs_private') and p.proname in ('configure_lease_cleaning','mzs_configure_lease_cleaning',
 'refresh_lease_cleaning','admin_refresh_lease_cleaning','mzs_refresh_lease_cleaning','attach_lease_cleaning',
 'guard_standalone_cleaning','validate_lease_cleaning_issue','guard_issued_cleaning_source') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 end loop;
end $$;
grant execute on function mzs_private.configure_lease_cleaning(uuid,date),public.mzs_configure_lease_cleaning(uuid,date),
 mzs_private.admin_refresh_lease_cleaning(uuid),public.mzs_refresh_lease_cleaning(uuid) to authenticated;
commit;
