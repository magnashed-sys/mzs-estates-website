begin;
create table public.mzs_invoice_archive_batches(
 id uuid primary key default gen_random_uuid(),
 issuer_id uuid not null references public.mzs_lease_issuers(id),
 source_system text not null check(source_system='Gripp'),
 source_name text not null check(length(source_name) between 1 and 240),
 source_file_id text not null check(source_file_id ~ '^libfile[_-][A-Za-z0-9_-]+$'),
 source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 source_columns text[] not null check(cardinality(source_columns) between 1 and 100),
 source_exported_at timestamptz,
 currency text not null check(currency='EUR'),
 currency_basis text not null check(currency_basis='import_currency_not_in_source'),
 expected_rows integer not null check(expected_rows between 1 and 50000),
 expected_net_cents bigint not null,expected_gross_cents bigint not null,
 expected_paid_cents bigint not null,expected_open_cents bigint not null,
 authorization_reference text not null check(length(authorization_reference) between 10 and 1000),
 recorded_via text not null default 'controlled_import' check(recorded_via='controlled_import'),
 imported_at timestamptz not null default now(),
 check(expected_gross_cents=expected_paid_cents+expected_open_cents),
 unique(issuer_id,source_sha256),unique(id,issuer_id)
);
create table public.mzs_invoice_archive(
 id uuid primary key default gen_random_uuid(),batch_id uuid not null,issuer_id uuid not null,
 source_row integer not null check(source_row between 2 and 50001),
 number text not null check(length(number) between 1 and 100 and number=btrim(number)),
 customer_name text not null check(length(customer_name) between 1 and 500),
 issuer_name text not null,source_status text not null,
 issued_on date not null check(issued_on between date '2000-01-01' and date '2099-12-31'),
 report_on date not null,draft_on date not null,due_on date not null,
 subject text not null,description text not null,customer_reference text not null,
 net_cents bigint not null check(abs(net_cents)<=100000000000),
 gross_cents bigint not null check(abs(gross_cents)<=100000000000),
 vat_cents bigint generated always as(gross_cents-net_cents) stored,
 source_paid_cents bigint not null check(abs(source_paid_cents)<=100000000000),
 source_open_cents bigint not null check(abs(source_open_cents)<=100000000000),
 source_credit_reference text,
 raw_source jsonb not null check(jsonb_typeof(raw_source)='object' and pg_column_size(raw_source)<32768),
 foreign key(batch_id,issuer_id) references public.mzs_invoice_archive_batches(id,issuer_id),
 check(gross_cents=source_paid_cents+source_open_cents),unique(batch_id,source_row)
);
create unique index invoice_archive_number on public.mzs_invoice_archive(issuer_id,upper(number));
create index invoice_archive_batch on public.mzs_invoice_archive(batch_id,issuer_id);
create index invoice_archive_date on public.mzs_invoice_archive(issued_on desc,id);
alter table public.mzs_invoice_archive_batches enable row level security;
alter table public.mzs_invoice_archive enable row level security;
revoke all on public.mzs_invoice_archive_batches,public.mzs_invoice_archive from public,anon,authenticated,service_role;
grant select on public.mzs_invoice_archive_batches,public.mzs_invoice_archive to authenticated;
create policy archive_batch_admin on public.mzs_invoice_archive_batches for select to authenticated using((select public.is_admin()));
create policy invoice_archive_admin on public.mzs_invoice_archive for select to authenticated using((select public.is_admin()));
create trigger archive_batch_immutable before update or delete on public.mzs_invoice_archive_batches for each row execute function mzs_private.ops_history_immutable();
create trigger archive_invoice_immutable before update or delete on public.mzs_invoice_archive for each row execute function mzs_private.ops_history_immutable();

create function mzs_private.invoice_archive_source_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare b public.mzs_invoice_archive_batches;k text;v text;
begin
 select * into strict b from public.mzs_invoice_archive_batches where id=new.batch_id for update;
 if (select count(*) from public.mzs_invoice_archive where batch_id=b.id)>=b.expected_rows then raise exception 'Archive batch already complete';end if;
 if not(new.raw_source ?& b.source_columns) or (select count(*) from jsonb_object_keys(new.raw_source))<>cardinality(b.source_columns) or exists(select 1 from jsonb_each(new.raw_source) where jsonb_typeof(value)<>'string') then raise exception 'Original source fields incomplete';end if;
 foreach k in array array['Totaal excl. BTW','Totaal incl. BTW','Totaal reeds betaald','Totaal openstaand'] loop
  v:=new.raw_source->>k;
  if v is null or v !~ '^-?[0-9]{1,10}(\.[0-9]{1,2})?$' then raise exception 'Invalid exact decimal source amount';end if;
 end loop;
 foreach k in array array['Datum','Rapportagedatum','Conceptdatum','Vervaldatum'] loop
  v:=new.raw_source->>k;
  if v is null or v !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' or to_char(v::date,'YYYY-MM-DD')<>v then raise exception 'Invalid source date';end if;
 end loop;
 new.issuer_id:=b.issuer_id;
 new.number:=new.raw_source->>'Nummer';new.customer_name:=new.raw_source->>'Verkoopfactuur';
 new.issuer_name:=new.raw_source->>'Identiteit';new.source_status:=new.raw_source->>'Status';
 if new.issuer_name is distinct from (select name from public.mzs_lease_issuers where id=b.issuer_id) or new.source_status is distinct from 'Verzonden' then raise exception 'Unreviewed issuer or document status';end if;
 new.issued_on:=(new.raw_source->>'Datum')::date;new.report_on:=(new.raw_source->>'Rapportagedatum')::date;
 new.draft_on:=(new.raw_source->>'Conceptdatum')::date;new.due_on:=(new.raw_source->>'Vervaldatum')::date;
 new.subject:=new.raw_source->>'Onderwerp';new.description:=new.raw_source->>'Omschrijving';new.customer_reference:=new.raw_source->>'Referentie klant';
 new.net_cents:=((new.raw_source->>'Totaal excl. BTW')::numeric*100)::bigint;
 new.gross_cents:=((new.raw_source->>'Totaal incl. BTW')::numeric*100)::bigint;
 new.source_paid_cents:=((new.raw_source->>'Totaal reeds betaald')::numeric*100)::bigint;
 new.source_open_cents:=((new.raw_source->>'Totaal openstaand')::numeric*100)::bigint;
 if (new.raw_source->>'isopenstaand') is distinct from (case when new.source_open_cents<>0 then 'Ja' else 'Nee' end) then raise exception 'Source balance flag inconsistent';end if;
 new.source_credit_reference:=substring(new.subject from '(?i)Creditfactuur van ([0-9]+)');
 return new;
end $$;
revoke all on function mzs_private.invoice_archive_source_guard() from public,anon,authenticated,service_role;
create trigger a_archive_source before insert on public.mzs_invoice_archive for each row execute function mzs_private.invoice_archive_source_guard();

create function mzs_private.invoice_archive_reconcile() returns trigger language plpgsql security invoker set search_path='' as $$
declare n bigint;net numeric;gross numeric;paid numeric;open_amount numeric;
begin
 select count(*),sum(net_cents),sum(gross_cents),sum(source_paid_cents),sum(source_open_cents) into n,net,gross,paid,open_amount from public.mzs_invoice_archive where batch_id=new.id;
 if n<>new.expected_rows or net is distinct from new.expected_net_cents or gross is distinct from new.expected_gross_cents or paid is distinct from new.expected_paid_cents or open_amount is distinct from new.expected_open_cents then raise exception 'Incomplete invoice archive batch or incorrect control totals';end if;
 return null;
end $$;
revoke all on function mzs_private.invoice_archive_reconcile() from public,anon,authenticated,service_role;
create constraint trigger invoice_archive_complete after insert on public.mzs_invoice_archive_batches deferrable initially deferred for each row execute function mzs_private.invoice_archive_reconcile();

-- Preserve the shared issuer lock and extend existing number protection to the archive.
create or replace function mzs_private.ops_external_number_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform id from public.mzs_lease_issuers where id=new.issuer_id for update;
 if not found then raise exception 'Unknown issuing entity';end if;
 if (tg_table_name<>'mzs_lease_invoices' and exists(select 1 from public.mzs_lease_invoices where issuer_id=new.issuer_id and upper(btrim(number))=upper(btrim(new.number)))) or
 (tg_table_name<>'mzs_booking_invoices' and exists(select 1 from public.mzs_booking_invoices where issuer_id=new.issuer_id and upper(btrim(number))=upper(btrim(new.number)))) or
 exists(select 1 from public.mzs_ops_external_sales_invoices where issuer_id=new.issuer_id and upper(number)=upper(btrim(new.number))) or
 exists(select 1 from public.mzs_invoice_archive where issuer_id=new.issuer_id and upper(number)=upper(btrim(new.number))) then
 raise exception 'Invoice number already registered for this entity' using errcode='23505';end if;
 return new;
end $$;
create trigger z_archive_number before insert on public.mzs_invoice_archive for each row execute function mzs_private.ops_external_number_guard();

create function public.mzs_invoice_archive_source(p_year integer default null,p_query text default '',p_balance text default 'all',p_offset integer default 0,p_limit integer default 25)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if (p_year is not null and p_year not between 2000 and 2099) or p_query is null or length(p_query)>120 or p_balance is null or p_balance not in ('all','open','settled','credit') or p_offset is null or p_offset not between 0 and 10000000 or p_limit is null or p_limit not between 1 and 10000 then raise exception 'Invalid archive filters';end if;
 with selected as materialized (
  select * from public.mzs_invoice_archive r where (p_year is null or (r.issued_on>=make_date(p_year,1,1) and r.issued_on<make_date(p_year+1,1,1)))
  and (p_query='' or strpos(lower(concat_ws(' ',r.number,r.customer_name,r.subject,r.description,r.customer_reference)),lower(p_query))>0)
  and (p_balance='all' or (p_balance='open' and r.source_open_cents<>0) or (p_balance='settled' and r.source_open_cents=0) or (p_balance='credit' and r.gross_cents<0))
 ), totals as (
  select count(*) as count,coalesce(sum(net_cents),0) as net_cents,coalesce(sum(vat_cents),0) as vat_cents,coalesce(sum(gross_cents),0) as gross_cents,coalesce(sum(source_paid_cents),0) as paid_cents,coalesce(sum(source_open_cents),0) as open_cents,count(*) filter(where source_open_cents<>0) as open_count,count(*) filter(where gross_cents<0) as credit_count from selected
 ), bounded as(select least(p_offset,greatest(0,((count-1)/p_limit)*p_limit))::integer as actual_offset from totals)
 select jsonb_build_object('snapshot_at',statement_timestamp(),'year',p_year,'query',p_query,'balance',p_balance,'offset',(select actual_offset from bounded),'limit',p_limit,
 'totals',(select to_jsonb(t) from totals t),
 'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.issued_on desc,x.id) from (select id,batch_id,issuer_id,source_row,number,customer_name,issuer_name,source_status,issued_on,report_on,draft_on,due_on,subject,description,customer_reference,net_cents,vat_cents,gross_cents,source_paid_cents,source_open_cents,source_credit_reference from selected order by issued_on desc,id offset (select actual_offset from bounded) limit p_limit) x),'[]'::jsonb),
 'years',coalesce((select jsonb_agg(y order by y desc) from(select distinct extract(year from issued_on)::int y from public.mzs_invoice_archive) z),'[]'::jsonb),
 'batches',coalesce((select jsonb_agg(jsonb_build_object('id',id,'issuer_id',issuer_id,'source_name',source_name,'source_file_id',source_file_id,'source_sha256',source_sha256,'source_exported_at',source_exported_at,'currency',currency,'currency_basis',currency_basis,'expected_rows',expected_rows,'imported_at',imported_at) order by imported_at,id) from public.mzs_invoice_archive_batches),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.mzs_invoice_archive_source(integer,text,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.mzs_invoice_archive_source(integer,text,text,integer,integer) to authenticated;
comment on table public.mzs_invoice_archive is 'Immutable Gripp invoice-header archive. Source paid/open balances are snapshots without payment dates, not bank transactions. No inferred customer/property linkage, tax rate, service period or financial posting.';
commit;
