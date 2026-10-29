-- Annual administration workspaces and review metadata. No journal entries or tax postings.
begin;
create table public.mzs_accountancy_years (
 id uuid primary key default gen_random_uuid(),
 issuer_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
 fiscal_year integer not null check(fiscal_year between 2000 and 2099),
 purpose text not null default 'current' check(purpose in ('current','reference')),
 vat_treatment text not null default 'pending' check(vat_treatment in ('pending','no_recovery','source_records')),
 vat_effective_from date,
 vat_evidence text not null default '' check(length(vat_evidence)<=2000),
 notes text not null default '' check(length(notes)<=4000),
 checks jsonb not null default '{"income":false,"costs":false,"bank":false,"assets":false,"financing":false,"tax":false,"documents":false}'::jsonb,
 revision integer not null default 1,
 updated_by uuid references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(issuer_id,fiscal_year),
 check(vat_treatment<>'no_recovery' or (vat_effective_from is not null and length(btrim(vat_evidence))>=5))
);
create table public.mzs_accountancy_projects (
 id uuid primary key default gen_random_uuid(),
 year_id uuid not null references public.mzs_accountancy_years(id) on delete restrict,
 property_id uuid references public.mzs_estate_properties(id) on delete restrict,
 name text not null check(length(btrim(name)) between 2 and 160 and name !~ '[[:cntrl:]]'),
 kind text not null check(kind in ('renovation','improvements')),
 source_reference text not null default '' check(length(source_reference)<=1000),
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(year_id,name)
);
create table public.mzs_accountancy_cost_reviews (
 draft_id uuid primary key references public.mzs_ops_expense_drafts(id) on delete restrict,
 year_id uuid not null references public.mzs_accountancy_years(id) on delete restrict,
 category text not null check(category in ('advice','utilities','maintenance','renovation','improvements','insurance','bank_charges','depreciation','taxes','management','other')),
 project_id uuid references public.mzs_accountancy_projects(id) on delete restrict,
 review_status text not null default 'pending' check(review_status in ('pending','reviewed','excluded')),
 evidence_reference text not null default '' check(length(evidence_reference)<=1000),
 note text not null default '' check(length(note)<=2000),
 revision integer not null default 1,
 updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 updated_at timestamptz not null default now(),
 check(review_status<>'reviewed' or length(btrim(evidence_reference))>=3),
 check(review_status<>'excluded' or length(btrim(note))>=5)
);
create table public.mzs_accountancy_year_audit (
 id bigint generated always as identity primary key,
 year_id uuid not null references public.mzs_accountancy_years(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 source_table text not null, action text not null check(action in ('INSERT','UPDATE')),
 before_snapshot jsonb, after_snapshot jsonb not null,
 created_at timestamptz not null default now()
);
-- Configuration only. The historical 2023 source treatment is retained; present VAT status is unconfirmed.
insert into public.mzs_accountancy_years(issuer_id,fiscal_year,purpose,vat_treatment,notes)
 select id,2023,'reference','source_records','Historical reference dossier. Preserve the original 2023 VAT records. No opening balances, expenses or tax positions have been posted from the archive.'
 from public.mzs_lease_issuers where tax_id='B44854248';
insert into public.mzs_accountancy_years(issuer_id,fiscal_year,notes)
 select id,2026,'Owner reports no VAT recovery/returns for current activities. Effective date and supporting confirmation remain to be recorded. Costs retain their original net, VAT and gross amounts.'
 from public.mzs_lease_issuers where tax_id in ('B44854248','B16396079');

alter table public.mzs_accountancy_years enable row level security;
alter table public.mzs_accountancy_projects enable row level security;
alter table public.mzs_accountancy_cost_reviews enable row level security;
alter table public.mzs_accountancy_year_audit enable row level security;
revoke all on public.mzs_accountancy_years,public.mzs_accountancy_projects,public.mzs_accountancy_cost_reviews,public.mzs_accountancy_year_audit from public,anon,authenticated,service_role;
revoke all on sequence public.mzs_accountancy_year_audit_id_seq from public,anon,authenticated,service_role;
grant select on public.mzs_accountancy_years,public.mzs_accountancy_projects,public.mzs_accountancy_cost_reviews,public.mzs_accountancy_year_audit to authenticated;
grant insert(issuer_id,fiscal_year,purpose) on public.mzs_accountancy_years to authenticated;
grant update(vat_treatment,vat_effective_from,vat_evidence,notes,checks) on public.mzs_accountancy_years to authenticated;
grant insert(year_id,property_id,name,kind,source_reference) on public.mzs_accountancy_projects to authenticated;
grant insert(draft_id,year_id,category,project_id,review_status,evidence_reference,note) on public.mzs_accountancy_cost_reviews to authenticated;
grant update(category,project_id,review_status,evidence_reference,note) on public.mzs_accountancy_cost_reviews to authenticated;
create policy accountancy_year_admin on public.mzs_accountancy_years for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy accountancy_project_admin on public.mzs_accountancy_projects for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy accountancy_cost_review_admin on public.mzs_accountancy_cost_reviews for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy accountancy_year_audit_read on public.mzs_accountancy_year_audit for select to authenticated using((select public.is_admin()));

create function mzs_private.accountancy_year_validate() returns trigger language plpgsql security definer set search_path='' as $$
declare y public.mzs_accountancy_years; d public.mzs_ops_expense_drafts; p public.mzs_accountancy_projects; k text;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true then raise exception 'Active Group Admin required' using errcode='42501';end if;
 if tg_table_name='mzs_accountancy_years' then
  if jsonb_typeof(new.checks) is distinct from 'object' or (select count(*) from jsonb_object_keys(new.checks))<>7 then raise exception 'Invalid year checklist';end if;
  foreach k in array array['income','costs','bank','assets','financing','tax','documents'] loop
   if jsonb_typeof(new.checks->k) is distinct from 'boolean' then raise exception 'Invalid year checklist';end if;
  end loop;
  new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();
  if tg_op='UPDATE' then new.revision:=old.revision+1;end if;
 elsif tg_table_name='mzs_accountancy_projects' then
  new.created_by:=auth.uid();new.created_at:=clock_timestamp();
 elsif tg_table_name='mzs_accountancy_cost_reviews' then
  select * into strict y from public.mzs_accountancy_years where id=new.year_id;
  select * into strict d from public.mzs_ops_expense_drafts where id=new.draft_id;
  if d.legal_entity_id<>y.issuer_id or extract(year from d.invoice_date)::integer<>y.fiscal_year then raise exception 'Cost does not belong to this entity and year';end if;
  if new.project_id is not null then
   select * into strict p from public.mzs_accountancy_projects where id=new.project_id;
   if p.year_id<>y.id or p.property_id is distinct from d.property_id then raise exception 'Project does not match the cost scope';end if;
  end if;
  new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();
  if tg_op='UPDATE' then new.revision:=old.revision+1;end if;
 end if;
 return new;
end $$;
revoke all on function mzs_private.accountancy_year_validate() from public,anon,authenticated,service_role;
create function mzs_private.accountancy_year_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare y uuid;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true then raise exception 'Active Group Admin required' using errcode='42501';end if;
 if tg_table_name='mzs_accountancy_years' then y:=new.id;else y:=new.year_id;end if;
 insert into public.mzs_accountancy_year_audit(year_id,actor_id,source_table,action,before_snapshot,after_snapshot)
 values(y,auth.uid(),tg_table_name,tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;
end $$;
revoke all on function mzs_private.accountancy_year_audit() from public,anon,authenticated,service_role;
create trigger accountancy_year_validate before insert or update on public.mzs_accountancy_years for each row execute function mzs_private.accountancy_year_validate();
create trigger accountancy_project_validate before insert on public.mzs_accountancy_projects for each row execute function mzs_private.accountancy_year_validate();
create trigger accountancy_review_validate before insert or update on public.mzs_accountancy_cost_reviews for each row execute function mzs_private.accountancy_year_validate();
create trigger accountancy_year_audit after insert or update on public.mzs_accountancy_years for each row execute function mzs_private.accountancy_year_audit();
create trigger accountancy_project_audit after insert on public.mzs_accountancy_projects for each row execute function mzs_private.accountancy_year_audit();
create trigger accountancy_review_audit after insert or update on public.mzs_accountancy_cost_reviews for each row execute function mzs_private.accountancy_year_audit();
create index accountancy_year_actor_fk on public.mzs_accountancy_years(updated_by);
create index accountancy_project_property_fk on public.mzs_accountancy_projects(property_id);
create index accountancy_project_actor_fk on public.mzs_accountancy_projects(created_by);
create index accountancy_review_year_fk on public.mzs_accountancy_cost_reviews(year_id);
create index accountancy_review_project_fk on public.mzs_accountancy_cost_reviews(project_id);
create index accountancy_review_actor_fk on public.mzs_accountancy_cost_reviews(updated_by);
create index accountancy_audit_year_fk on public.mzs_accountancy_year_audit(year_id,created_at desc);
create index accountancy_audit_actor_fk on public.mzs_accountancy_year_audit(actor_id);

-- Existing property costs keep the dated payer check. Company overhead has no property allocation.
alter table public.mzs_ops_expense_drafts add column cost_scope text not null default 'property' check(cost_scope in ('property','entity'));
alter table public.mzs_ops_expense_drafts alter column property_id drop not null;
alter table public.mzs_ops_expense_drafts add constraint mzs_ops_expense_scope check((cost_scope='property' and property_id is not null) or (cost_scope='entity' and property_id is null));
alter table public.mzs_ops_expense_drafts drop constraint mzs_ops_expense_drafts_category_check;
alter table public.mzs_ops_expense_drafts add constraint mzs_ops_expense_drafts_category_check check(category in ('electricity','gas','water','cleaning','internet','insurance','taxes','maintenance','materials','management','other','advice','utilities','renovation','improvements','bank_charges','depreciation'));
grant insert(cost_scope) on public.mzs_ops_expense_drafts to authenticated;
create or replace function mzs_private.mzs_ops_validate_expense_draft()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare
  allocation jsonb;
  aid uuid;
  net_total bigint:=0;
  vat_total bigint:=0;
  entries integer:=0;
  null_entries integer:=0;
  unique_targets uuid[]:=array[]::uuid[];
begin
  if (select auth.uid()) is null
      or (select public.is_admin()) is distinct from true
      or new.created_by is distinct from (select auth.uid())
      or new.status <> 'draft'
  then raise exception 'Active Group Admin required' using errcode='42501';end if;

  if new.cost_scope='property' and not exists (
   select 1 from public.mzs_ops_property_entity_links l
   where l.property_id=new.property_id
    and l.legal_entity_id=new.legal_entity_id
    and l.relationship_type='payer'
    and l.effective_from <= new.invoice_date
    and (l.effective_until is null or l.effective_until >= new.invoice_date)
  ) then raise exception 'Verified property paying entity required' using errcode='23514';end if;

  if jsonb_typeof(new.allocations) <> 'array' or
    jsonb_array_length(new.allocations) not between 1 and 100
  then raise exception 'Invalid expense allocations';end if;
  for allocation in select value from jsonb_array_elements(new.allocations) loop
    if jsonb_typeof(allocation) <> 'object' or
      jsonb_typeof(allocation->'net_cents') is distinct from 'number' or
      jsonb_typeof(allocation->'vat_cents') is distinct from 'number' or
      (allocation->>'net_cents') !~ '^[0-9]{1,12}$' or
      (allocation->>'vat_cents') !~ '^[0-9]{1,12}$'
    then raise exception 'Only explicit integer-cent allocations are allowed';end if;
    net_total:=net_total+(allocation->>'net_cents')::bigint;
    vat_total:=vat_total+(allocation->>'vat_cents')::bigint;
    entries:=entries+1;
    if (allocation->'unit_id') is null or allocation->'unit_id'='null'::jsonb then
      null_entries:=null_entries+1;
    else
      if jsonb_typeof(allocation->'unit_id')<>'string'
        or (allocation->>'unit_id') !~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      then raise exception 'Invalid unit identifier';end if;
      aid:=(allocation->>'unit_id')::uuid;
      if aid=any(unique_targets) or not exists(
       select 1 from public.mzs_estate_units u
       where u.id=aid and u.property_id=new.property_id
      ) then raise exception 'Unit allocation is duplicated or not part of this property';end if;
      unique_targets:=array_append(unique_targets,aid);
    end if;
  end loop;
  if (null_entries>0 and (entries<>1 or null_entries<>1)) or
   (net_total<>new.net_cents or vat_total<>new.vat_cents)
  then raise exception 'Expense allocations do not reconcile';end if;
  if new.cost_scope='entity' and (entries<>1 or null_entries<>1) then raise exception 'Company costs require one unallocated amount';end if;
  return new;
end $fn$;
revoke all on function mzs_private.mzs_ops_validate_expense_draft()
  from public,anon,authenticated,service_role;

create function public.mzs_accountancy_year_source(p_year uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
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
 'snapshot_at',statement_timestamp());
 if jsonb_array_length(result->'costs')<>n then raise exception 'Incomplete annual costs';end if;
 if octet_length(result::text)>18000000 then raise exception 'Year source exceeds supported export size';end if;
 return result;
end $$;
revoke all on function public.mzs_accountancy_year_source(uuid) from public,anon,authenticated,service_role;
grant execute on function public.mzs_accountancy_year_source(uuid) to authenticated;
comment on table public.mzs_accountancy_years is 'Internal annual collection checklist; not a closed ledger, tax return or statutory sign-off. No fiscal balances seeded.';
comment on table public.mzs_accountancy_cost_reviews is 'Review metadata only. Original purchase concepts and source VAT remain immutable; reviewed is not a journal posting.';
commit;
