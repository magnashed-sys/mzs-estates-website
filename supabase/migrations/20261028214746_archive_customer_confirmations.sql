begin;
alter table public.mzs_invoice_archive_customers drop constraint mzs_invoice_archive_customers_basis_check;
alter table public.mzs_invoice_archive_customers add constraint mzs_invoice_archive_customers_basis_check check(basis in ('unique_exact_name','owner_confirmed_name'));
create or replace function mzs_private.archive_customer_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare source public.mzs_invoice_archive;target public.mzs_lease_relationships;matches bigint;
begin
 select * into strict source from public.mzs_invoice_archive where id=new.invoice_id;
 select * into strict target from public.mzs_lease_relationships where id=new.relationship_id;
 if source.issued_on<date '2026-01-01' or source.issued_on>=date '2027-01-01' then raise exception 'Customer linking is scoped to 2026';end if;
 if new.basis='unique_exact_name' then
 if lower(btrim(source.customer_name))<>lower(btrim(target.name)) then raise exception 'Customer names do not match';end if;
 select count(*) into matches from public.mzs_lease_relationships where lower(btrim(name))=lower(btrim(source.customer_name));
 if matches<>1 then raise exception 'Customer name is ambiguous';end if;
 end if;
 new.source_name:=source.customer_name;new.relationship_name:=target.name;
 return new;
end $$;
revoke all on function mzs_private.archive_customer_guard() from public,anon,authenticated,service_role;

create table public.mzs_invoice_archive_exclusions(
 invoice_id uuid primary key references public.mzs_invoice_archive(id),
 reason text not null check(length(reason) between 10 and 1000),
 authorization_reference text not null check(length(authorization_reference) between 10 and 1000),
 excluded_at timestamptz not null default now()
);
alter table public.mzs_invoice_archive_exclusions enable row level security;
revoke all on public.mzs_invoice_archive_exclusions from public,anon,authenticated,service_role;
grant select on public.mzs_invoice_archive_exclusions to authenticated;
create policy archive_exclusion_admin on public.mzs_invoice_archive_exclusions for select to authenticated using((select public.is_admin()));
create trigger archive_exclusion_immutable before update or delete on public.mzs_invoice_archive_exclusions for each row execute function mzs_private.ops_history_immutable();
create view public.mzs_invoice_archive_active with(security_invoker=true) as select i.* from public.mzs_invoice_archive i where not exists(select 1 from public.mzs_invoice_archive_exclusions e where e.invoice_id=i.id);
revoke all on public.mzs_invoice_archive_active from public,anon,authenticated,service_role;
grant select on public.mzs_invoice_archive_active to authenticated;
create or replace function public.mzs_invoice_archive_source(p_year integer default null,p_query text default '',p_balance text default 'all',p_offset integer default 0,p_limit integer default 25)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 if (p_year is not null and p_year not between 2000 and 2099) or p_query is null or length(p_query)>120 or p_balance is null or p_balance not in ('all','open','settled','credit','excluded') or p_offset is null or p_offset not between 0 and 10000000 or p_limit is null or p_limit not between 1 and 10000 then raise exception 'Invalid archive filters';end if;
 with selected as materialized (
  select * from public.mzs_invoice_archive r where (p_year is null or (r.issued_on>=make_date(p_year,1,1) and r.issued_on<make_date(p_year+1,1,1)))
  and (p_query='' or strpos(lower(concat_ws(' ',r.number,r.customer_name,r.subject,r.description,r.customer_reference)),lower(p_query))>0)
  and ((p_balance='excluded')=exists(select 1 from public.mzs_invoice_archive_exclusions e where e.invoice_id=r.id))
  and (p_balance in ('all','excluded') or (p_balance='open' and r.source_open_cents<>0) or (p_balance='settled' and r.source_open_cents=0) or (p_balance='credit' and r.gross_cents<0))
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
comment on table public.mzs_invoice_archive_exclusions is 'Owner-requested removal from active historical reporting; source remains intact. Not a credit note, payment or legal cancellation.';
commit;
