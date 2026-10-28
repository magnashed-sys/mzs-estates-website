-- STAGING ONLY — private supplier invoice evidence and append-only review
-- Requires 20261028115000 and 20261028123000 MZS Ops migrations.
-- No Production promotion, outgoing invoice, payment, accounting export, or staff roles.
begin;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('mzs-ops-expense-evidence','mzs-ops-expense-evidence',false,10485760,
 array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create table public.mzs_ops_expense_documents (
 id uuid primary key default gen_random_uuid(),
 draft_id uuid not null references public.mzs_ops_expense_drafts(id) on delete restrict,
 storage_path text not null unique check (
   storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'
   and length(storage_path) < 130
 ),
 sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
 mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
 file_size bigint not null check (file_size between 1 and 10485760),
 uploaded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(draft_id)
);
create index mzs_ops_doc_draft_idx on public.mzs_ops_expense_documents(draft_id);
alter table public.mzs_ops_expense_documents enable row level security;
revoke all on public.mzs_ops_expense_documents from public,anon,authenticated,service_role;
grant select on public.mzs_ops_expense_documents to authenticated;
grant insert(draft_id,storage_path,sha256,mime_type,file_size)
 on public.mzs_ops_expense_documents to authenticated;
create policy ops_documents_admin_read on public.mzs_ops_expense_documents
 for select to authenticated using((select public.is_admin()));
create policy ops_documents_admin_insert on public.mzs_ops_expense_documents
 for insert to authenticated with check(
  (select public.is_admin()) and uploaded_by = (select auth.uid())
 );

create function mzs_private.ops_validate_evidence()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare d public.mzs_ops_expense_drafts; existing record;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
   or new.uploaded_by is distinct from (select auth.uid())
 then raise exception 'Administrator document access required' using errcode='42501';end if;
 select * into d from public.mzs_ops_expense_drafts where id=new.draft_id for update;
 if not found then raise exception 'Unknown expense draft';end if;
 if split_part(new.storage_path,'/',1) <> d.id::text
    or new.storage_path !~ ('^'||d.id::text||'/[0-9a-f-]{36}\.(pdf|jpg|png)$')
 then raise exception 'Document path does not match invoice draft';end if;
 if exists(select 1 from public.mzs_ops_expense_review_events where draft_id=d.id)
 then raise exception 'Reviewed drafts cannot receive a new original document';end if;
 if not exists(
  select 1 from storage.objects o
  where o.bucket_id='mzs-ops-expense-evidence' and o.name=new.storage_path
 ) then raise exception 'Original document has not been uploaded';end if;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_evidence()
 from public,anon,authenticated,service_role;
create trigger ops_document_valid before insert on public.mzs_ops_expense_documents
for each row execute function mzs_private.ops_validate_evidence();

-- Read-only document metadata and append-only event journal.
create table public.mzs_ops_expense_review_events (
 id bigint generated always as identity primary key,
 draft_id uuid not null references public.mzs_ops_expense_drafts(id) on delete restrict,
 sequence_no integer not null default 0,
 action text not null check (action in ('submitted','approved','rejected')),
 expected_state text not null check (expected_state in ('draft','submitted')),
 reason text not null default '' check(length(reason)<=1000),
 actor_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(draft_id,sequence_no)
);
create index ops_review_draft_idx on public.mzs_ops_expense_review_events(draft_id,sequence_no desc);
alter table public.mzs_ops_expense_review_events enable row level security;
revoke all on public.mzs_ops_expense_review_events from public,anon,authenticated,service_role;
revoke all on sequence public.mzs_ops_expense_review_events_id_seq from public,anon,authenticated,service_role;
grant select on public.mzs_ops_expense_review_events to authenticated;
grant insert(draft_id,action,expected_state,reason) on public.mzs_ops_expense_review_events to authenticated;
create policy ops_review_admin_read on public.mzs_ops_expense_review_events
 for select to authenticated using ((select public.is_admin()));
create policy ops_review_admin_insert on public.mzs_ops_expense_review_events
 for insert to authenticated with check ((select public.is_admin())
   and actor_id = (select auth.uid()));

create function mzs_private.ops_validate_review()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare prev text:='draft'; seq integer:=0; d public.mzs_ops_expense_drafts;
begin
 if (select auth.uid()) is null or (select public.is_admin()) is distinct from true
    or new.actor_id is distinct from (select auth.uid())
 then raise exception 'Administrator review required' using errcode='42501';end if;
 select * into d from public.mzs_ops_expense_drafts where id=new.draft_id for update;
 if not found then raise exception 'Draft not found';end if;
 select action,sequence_no into prev,seq
 from public.mzs_ops_expense_review_events where draft_id=new.draft_id
 order by sequence_no desc limit 1;
 prev:=coalesce(prev,'draft');seq:=coalesce(seq,0);
 if new.expected_state<>prev then raise exception 'Stale expense review';end if;
 if not (
    (prev='draft' and new.action='submitted') or
    (prev='submitted' and new.action in ('approved','rejected'))
 ) then raise exception 'Invalid review transition';end if;
 if new.action='rejected' and length(btrim(new.reason))<8
 then raise exception 'Rejection requires a reason';end if;
 if new.action='approved' and d.gross_cents<=0
 then raise exception 'Invalid cost totals';end if;
 if not exists(select 1 from public.mzs_ops_expense_documents
   where draft_id=new.draft_id)
 then raise exception 'Original supplier document required';end if;
 new.sequence_no:=seq+1;
 return new;
end $fn$;
revoke all on function mzs_private.ops_validate_review()
 from public,anon,authenticated,service_role;
create trigger ops_review_validation before insert on public.mzs_ops_expense_review_events
for each row execute function mzs_private.ops_validate_review();

-- Storage metadata is read-only except for exact API upload/removal permitted by RLS.
-- All file operations MUST use the Supabase Storage API, never SQL metadata changes.
create policy ops_evidence_upload on storage.objects
 for insert to authenticated with check(
  bucket_id='mzs-ops-expense-evidence'
  and (select public.is_admin())
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'
  and exists(select 1 from public.mzs_ops_expense_drafts d
   where d.id::text=split_part(name,'/',1)
    and not exists(select 1 from public.mzs_ops_expense_documents e where e.draft_id=d.id)
    and not exists(select 1 from public.mzs_ops_expense_review_events r where r.draft_id=d.id))
 );
create policy ops_evidence_read on storage.objects
 for select to authenticated using(
  bucket_id='mzs-ops-expense-evidence'
  and (select public.is_admin())
  and exists(select 1 from public.mzs_ops_expense_drafts d
   where d.id::text=split_part(name,'/',1))
 );
create policy ops_evidence_remove_unregistered on storage.objects
 for delete to authenticated using(
  bucket_id='mzs-ops-expense-evidence'
  and (select public.is_admin())
  and not exists(select 1 from public.mzs_ops_expense_documents e
    where e.storage_path=name)
  and exists(select 1 from public.mzs_ops_expense_drafts d
   where d.id::text=split_part(name,'/',1))
 );

comment on table public.mzs_ops_expense_documents is
 'Staging-only immutable original supplier evidence. Storage bucket is private. No overwrite.';
comment on table public.mzs_ops_expense_review_events is
 'Append-only reviewed supplier cost status, no money movement or sales invoice.';
commit;
