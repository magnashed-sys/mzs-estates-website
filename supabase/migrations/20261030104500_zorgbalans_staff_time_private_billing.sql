-- Zorgbalans is an operational customer, NEVER a property or MZS invoicing entity.
-- Historical private invoice 7113 already covered through 2026-10-25.
begin;
set local lock_timeout='3s';
alter table public.mzs_ops_staff_work_areas drop constraint mzs_ops_staff_work_areas_id_check;
alter table public.mzs_ops_staff_work_areas add constraint mzs_ops_staff_work_areas_id_check
 check (id in ('maintenance-beverwijk','private-magdy','zorgbalans'));
insert into public.mzs_ops_staff_work_areas(id,name) values('zorgbalans','Zorgbalans');
-- Add narrowly scoped access to the two existing employee/testing accounts; nothing for arbitrary clients.
insert into public.mzs_ops_staff_area_scopes(profile_id,area_id,action,recorded_by,reason)
select p.id,'zorgbalans','grant',a.id,
 'Owner-authorized Zorgbalans time recording for Catherine and administrator testing; private billing reviewed separately.'
from public.profiles p
cross join lateral(select id from public.profiles where role::text='admin' and is_active order by id limit 1) a
where lower(p.email) in ('ledders2@hotmail.com','info@mzsestates.es')
and p.is_active and p.role::text in ('client','partner')
and not exists(select 1 from public.mzs_ops_staff_area_scopes e
 where e.profile_id=p.id and e.area_id='zorgbalans');

-- Frozen concepts and immutable line snapshots prevent double billing.
create table public.mzs_ops_zorgbalans_invoices (
 id uuid primary key default gen_random_uuid(),
 invoice_number text not null unique check(invoice_number ~ '^[0-9]{3,16}$'),
 issuer_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
 customer_name text not null default 'Stichting Zorgbalans' check(customer_name='Stichting Zorgbalans'),
 customer_reference text not null default 'KOSTENPLAATS 652001 Prettig Thuis IJmuiden'
  check(customer_reference='KOSTENPLAATS 652001 Prettig Thuis IJmuiden'),
 issued_on date not null,
 due_on date not null,
 period_from date not null,
 period_until date not null,
 hours integer not null check(hours between 1 and 10000),
 net_cents bigint not null check(net_cents>0),
 vat_cents bigint not null check(vat_cents>=0),
 gross_cents bigint not null check(gross_cents=net_cents+vat_cents),
 status text not null default 'concept' check(status in ('concept','externally_issued')),
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 confirmed_by uuid references public.profiles(id) on delete restrict,
 confirmed_at timestamptz,
 confirmation_note text,
 check(due_on=issued_on+14 and period_until>=period_from and period_from>=date '2026-10-26'),
 check((status='concept' and confirmed_at is null and confirmed_by is null and confirmation_note is null)
    or(status='externally_issued' and confirmed_at is not null and confirmed_by is not null
      and length(btrim(confirmation_note)) between 8 and 500))
);
create table public.mzs_ops_zorgbalans_invoice_lines(
 id uuid primary key default gen_random_uuid(),
 invoice_id uuid not null references public.mzs_ops_zorgbalans_invoices(id) on delete restrict,
 visit_id uuid not null unique references public.mzs_ops_staff_visits(id) on delete restrict,
 worked_on date not null,
 actual_minutes integer not null check(actual_minutes between 1 and 960),
 invoiced_hours integer not null check(invoiced_hours between 1 and 16),
 net_cents bigint not null check(net_cents=invoiced_hours*2500),
 description text not null check(length(btrim(description)) between 3 and 1500),
 check(invoiced_hours=greatest(1,(actual_minutes+59)/60))
);
create index ops_zorgbalans_lines_invoice on public.mzs_ops_zorgbalans_invoice_lines(invoice_id,worked_on,id);
alter table public.mzs_ops_zorgbalans_invoices enable row level security;
alter table public.mzs_ops_zorgbalans_invoice_lines enable row level security;
revoke all on public.mzs_ops_zorgbalans_invoices,public.mzs_ops_zorgbalans_invoice_lines
 from public,anon,authenticated,service_role;
grant select on public.mzs_ops_zorgbalans_invoices,public.mzs_ops_zorgbalans_invoice_lines to authenticated;
create policy zorgbalans_invoice_admin_read on public.mzs_ops_zorgbalans_invoices for select to authenticated using ((select public.is_admin()));
create policy zorgbalans_lines_admin_read on public.mzs_ops_zorgbalans_invoice_lines for select to authenticated using ((select public.is_admin()));

create view public.mzs_ops_zorgbalans_billable_visits
 with(security_invoker=true,security_barrier=true) as
 select v.id,v.profile_id,v.worked_on,v.actual_minutes,v.effective_minutes,v.description,
  greatest(1,(v.effective_minutes+59)/60) as invoiced_hours,
  greatest(1,(v.effective_minutes+59)/60)*2500::bigint as net_cents,
  v.review_decision, v.correction_pending,v.work_area_id
 from public.mzs_ops_current_visits v
 where (select public.is_admin()) and v.work_area_id='zorgbalans'
  and v.worked_on>=date '2026-10-26'
  and v.review_decision='approved' and v.correction_pending=false
  and not exists(select 1 from public.mzs_ops_zorgbalans_invoice_lines l where l.visit_id=v.id);
revoke all on public.mzs_ops_zorgbalans_billable_visits from public,anon,authenticated,service_role;
grant select on public.mzs_ops_zorgbalans_billable_visits to authenticated;

-- Batch preparation is atomic: validate all selected approved visits and freeze one immutable line per visit.
create function public.mzs_ops_prepare_zorgbalans_invoice(p_number text,p_visit_ids uuid[],p_issued_on date)
returns uuid language plpgsql security invoker set search_path='' as $fn$
declare v_issuer uuid;v_id uuid;v_count int;v_hours integer;v_net bigint;v_start date;v_end date;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Administrator required' using errcode='42501';end if;
 if p_number is null or p_number !~ '^[0-9]{3,16}$' or p_issued_on is null
  or p_issued_on<date '2026-10-26' or p_issued_on>current_date+1 then
  raise exception 'Invalid private invoice number or issue date' using errcode='22023';end if;
 if p_visit_ids is null or cardinality(p_visit_ids) not between 1 and 100 or
  (select count(distinct x) from unnest(p_visit_ids) x)<>cardinality(p_visit_ids) then
  raise exception 'Choose 1 to 100 distinct visits' using errcode='22023';end if;
 if exists(select 1 from public.mzs_ops_external_sales_invoices where number=p_number)
   or exists(select 1 from public.mzs_ops_zorgbalans_invoices where invoice_number=p_number) then
  raise exception 'Invoice number already exists' using errcode='23505';end if;
 select id into v_issuer from public.mzs_lease_issuers
 where name='Magdy Nashed' and kind='person' order by id limit 1;
 if v_issuer is null then raise exception 'Private issuer not registered' using errcode='22023';end if;
 perform 1 from public.mzs_ops_staff_visits where id=any(p_visit_ids) order by id for update;
 select count(*),sum(invoiced_hours)::int,sum(net_cents)::bigint,
  min(worked_on),max(worked_on)
 into v_count,v_hours,v_net,v_start,v_end from public.mzs_ops_zorgbalans_billable_visits
 where id=any(p_visit_ids);
 if v_count<>cardinality(p_visit_ids) or v_hours is null then
  raise exception 'Only fresh, approved and previously uninvoiced Zorgbalans visits are allowed' using errcode='22023';end if;
 insert into public.mzs_ops_zorgbalans_invoices(invoice_number,issuer_id,issued_on,due_on,
  period_from,period_until,hours,net_cents,vat_cents,gross_cents,created_by)
 values(p_number,v_issuer,p_issued_on,p_issued_on+14,v_start,v_end,v_hours,v_net,
  round(v_net*21.0/100)::bigint,v_net+round(v_net*21.0/100)::bigint,auth.uid())
 returning id into v_id;
 insert into public.mzs_ops_zorgbalans_invoice_lines(invoice_id,visit_id,worked_on,actual_minutes,invoiced_hours,net_cents,description)
 select v_id,id,worked_on,effective_minutes,invoiced_hours,net_cents,description
 from public.mzs_ops_zorgbalans_billable_visits where id=any(p_visit_ids);
 if (select count(*) from public.mzs_ops_zorgbalans_invoice_lines where invoice_id=v_id)<>v_count then
  raise exception 'Invoice lines incomplete' using errcode='22023';end if;
 return v_id;
end $fn$;
revoke all on function public.mzs_ops_prepare_zorgbalans_invoice(text,uuid[],date)
 from public,anon,authenticated,service_role;
grant execute on function public.mzs_ops_prepare_zorgbalans_invoice(text,uuid[],date) to authenticated;

-- Separate explicit admin confirmation of external delivery. No email is sent by the platform.
create function public.mzs_ops_confirm_zorgbalans_invoice(p_id uuid,p_reason text)
returns boolean language plpgsql security invoker set search_path='' as $fn$
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Administrator required' using errcode='42501';end if;
 if p_reason is null or length(btrim(p_reason)) not between 8 and 500 then
  raise exception 'External delivery reference is required' using errcode='22023';end if;
 update public.mzs_ops_zorgbalans_invoices
 set status='externally_issued',confirmed_by=auth.uid(),confirmed_at=now(),confirmation_note=btrim(p_reason)
 where id=p_id and status='concept';
 if not found then raise exception 'Invoice not found or already confirmed' using errcode='22023';end if;
 return true;
end $fn$;
revoke all on function public.mzs_ops_confirm_zorgbalans_invoice(uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.mzs_ops_confirm_zorgbalans_invoice(uuid,text) to authenticated;

-- RPCs are invoker-only. Grant scoped mutations solely to authenticated role guarded by admin-only RLS.
grant insert(invoice_number,issuer_id,customer_name,customer_reference,issued_on,due_on,
 period_from,period_until,hours,net_cents,vat_cents,gross_cents,created_by)
 on public.mzs_ops_zorgbalans_invoices to authenticated;
grant insert(invoice_id,visit_id,worked_on,actual_minutes,invoiced_hours,net_cents,description)
 on public.mzs_ops_zorgbalans_invoice_lines to authenticated;
grant update(status,confirmed_by,confirmed_at,confirmation_note)
 on public.mzs_ops_zorgbalans_invoices to authenticated;
create policy zorgbalans_invoice_admin_insert on public.mzs_ops_zorgbalans_invoices for insert to authenticated
 with check((select public.is_admin()) and created_by=auth.uid());
create policy zorgbalans_lines_admin_insert on public.mzs_ops_zorgbalans_invoice_lines for insert to authenticated
 with check((select public.is_admin()));
create policy zorgbalans_invoice_admin_update on public.mzs_ops_zorgbalans_invoices for update to authenticated
 using ((select public.is_admin()) and status='concept')
 with check ((select public.is_admin()) and status='externally_issued' and confirmed_by=auth.uid());
commit;