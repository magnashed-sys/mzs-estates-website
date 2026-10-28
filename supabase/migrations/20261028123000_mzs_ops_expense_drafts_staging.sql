-- STAGING ONLY: draft purchase expense entries. No approval, PDF, send or payments.
-- Requires 20261028115000_mzs_ops_entity_links_staging.sql.
begin;

create table public.mzs_ops_expense_drafts (
 id uuid primary key default gen_random_uuid(),
 property_id uuid not null references public.mzs_estate_properties(id) on delete restrict,
 legal_entity_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
 supplier_relationship_id uuid not null references public.mzs_lease_relationships(id) on delete restrict,
 supplier_invoice_number text not null check (
   length(btrim(supplier_invoice_number)) between 1 and 100
   and supplier_invoice_number !~ '[[:cntrl:]]'
 ),
 invoice_date date not null,
 category text not null check(category in (
  'electricity','gas','water','cleaning','internet','insurance',
  'taxes','maintenance','materials','management','other')),
 description text not null check(length(btrim(description)) between 2 and 500
  and description !~ '[[:cntrl:]]'),
 currency text not null default 'EUR' check(currency='EUR'),
 net_cents bigint not null check(net_cents >= 0 and net_cents <= 100000000000),
 vat_cents bigint not null check(vat_cents >= 0 and vat_cents <= 100000000000),
 gross_cents bigint generated always as (net_cents + vat_cents) stored,
 allocations jsonb not null,
 source_document_status text not null default 'missing' check(source_document_status='missing'),
 status text not null default 'draft' check(status='draft'),
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 constraint mzs_ops_expense_draft_nonzero check (net_cents + vat_cents > 0)
);
create unique index mzs_ops_expense_draft_supplier_number_unique
 on public.mzs_ops_expense_drafts (
   legal_entity_id,supplier_relationship_id,upper(btrim(supplier_invoice_number))
 );
create index mzs_ops_expense_drafts_by_property
 on public.mzs_ops_expense_drafts(property_id,invoice_date desc);
create index mzs_ops_expense_drafts_by_entity
 on public.mzs_ops_expense_drafts(legal_entity_id,invoice_date desc);

create table public.mzs_ops_expense_draft_audit(
 id bigint generated always as identity primary key,
 draft_id uuid not null references public.mzs_ops_expense_drafts(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 action text not null check(action='INSERT'),
 saved_snapshot jsonb not null,
 created_at timestamptz not null default now()
);

alter table public.mzs_ops_expense_drafts enable row level security;
alter table public.mzs_ops_expense_draft_audit enable row level security;
revoke all on public.mzs_ops_expense_drafts from public,anon,authenticated,service_role;
revoke all on public.mzs_ops_expense_draft_audit from public,anon,authenticated,service_role;
revoke all on sequence public.mzs_ops_expense_draft_audit_id_seq from public,anon,authenticated,service_role;
grant select on public.mzs_ops_expense_drafts,public.mzs_ops_expense_draft_audit to authenticated;
grant insert(
 property_id,legal_entity_id,supplier_relationship_id,
 supplier_invoice_number,invoice_date,category,description,
 net_cents,vat_cents,allocations
) on public.mzs_ops_expense_drafts to authenticated;
create policy mzs_ops_expense_admin_read on public.mzs_ops_expense_drafts
 for select to authenticated using((select public.is_admin()));
create policy mzs_ops_expense_admin_insert on public.mzs_ops_expense_drafts
 for insert to authenticated with check(
  (select auth.uid()) is not null
  and created_by=(select auth.uid())
  and (select public.is_admin())
 );
create policy mzs_ops_expense_audit_admin_read on public.mzs_ops_expense_draft_audit
 for select to authenticated using((select public.is_admin()));

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

  if not exists (
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
  return new;
end $fn$;
revoke all on function mzs_private.mzs_ops_validate_expense_draft()
  from public,anon,authenticated,service_role;
create trigger mzs_ops_expense_validate_insert
 before insert on public.mzs_ops_expense_drafts
 for each row execute function mzs_private.mzs_ops_validate_expense_draft();

create or replace function mzs_private.mzs_ops_audit_expense_draft()
returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
  or new.created_by is distinct from (select auth.uid())
 then raise exception 'Unauthorized expense draft audit' using errcode='42501';end if;
 insert into public.mzs_ops_expense_draft_audit(
  draft_id,actor_id,action,saved_snapshot
 ) values(new.id,(select auth.uid()),'INSERT',to_jsonb(new));
 return new;
end $fn$;
revoke all on function mzs_private.mzs_ops_audit_expense_draft()
 from public,anon,authenticated,service_role;
create trigger mzs_ops_expense_audit_insert
 after insert on public.mzs_ops_expense_drafts
 for each row execute function mzs_private.mzs_ops_audit_expense_draft();

comment on table public.mzs_ops_expense_drafts is
 'Staging-only immutable supplier cost drafts. No documents, approvals, payments or sales invoices.';
commit;
