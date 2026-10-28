-- PROPERTY OPERATIONS / ACCOUNTANCY — PHASE 1 REVIEW SCHEMA
-- 28 October 2026
--
-- IMPORTANT: DESIGN REVIEW ONLY. NOT A MIGRATION. DO NOT EXECUTE AGAINST
-- PRODUCTION OR STAGING. This file lives in supabase/plans, not migrations.
-- Once scope, access, tests and accountant export format are approved,
-- generate an actual migration through the Supabase CLI, review it and deploy
-- first to Staging under a separate explicit release step.
--
-- Existing entities / physical objects / relationships are reused.
-- All proposed tables are RLS enabled and initially read-only; secure
-- review/approval entry points and write grants are intentionally absent.
-- Cross-table invariants (100% allocation, totals, supplier duplicate
-- exception and verified entity ownership) must be checked atomically by
-- a future audited server/database approval operation.

begin;

create table public.mzs_ops_property_entity_links (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.mzs_estate_properties(id) on delete restrict,
  legal_entity_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
  relationship_type text not null check (relationship_type in ('owner','payer','manager')),
  effective_from date not null,
  effective_until date check (effective_until is null or effective_until >= effective_from),
  verified_by uuid references public.profiles(id) on delete restrict,
  verified_at timestamptz,
  evidence_reference text not null default '' check (length(evidence_reference) <= 500),
  created_at timestamptz not null default now(),
  unique (property_id,legal_entity_id,relationship_type,effective_from),
  check ((verified_at is null) = (verified_by is null))
);
create index mzs_ops_link_by_entity
 on public.mzs_ops_property_entity_links(legal_entity_id,property_id,effective_from);
create index mzs_ops_link_by_property
 on public.mzs_ops_property_entity_links(property_id,relationship_type,effective_from);

-- Source attachments will be uploaded to a private Storage bucket only after
-- dedicated owner-approved upload/read/remove policies are implemented.
-- Object paths are opaque; never embed customer PII in them.
create table public.mzs_ops_expense_documents (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
  storage_path text not null unique check (length(storage_path) between 8 and 500),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  file_size bigint not null check(file_size > 0 and file_size <= 10485760),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index mzs_ops_doc_by_entity_hash
 on public.mzs_ops_expense_documents(legal_entity_id,sha256);

-- An expense belongs to exactly one legal entity. Entity IDs, not names,
-- determine legal attribution. No new invoice numbers are issued here.
create table public.mzs_ops_purchase_expenses (
  id uuid primary key default gen_random_uuid(),
  legal_entity_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
  supplier_relationship_id uuid not null references public.mzs_lease_relationships(id) on delete restrict,
  supplier_name_snapshot text not null check (length(btrim(supplier_name_snapshot)) between 2 and 200),
  supplier_invoice_number text not null check (length(btrim(supplier_invoice_number)) between 1 and 100),
  source_document_id uuid references public.mzs_ops_expense_documents(id) on delete restrict,
  currency text not null default 'EUR' check (currency = 'EUR'),
  invoice_date date not null,
  due_date date,
  service_period_start date,
  service_period_end date,
  status text not null default 'draft' check (status in ('draft','submitted','reviewed','approved','rejected','voided')),
  net_cents bigint not null check (net_cents >= 0 and net_cents <= 100000000000),
  vat_cents bigint not null check (vat_cents >= 0 and vat_cents <= 100000000000),
  gross_cents bigint not null check (gross_cents = net_cents + vat_cents),
  notes text not null default '' check (length(notes)<=4000),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  revision integer not null default 1 check(revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((service_period_start is null) = (service_period_end is null)),
  check (service_period_end is null or service_period_start <= service_period_end),
  check ((reviewed_by is null) = (reviewed_at is null))
);
create index mzs_ops_expense_entity_period
 on public.mzs_ops_purchase_expenses(legal_entity_id,invoice_date desc,id);
create index mzs_ops_expense_doc on public.mzs_ops_purchase_expenses(source_document_id);
-- This is deliberately non-unique. A separate approval-time duplicate detector
-- must flag likely duplicates and require an explicit reviewer exception.
create index mzs_ops_expense_supplier_ref
 on public.mzs_ops_purchase_expenses(legal_entity_id,supplier_relationship_id,upper(btrim(supplier_invoice_number)));

create table public.mzs_ops_expense_lines (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.mzs_ops_purchase_expenses(id) on delete restrict,
  line_number integer not null check (line_number > 0 and line_number <= 60),
  category text not null check (category in (
    'electricity','gas','water','cleaning','internet','insurance',
    'taxes','maintenance','materials','management','other'
  )),
  description text not null check (length(btrim(description)) between 2 and 500),
  net_cents bigint not null check (net_cents >= 0),
  vat_cents bigint not null check (vat_cents >= 0),
  gross_cents bigint not null check (gross_cents = net_cents + vat_cents and gross_cents > 0),
  unique(expense_id,line_number)
);
create index mzs_ops_expense_lines_parent on public.mzs_ops_expense_lines(expense_id);

-- Percentages and cents must total exactly to their expense line in a single
-- reviewed transaction. Unit-parent and verified legal entity/property link
-- must be checked against the real database, not a browser supplied list.
create table public.mzs_ops_expense_allocations (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.mzs_ops_expense_lines(id) on delete restrict,
  property_id uuid not null references public.mzs_estate_properties(id) on delete restrict,
  unit_id uuid references public.mzs_estate_units(id) on delete restrict,
  basis_points integer not null check(basis_points between 1 and 10000),
  net_cents bigint not null check(net_cents >= 0),
  vat_cents bigint not null check(vat_cents >= 0),
  gross_cents bigint not null check(gross_cents = net_cents + vat_cents),
  unique nulls not distinct(line_id,property_id,unit_id)
);
create index mzs_ops_alloc_property on public.mzs_ops_expense_allocations(property_id,unit_id);

create table public.mzs_ops_expense_audit (
  id bigint generated always as identity primary key,
  expense_id uuid not null references public.mzs_ops_purchase_expenses(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  action text not null check (action in ('created','submitted','reviewed','approved','rejected','corrected','voided')),
  before_record jsonb,
  after_record jsonb,
  reason text not null default '' check (length(reason)<=1000),
  created_at timestamptz not null default now()
);
create index mzs_ops_expense_audit_order
 on public.mzs_ops_expense_audit(expense_id,created_at,id);

-- Defense in depth: permissions are intentionally READ ONLY for full Group
-- administrators. No staff, client or partner permissions in this first phase.
-- Direct browser writes for approved financial records must NOT be granted.
do $$
declare table_name text;
begin
 foreach table_name in array array[
   'mzs_ops_property_entity_links','mzs_ops_expense_documents',
   'mzs_ops_purchase_expenses','mzs_ops_expense_lines',
   'mzs_ops_expense_allocations','mzs_ops_expense_audit'
 ] loop
   execute format('alter table public.%I enable row level security',table_name);
   execute format('revoke all on public.%I from public,anon,authenticated',table_name);
   execute format('grant select on public.%I to authenticated',table_name);
   execute format(
     'create policy mzs_ops_group_admin_read on public.%I for select to authenticated using ((select public.is_admin()))',
     table_name
   );
 end loop;
end $$;

-- Intentionally do not grant sequence USAGE or INSERT on any financial table.
-- No Storage buckets, staff roles, invoice emails or operational data created.
rollback; -- DRY RUN ONLY, including if an operator executes the file by mistake.
