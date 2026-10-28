-- Historical source costs and externally issued invoices. No visits, payroll,
-- supplier tax deductions, delivery events or receipts are reconstructed.
begin;
create table public.mzs_ops_historical_batches(
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id),
 reporting_year integer not null check(reporting_year between 2000 and 2099),
 source_key text not null check(length(source_key) between 3 and 120),
 source_name text not null check(length(source_name) between 1 and 240),
 source_file_id text not null check(source_file_id ~ '^libfile[_-][A-Za-z0-9_-]+$'),
 source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 hash_basis text not null check(hash_basis='extracted_csv_utf8_lf'),
 expected_rows integer not null check(expected_rows between 1 and 5000),
 expected_cost_cents bigint not null check(expected_cost_cents between 0 and 100000000000),
 authorization_reference text not null check(length(authorization_reference) between 10 and 1000),
 recorded_via text not null default 'controlled_import' check(recorded_via='controlled_import'),
 created_at timestamptz not null default now(),
 unique(profile_id,source_key),unique(profile_id,source_sha256),unique(id,profile_id,reporting_year)
);
create table public.mzs_ops_external_sales_invoices(
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.mzs_ops_historical_batches(id),
 issuer_id uuid not null references public.mzs_lease_issuers(id),
 customer_id uuid not null references public.mzs_lease_relationships(id),
 property_id uuid not null references public.mzs_estate_properties(id),
 number text not null check(number=btrim(number) and length(number) between 1 and 100),
 issued_on date not null check(issued_on between date '2000-01-01' and date '2099-12-31'),
 due_on date not null check(due_on>=issued_on),
 period_from date not null,period_until date not null check(period_until>=period_from),
 customer_reference text not null check(length(customer_reference) between 1 and 240),
 net_cents bigint not null check(net_cents between 1 and 100000000000),
 vat_cents bigint not null check(vat_cents between 0 and 100000000000),
 gross_cents bigint not null check(gross_cents=net_cents+vat_cents and gross_cents<=100000000000),
 vat_basis_points integer not null check(vat_basis_points between 0 and 10000),
 billed_hours integer not null check(billed_hours between 1 and 500000),
 hourly_rate_cents bigint not null check(hourly_rate_cents between 1 and 100000000),
 currency text not null default 'EUR' check(currency='EUR'),
 status text not null default 'externally_issued' check(status='externally_issued'),
 delivery_status text not null default 'not_recorded' check(delivery_status='not_recorded'),
 payment_status text not null default 'not_recorded' check(payment_status='not_recorded'),
 source_file_id text not null check(source_file_id ~ '^libfile[_-][A-Za-z0-9_-]+$'),
 source_name text not null check(length(source_name) between 1 and 240),
 source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object' and pg_column_size(source_snapshot)<16384),
 created_at timestamptz not null default now(),
 check(net_cents=billed_hours::bigint*hourly_rate_cents),
 check(vat_cents=round(net_cents::numeric*vat_basis_points/10000)),
 unique(issuer_id,number),unique(id,batch_id)
);
create table public.mzs_ops_historical_cost_rows(
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null,profile_id uuid not null,reporting_year integer not null,
 reference text not null check(reference ~ '^[A-Za-z0-9_-]{3,60}$'),
 iso_week integer not null check(iso_week between 1 and 53),
 period_from date not null,period_until date not null,
 original_location text not null check(length(original_location) between 1 and 180),
 category text not null check(length(category) between 1 and 140),
 description text not null check(length(description) between 1 and 500),
 cost_cents bigint not null check(cost_cents between 0 and 100000000000),
 recharge text not null check(recharge in ('Ja','Nee','Te beoordelen')),
 source_reference text not null check(length(source_reference)<=150),
 source_check text not null check(length(source_check)<=500),
 source_billing_reference text not null default '' check(length(source_billing_reference)<=120),
 invoice_id uuid,billed_hours integer,recharge_cents bigint,
 foreign key(batch_id,profile_id,reporting_year) references public.mzs_ops_historical_batches(id,profile_id,reporting_year),
 foreign key(invoice_id,batch_id) references public.mzs_ops_external_sales_invoices(id,batch_id),
 check(period_until>=period_from and period_until-period_from<=6 and extract(year from period_from)=reporting_year),
 check(extract(isodow from period_from)=1 and extract(week from period_from)=iso_week),
 check((invoice_id is null and billed_hours is null and recharge_cents is null and source_billing_reference='') or
 (invoice_id is not null and billed_hours is not null and recharge_cents is not null and billed_hours between 1 and 100 and recharge_cents between 1 and 100000000000 and recharge='Ja' and length(source_billing_reference)>0)),
 unique(profile_id,reference)
);
create index ops_history_batch_idx on public.mzs_ops_historical_cost_rows(batch_id,profile_id,reporting_year);
create index ops_history_invoice_idx on public.mzs_ops_historical_cost_rows(invoice_id,batch_id);
create index ops_external_batch_idx on public.mzs_ops_external_sales_invoices(batch_id);
create index ops_external_customer_idx on public.mzs_ops_external_sales_invoices(customer_id);
create index ops_external_property_idx on public.mzs_ops_external_sales_invoices(property_id);
create index ops_history_year_idx on public.mzs_ops_historical_batches(reporting_year,profile_id);

-- Imports are controlled database operations. The application has read access only.
revoke all on public.mzs_ops_historical_batches,public.mzs_ops_historical_cost_rows,public.mzs_ops_external_sales_invoices from public,anon,authenticated,service_role;
grant select on public.mzs_ops_historical_batches,public.mzs_ops_historical_cost_rows,public.mzs_ops_external_sales_invoices to authenticated;
alter table public.mzs_ops_historical_batches enable row level security;
alter table public.mzs_ops_historical_cost_rows enable row level security;
alter table public.mzs_ops_external_sales_invoices enable row level security;
create policy history_batch_admin on public.mzs_ops_historical_batches for select to authenticated using((select public.is_admin()));
create policy history_row_admin on public.mzs_ops_historical_cost_rows for select to authenticated using((select public.is_admin()));
create policy external_invoice_admin on public.mzs_ops_external_sales_invoices for select to authenticated using((select public.is_admin()));
create function mzs_private.ops_history_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Historical source records are immutable' using errcode='42501';end $$;
revoke all on function mzs_private.ops_history_immutable() from public,anon,authenticated,service_role;
create trigger history_batch_immutable before update or delete on public.mzs_ops_historical_batches for each row execute function mzs_private.ops_history_immutable();
create trigger history_row_immutable before update or delete on public.mzs_ops_historical_cost_rows for each row execute function mzs_private.ops_history_immutable();
create trigger external_invoice_immutable before update or delete on public.mzs_ops_external_sales_invoices for each row execute function mzs_private.ops_history_immutable();

create function mzs_private.ops_history_row_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare b public.mzs_ops_historical_batches;i public.mzs_ops_external_sales_invoices;
begin
 select * into strict b from public.mzs_ops_historical_batches where id=new.batch_id for update;
 if (select count(*) from public.mzs_ops_historical_cost_rows where batch_id=b.id)>=b.expected_rows then raise exception 'Historical batch is already complete';end if;
 if new.invoice_id is not null then
  select * into strict i from public.mzs_ops_external_sales_invoices where id=new.invoice_id and batch_id=b.id;
  if new.recharge_cents<>new.billed_hours::bigint*i.hourly_rate_cents or new.period_from<i.period_from or new.period_until>i.period_until then raise exception 'Invoice line rate or period mismatch';end if;
 end if;
 return new;
end $$;
revoke all on function mzs_private.ops_history_row_guard() from public,anon,authenticated,service_role;
create trigger history_row_validate before insert on public.mzs_ops_historical_cost_rows for each row execute function mzs_private.ops_history_row_guard();

create function mzs_private.ops_history_reconcile() returns trigger language plpgsql security invoker set search_path='' as $$
declare b public.mzs_ops_historical_batches;i public.mzs_ops_external_sales_invoices;n bigint;c numeric;h bigint;
begin
 if tg_table_name='mzs_ops_historical_batches' then select * into strict b from public.mzs_ops_historical_batches where id=new.id;
 else select * into strict b from public.mzs_ops_historical_batches where id=new.batch_id;end if;
 select count(*),coalesce(sum(cost_cents),0) into n,c from public.mzs_ops_historical_cost_rows where batch_id=b.id;
 if n<>b.expected_rows or c<>b.expected_cost_cents then raise exception 'Incomplete historical batch or source cost mismatch';end if;
 for i in select * from public.mzs_ops_external_sales_invoices where batch_id=b.id loop
  select coalesce(sum(recharge_cents),0),coalesce(sum(billed_hours),0) into c,h from public.mzs_ops_historical_cost_rows where invoice_id=i.id;
  if c<>i.net_cents or h<>i.billed_hours then raise exception 'External invoice does not reconcile to source lines';end if;
 end loop;
 return null;
end $$;
revoke all on function mzs_private.ops_history_reconcile() from public,anon,authenticated,service_role;
create constraint trigger history_batch_complete after insert on public.mzs_ops_historical_batches deferrable initially deferred for each row execute function mzs_private.ops_history_reconcile();
create constraint trigger external_invoice_complete after insert on public.mzs_ops_external_sales_invoices deferrable initially deferred for each row execute function mzs_private.ops_history_reconcile();

-- All three invoice paths lock the same issuer row before checking numbers.
-- Existing platform number allocation already locks this row; its sequence is unchanged.
create function mzs_private.ops_external_number_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform id from public.mzs_lease_issuers where id=new.issuer_id for update;
 if not found then raise exception 'Unknown issuing entity';end if;
 if (tg_table_name<>'mzs_lease_invoices' and exists(select 1 from public.mzs_lease_invoices where issuer_id=new.issuer_id and upper(btrim(number))=upper(btrim(new.number)))) or
 (tg_table_name<>'mzs_booking_invoices' and exists(select 1 from public.mzs_booking_invoices where issuer_id=new.issuer_id and upper(btrim(number))=upper(btrim(new.number)))) or
 exists(select 1 from public.mzs_ops_external_sales_invoices where issuer_id=new.issuer_id and upper(number)=upper(btrim(new.number))) then
 raise exception 'Invoice number already registered for this entity' using errcode='23505';end if;
 return new;
end $$;
revoke all on function mzs_private.ops_external_number_guard() from public,anon,authenticated,service_role;
create trigger external_invoice_number before insert on public.mzs_ops_external_sales_invoices for each row execute function mzs_private.ops_external_number_guard();
create trigger lease_external_number before insert on public.mzs_lease_invoices for each row execute function mzs_private.ops_external_number_guard();
create trigger booking_external_number before insert on public.mzs_booking_invoices for each row execute function mzs_private.ops_external_number_guard();

create function public.mzs_ops_historical_source(p_year integer,p_profile uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare batches jsonb;invoices jsonb;records jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if p_year is null or p_year not between 2000 and 2099 then raise exception 'Invalid reporting year';end if;
 if p_profile is not null and not exists(select 1 from public.profiles where id=p_profile) then raise exception 'Unknown profile';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]'::jsonb) into batches from (
  select b.*,p.full_name person_name from public.mzs_ops_historical_batches b join public.profiles p on p.id=b.profile_id where b.reporting_year=p_year and (p_profile is null or b.profile_id=p_profile) order by b.created_at,b.id limit 1001
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.period_from,x.reference),'[]'::jsonb) into records from (
  select r.* from public.mzs_ops_historical_cost_rows r join public.mzs_ops_historical_batches b on b.id=r.batch_id where b.reporting_year=p_year and (p_profile is null or b.profile_id=p_profile) order by r.period_from,r.reference limit 10001
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.issued_on,x.id),'[]'::jsonb) into invoices from (
  select i.*,e.name issuer_name,c.name customer_name,p.name property_name from public.mzs_ops_external_sales_invoices i join public.mzs_ops_historical_batches b on b.id=i.batch_id join public.mzs_lease_issuers e on e.id=i.issuer_id join public.mzs_lease_relationships c on c.id=i.customer_id join public.mzs_estate_properties p on p.id=i.property_id where b.reporting_year=p_year and (p_profile is null or b.profile_id=p_profile) order by i.issued_on,i.id limit 1001
 ) x;
 if jsonb_array_length(batches)>1000 or jsonb_array_length(records)>10000 or jsonb_array_length(invoices)>1000 then raise exception 'Historical source too large; select one person';end if;
 return jsonb_build_object('year',p_year,'profile',p_profile,'snapshot_at',statement_timestamp(),'batches',batches,'invoices',invoices,'rows',records);
end $$;
revoke all on function public.mzs_ops_historical_source(integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.mzs_ops_historical_source(integer,uuid) to authenticated;
comment on table public.mzs_ops_historical_cost_rows is 'Original historical weekly cost statements. Periods are not visit dates; billed hours are not actual worked hours. No VAT or payment is inferred from costs.';
comment on table public.mzs_ops_external_sales_invoices is 'Owner-confirmed, already issued external sales invoices. Source snapshot and historical line links; no sending, renumbering, receipts or bank entries.';

create or replace function public.mzs_ops_accountant_source(p_entity uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare result jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if not exists(select 1 from public.mzs_lease_issuers where id=p_entity) then raise exception 'Unknown entity';end if;
 if (select count(*) from public.mzs_ops_external_sales_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_lease_invoices where issuer_id=p_entity)>3000 or (select count(*) from public.mzs_booking_invoices where issuer_id=p_entity)>3000 or
 (select count(*) from public.mzs_lease_payments p join public.mzs_lease_invoices i on i.id=p.invoice_id where i.issuer_id=p_entity)>10000 or
 (select count(*) from public.mzs_booking_receipts p join public.mzs_booking_invoices i on i.booking_id=p.booking_id where i.issuer_id=p_entity)>10000 then raise exception 'Export scope too large';end if;
 select jsonb_build_object(
 'issuer',(select jsonb_build_object('id',id,'name',name) from public.mzs_lease_issuers where id=p_entity),
 'leases',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,issuer_id,contract_id,number,issued_on,total from public.mzs_lease_invoices where issuer_id=p_entity) x),'[]'::jsonb),
 'bookings',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,issuer_id,booking_id,number,issued_on,total,net_total,vat_total from public.mzs_booking_invoices where issuer_id=p_entity) x),'[]'::jsonb),
 'external',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select id,batch_id,issuer_id,number,issued_on,net_cents::numeric/100 net_total,vat_cents::numeric/100 vat_total,gross_cents::numeric/100 total,status from public.mzs_ops_external_sales_invoices where issuer_id=p_entity) x),'[]'::jsonb),
 'rent_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select p.id,p.invoice_id,p.amount,p.received_on,p.reference,p.reversed_at from public.mzs_lease_payments p join public.mzs_lease_invoices i on i.id=p.invoice_id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'guest_receipts',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from (select p.id,p.booking_id,p.amount,p.received_on,p.reference,p.receipt_type,p.reversed_at from public.mzs_booking_receipts p join public.mzs_booking_invoices i on i.booking_id=p.booking_id where i.issuer_id=p_entity) x),'[]'::jsonb),
 'snapshot_at',statement_timestamp()) into result;
 return result;
end $fn$;
revoke all on function public.mzs_ops_accountant_source(uuid) from public,anon,authenticated,service_role;
grant execute on function public.mzs_ops_accountant_source(uuid) to authenticated;

commit;
