-- Administrative allocation of existing issued invoices only; never creates income or payments.
create table public.mzs_accountancy_income_allocations (
 year_id uuid not null references public.mzs_accountancy_years(id) on delete restrict,
 source text not null check(source in ('leases','bookings','external','services')),
 invoice_id uuid not null,
 property_id uuid references public.mzs_estate_properties(id) on delete restrict,
 project_id uuid references public.mzs_accountancy_projects(id) on delete restrict,
 evidence_reference text not null check(length(btrim(evidence_reference)) between 5 and 1000),
 revision integer not null default 1,
 updated_by uuid not null default auth.uid() references public.profiles(id),
 updated_at timestamptz not null default now(),
 primary key(source,invoice_id)
);
create index income_allocation_year on public.mzs_accountancy_income_allocations(year_id);
create index income_allocation_property on public.mzs_accountancy_income_allocations(property_id);
create index income_allocation_project on public.mzs_accountancy_income_allocations(project_id);
create index income_allocation_actor on public.mzs_accountancy_income_allocations(updated_by);
alter table public.mzs_accountancy_income_allocations enable row level security;
revoke all on public.mzs_accountancy_income_allocations from public,anon,authenticated,service_role;
grant select on public.mzs_accountancy_income_allocations to authenticated;
grant insert(year_id,source,invoice_id,property_id,project_id,evidence_reference) on public.mzs_accountancy_income_allocations to authenticated;
grant update(property_id,project_id,evidence_reference) on public.mzs_accountancy_income_allocations to authenticated;
create policy income_allocation_read on public.mzs_accountancy_income_allocations for select to authenticated using((select public.is_admin()));
create policy income_allocation_insert on public.mzs_accountancy_income_allocations for insert to authenticated with check((select public.is_admin()));
create policy income_allocation_update on public.mzs_accountancy_income_allocations for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create function mzs_private.validate_income_allocation() returns trigger language plpgsql security invoker set search_path='' as $$
declare y public.mzs_accountancy_years; invoice jsonb; p public.mzs_accountancy_projects;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active Group Admin required' using errcode='42501';end if;
 select * into strict y from public.mzs_accountancy_years where id=new.year_id;
 select value into invoice from jsonb_array_elements(public.mzs_ops_accountant_source(y.issuer_id)->new.source) where value->>'id'=new.invoice_id::text;
 if invoice is null or invoice->>'issuer_id'<>y.issuer_id::text or extract(year from (invoice->>'issued_on')::date)<>y.fiscal_year then raise exception 'Invoice does not belong to this entity and year';end if;
 if new.property_id is not null and not exists(select 1 from public.mzs_ops_property_entity_links l where l.property_id=new.property_id and l.legal_entity_id=y.issuer_id and l.effective_from<=(invoice->>'issued_on')::date and (l.effective_until is null or l.effective_until>=(invoice->>'issued_on')::date)) then raise exception 'Property has no dated association with this entity';end if;
 if new.project_id is not null then
  select * into strict p from public.mzs_accountancy_projects where id=new.project_id;
  if p.year_id<>y.id or p.property_id is distinct from new.property_id then raise exception 'Project does not match the income scope';end if;
 end if;
 if tg_op='UPDATE' then new.revision:=old.revision+1;end if;
 new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function mzs_private.validate_income_allocation() from public,anon,authenticated,service_role;
create trigger income_allocation_validate before insert or update on public.mzs_accountancy_income_allocations for each row execute function mzs_private.validate_income_allocation();
create trigger income_allocation_audit after insert or update on public.mzs_accountancy_income_allocations for each row execute function mzs_private.accountancy_year_audit();

create or replace function public.mzs_accountancy_year_source(p_year uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare y public.mzs_accountancy_years; result jsonb; n integer;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true then raise exception 'Active Group Admin required' using errcode='42501';end if;
 select * into strict y from public.mzs_accountancy_years where id=p_year;
 select count(*) into n from public.mzs_ops_expense_drafts where legal_entity_id=y.issuer_id and invoice_date>=make_date(y.fiscal_year,1,1) and invoice_date<make_date(y.fiscal_year+1,1,1);
 if n>5000 then raise exception 'Year source exceeds supported export size';end if;
 if (select count(*) from public.mzs_accountancy_documents where issuer_id=y.issuer_id and fiscal_year=y.fiscal_year)>5000 or (select count(*) from public.mzs_accountancy_projects where year_id=y.id)>1000 or (select count(*) from public.mzs_capital_deals where entity_id=y.issuer_id)>1000 then raise exception 'Year source exceeds supported export size';end if;
 result:=jsonb_build_object('administration',to_jsonb(y),'sales',public.mzs_ops_accountant_source(y.issuer_id),
 'costs',coalesce((select jsonb_agg(to_jsonb(d) || jsonb_build_object('supplier_name',s.name,'property_name',p.name) order by d.invoice_date,d.id) from public.mzs_ops_expense_drafts d join public.mzs_lease_relationships s on s.id=d.supplier_relationship_id left join public.mzs_estate_properties p on p.id=d.property_id where d.legal_entity_id=y.issuer_id and d.invoice_date>=make_date(y.fiscal_year,1,1) and d.invoice_date<make_date(y.fiscal_year+1,1,1)),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.draft_id) from public.mzs_accountancy_cost_reviews r where r.year_id=y.id),'[]'::jsonb),
 'projects',coalesce((select jsonb_agg(to_jsonb(p) order by p.name,p.id) from public.mzs_accountancy_projects p where p.year_id=y.id),'[]'::jsonb),
 'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'issuer_id',d.issuer_id,'fiscal_year',d.fiscal_year,'title',d.title,'original_name',d.original_name,'category',d.category,'review_status',d.review_status,'sha256',d.sha256,'notes',d.notes,'updated_at',d.updated_at) order by d.created_at,d.id) from public.mzs_accountancy_documents d where d.issuer_id=y.issuer_id and d.fiscal_year=y.fiscal_year),'[]'::jsonb),
 'capital_references',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.mzs_capital_deals c where c.entity_id=y.issuer_id),'[]'::jsonb),
 'income_allocations',coalesce((select jsonb_agg(to_jsonb(a) order by a.source,a.invoice_id) from public.mzs_accountancy_income_allocations a where a.year_id=y.id),'[]'::jsonb),
 'snapshot_at',statement_timestamp());
 if jsonb_array_length(result->'costs')<>n then raise exception 'Incomplete annual costs';end if;
 if octet_length(result::text)>18000000 then raise exception 'Year source exceeds supported export size';end if;
 return result;
end $$;
