-- MZS Group / STAGING ONLY. Evidence retention proposals and irrevocable holds.
-- No automatic deletion, storage read grants, policy approval, legal time assumptions
-- or Production effects. The local accountant must verify the applicable duration.
begin;
create table public.mzs_ops_expense_retention_proposals(
 id uuid primary key default gen_random_uuid(),
 legal_entity_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
 jurisdiction_code text not null check(jurisdiction_code ~ '^[A-Z]{2}$'),
 category text not null default 'supplier_invoice' check(category='supplier_invoice'),
 proposed_years integer not null check(proposed_years between 1 and 30),
 legal_source_reference text not null check(length(btrim(legal_source_reference)) between 12 and 1000
  and legal_source_reference !~ '[[:cntrl:]]'),
 status text not null default 'pending_local_accountant_review'
  check(status='pending_local_accountant_review'),
 proposed_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(legal_entity_id,jurisdiction_code,category)
);
create index ops_retention_proposals_actor on public.mzs_ops_expense_retention_proposals(proposed_by);
alter table public.mzs_ops_expense_retention_proposals enable row level security;
revoke all on public.mzs_ops_expense_retention_proposals from public,anon,authenticated,service_role;
grant select on public.mzs_ops_expense_retention_proposals to authenticated;
grant insert(legal_entity_id,jurisdiction_code,proposed_years,legal_source_reference)
 on public.mzs_ops_expense_retention_proposals to authenticated;
create policy ops_retention_proposals_admin_read on public.mzs_ops_expense_retention_proposals
 for select to authenticated using((select public.is_admin()));
create policy ops_retention_proposals_admin_insert on public.mzs_ops_expense_retention_proposals
 for insert to authenticated with check(
  proposed_by=(select auth.uid()) and (select auth.uid()) is not null and
  (select public.is_admin())
 );
create table public.mzs_ops_expense_document_holds(
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null unique references public.mzs_ops_expense_documents(id) on delete restrict,
 hold_reason text not null check(length(btrim(hold_reason)) between 12 and 1000
  and hold_reason !~ '[[:cntrl:]]'),
 disposition text not null default 'legal_hold_no_deletion'
  check(disposition='legal_hold_no_deletion'),
 created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index ops_document_hold_actor on public.mzs_ops_expense_document_holds(created_by);
alter table public.mzs_ops_expense_document_holds enable row level security;
revoke all on public.mzs_ops_expense_document_holds from public,anon,authenticated,service_role;
grant select on public.mzs_ops_expense_document_holds to authenticated;
grant insert(document_id,hold_reason) on public.mzs_ops_expense_document_holds to authenticated;
create policy ops_document_hold_admin_read on public.mzs_ops_expense_document_holds
 for select to authenticated using((select public.is_admin()));
create policy ops_document_hold_admin_insert on public.mzs_ops_expense_document_holds
 for insert to authenticated with check(
  created_by=(select auth.uid()) and (select auth.uid()) is not null and
  (select public.is_admin())
 );
-- Permanent append-only records. Even without a hold there is NO deletion API.
-- A later reviewed release must implement any legal-hold release and retention expiry.
comment on table public.mzs_ops_expense_retention_proposals is
 'NON-BINDING retention proposals: local accountants must review. No deletion/expiry automation.';
comment on table public.mzs_ops_expense_document_holds is
 'Append-only explicit legal holds. No release/deletion implemented; source evidence stays immutable.';
commit;
