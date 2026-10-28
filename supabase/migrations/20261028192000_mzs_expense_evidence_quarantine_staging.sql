-- MZS Group / STAGING ONLY / FAIL-CLOSED EVIDENCE QUARANTINE.
-- This is NOT a malware scanner. No scanner is connected in this release.
-- No document may be downloaded or submitted/approved without a trustworthy
-- future service_role scanner verdict for the immutable matching SHA-256.
-- Production has no document bucket/tables: DO NOT APPLY TO PRODUCTION.
begin;

create table public.mzs_ops_expense_document_scan_events (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.mzs_ops_expense_documents(id) on delete restrict,
  observed_sha256 text not null check(observed_sha256 ~ '^[0-9a-f]{64}$'),
  verdict text not null check(verdict in ('clean','malicious','unscannable')),
  scanner_engine text not null check(length(btrim(scanner_engine)) between 6 and 100
    and scanner_engine !~ '[[:cntrl:]]'),
  scanner_version text not null check(length(btrim(scanner_version)) between 1 and 100
    and scanner_version !~ '[[:cntrl:]]'),
  scan_reference text not null unique check(length(btrim(scan_reference)) between 12 and 250
    and scan_reference !~ '[[:cntrl:]]'),
  observed_at timestamptz not null default now()
);
create index ops_evidence_scan_doc_latest on public.mzs_ops_expense_document_scan_events(document_id,id desc);
alter table public.mzs_ops_expense_document_scan_events enable row level security;
revoke all on public.mzs_ops_expense_document_scan_events from public,anon,authenticated,service_role;
revoke all on sequence public.mzs_ops_expense_document_scan_events_id_seq
  from public,anon,authenticated,service_role;
grant select on public.mzs_ops_expense_document_scan_events to authenticated;
grant insert(document_id,observed_sha256,verdict,scanner_engine,scanner_version,scan_reference)
  on public.mzs_ops_expense_document_scan_events to service_role;
create policy ops_evidence_scan_admin_read
 on public.mzs_ops_expense_document_scan_events for select to authenticated
 using((select public.is_admin()));

-- A future external malware scanner must perform a privileged, evidence-linked
-- verdict insert. Merely setting user metadata or submitting UI fields is never
-- sufficient. This connector deliberately does not create a scanner or fake verdict.
create function mzs_private.ops_evidence_scan_validate()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare original_sha text;
begin
 if current_user <> 'service_role' then
   raise exception 'Trusted scanner role required' using errcode='42501';
 end if;
 select d.sha256 into original_sha from public.mzs_ops_expense_documents d
 where d.id=new.document_id for update;
 if original_sha is null or original_sha is distinct from new.observed_sha256 then
   raise exception 'Scan must match the immutable source SHA-256' using errcode='23514';
 end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_evidence_scan_validate()
 from public,anon,authenticated,service_role;
create trigger ops_evidence_scan_validate_before_insert
 before insert on public.mzs_ops_expense_document_scan_events
 for each row execute function mzs_private.ops_evidence_scan_validate();

-- Authorised admins can see the scan *journal*, but cannot invent or alter
-- a verdict. Nobody can UPDATE or DELETE the journal through the API.
-- The latest verdict wins (a later malicious/unscannable event revokes access).
drop policy if exists ops_evidence_read on storage.objects;
create policy ops_evidence_read on storage.objects
 for select to authenticated using (
  bucket_id='mzs-ops-expense-evidence'
  and (select public.is_admin())
  and exists (
   select 1 from public.mzs_ops_expense_documents d
   where d.storage_path=storage.objects.name
    and (
      select e.verdict='clean' and e.observed_sha256=d.sha256
      from public.mzs_ops_expense_document_scan_events e
      where e.document_id=d.id order by e.id desc limit 1
    ) is true
  )
 );

-- Submitting or approving a cost without the latest matching CLEAN scan is
-- impossible even by direct Data API insertion, independently of the UI.
create function mzs_private.ops_evidence_review_scan_gate()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare source_id uuid; expected_sha text; cleared boolean;
begin
 if new.action in ('submitted','approved') then
   select d.id,d.sha256 into source_id,expected_sha
   from public.mzs_ops_expense_documents d
   where d.draft_id=new.draft_id;
   if source_id is null then
     raise exception 'Original supplier document required' using errcode='23514';
   end if;
   select (e.verdict='clean' and e.observed_sha256=expected_sha)
   into cleared from public.mzs_ops_expense_document_scan_events e
   where e.document_id=source_id order by e.id desc limit 1;
   if cleared is distinct from true then
     raise exception 'Document is in quarantine until trusted scanner clearance'
       using errcode='42501';
   end if;
 end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_evidence_review_scan_gate()
 from public,anon,authenticated,service_role;
create trigger ops_evidence_review_scan_gate_before_insert
 before insert on public.mzs_ops_expense_review_events
 for each row execute function mzs_private.ops_evidence_review_scan_gate();

comment on table public.mzs_ops_expense_document_scan_events is
 'Staging-only immutable scanner journal. Empty until independently integrated trusted AV scanner. No mock clean events.';
comment on policy ops_evidence_read on storage.objects is
 'STRICT QUARANTINE. Admin download only after the latest authenticated scanner SHA-linked verdict is clean.';

commit;
