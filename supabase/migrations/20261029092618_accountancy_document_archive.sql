-- Private entity/year reference documents. No ledger or tax-status mutations.
begin;
create table public.mzs_accountancy_documents (
 id uuid primary key default gen_random_uuid(),
 issuer_id uuid not null references public.mzs_lease_issuers(id) on delete restrict,
 fiscal_year integer not null check(fiscal_year between 1900 and 2199),
 title text not null check(length(btrim(title)) between 2 and 160),
 original_name text not null check(length(original_name) between 1 and 255 and original_name !~ '[\r\n/]'),
 category text not null check(category in ('balance_sheet','profit_loss','trial_balance','journal','corporate_tax','vat_return','vat_summary','analysis','other')),
 period_label text not null default '' check(length(period_label)<=40),
 document_date date,
 review_status text not null default 'pending_review' check(review_status in ('pending_review','needs_attention','reviewed','superseded')),
 notes text not null default '' check(length(notes)<=4000),
 file_path text not null unique,
 mime_type text not null default 'application/pdf' check(mime_type='application/pdf'),
 file_size_bytes bigint not null check(file_size_bytes between 5 and 20971520),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 created_by uuid references public.profiles(id) on delete restrict default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision integer not null default 1 check(revision>0),
 unique(issuer_id,fiscal_year,sha256),
 check(file_path=issuer_id::text||'/'||fiscal_year::text||'/'||id::text||'.pdf')
);
create index mzs_accountancy_documents_year on public.mzs_accountancy_documents(fiscal_year desc,issuer_id,created_at desc,id);
create index mzs_accountancy_documents_issuer on public.mzs_accountancy_documents(issuer_id,fiscal_year desc);
create index mzs_accountancy_documents_creator on public.mzs_accountancy_documents(created_by);

create table public.mzs_accountancy_document_events (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.mzs_accountancy_documents(id) on delete restrict,
 actor_id uuid references public.profiles(id) on delete restrict,
 occurred_at timestamptz not null default now(),
 event_type text not null check(event_type in ('created','updated')),
 before_data jsonb,
 after_data jsonb not null
);
create index mzs_accountancy_document_events_document on public.mzs_accountancy_document_events(document_id,occurred_at,id);
create index mzs_accountancy_document_events_actor on public.mzs_accountancy_document_events(actor_id);
create table public.mzs_admin_language_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 language text not null check(language in ('en','es'))
);
alter table public.mzs_accountancy_documents enable row level security;
alter table public.mzs_accountancy_document_events enable row level security;
alter table public.mzs_admin_language_preferences enable row level security;
revoke all on public.mzs_accountancy_documents,public.mzs_accountancy_document_events,public.mzs_admin_language_preferences from anon,authenticated;
grant select,insert on public.mzs_accountancy_documents to authenticated;
grant update(title,category,period_label,document_date,review_status,notes) on public.mzs_accountancy_documents to authenticated;
grant select on public.mzs_accountancy_document_events to authenticated;
grant select,insert,update on public.mzs_admin_language_preferences to authenticated;
grant all on public.mzs_accountancy_documents,public.mzs_accountancy_document_events,public.mzs_admin_language_preferences to service_role;
create policy accountancy_docs_admin_read on public.mzs_accountancy_documents for select to authenticated using((select public.is_admin()));
create policy accountancy_docs_admin_insert on public.mzs_accountancy_documents for insert to authenticated with check((select public.is_admin()) and created_by=(select auth.uid()));
create policy accountancy_docs_admin_update on public.mzs_accountancy_documents for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy accountancy_events_admin_read on public.mzs_accountancy_document_events for select to authenticated using((select public.is_admin()));
create policy admin_language_read on public.mzs_admin_language_preferences for select to authenticated using(user_id=(select auth.uid()) and (select public.is_admin()));
create policy admin_language_insert on public.mzs_admin_language_preferences for insert to authenticated with check(user_id=(select auth.uid()) and (select public.is_admin()));
create policy admin_language_update on public.mzs_admin_language_preferences for update to authenticated using(user_id=(select auth.uid()) and (select public.is_admin())) with check(user_id=(select auth.uid()) and (select public.is_admin()));

create or replace function mzs_private.validate_accountancy_document()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Archive originals must be retained';end if;
 if TG_OP='INSERT' then
  if not exists(select 1 from storage.objects where bucket_id='mzs-private-accountancy-documents' and name=new.file_path
   and (metadata->>'size')::bigint=new.file_size_bytes and metadata->>'mimetype'='application/pdf') then
   raise exception 'Matching private PDF must be uploaded first';
  end if;
  new.revision:=1;new.created_at:=now();
 else
  if (new.id,new.issuer_id,new.fiscal_year,new.original_name,new.file_path,new.mime_type,new.file_size_bytes,new.sha256,new.created_by,new.created_at)
    is distinct from (old.id,old.issuer_id,old.fiscal_year,old.original_name,old.file_path,old.mime_type,old.file_size_bytes,old.sha256,old.created_by,old.created_at) then
   raise exception 'Archive identity and original file are immutable';
  end if;
  new.revision:=old.revision+1;
 end if;
 new.updated_at:=now();return new;
end;$$;
revoke all on function mzs_private.validate_accountancy_document() from public,anon,authenticated;
create trigger validate_accountancy_document before insert or update or delete on public.mzs_accountancy_documents for each row execute function mzs_private.validate_accountancy_document();

-- The trigger alone may write the append-only audit trail. Never an exposed RPC.
create or replace function mzs_private.audit_accountancy_document()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.mzs_accountancy_document_events(document_id,actor_id,event_type,before_data,after_data)
 values(new.id,auth.uid(),case when TG_OP='INSERT' then 'created' else 'updated' end,
  case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end;$$;
revoke all on function mzs_private.audit_accountancy_document() from public,anon,authenticated;
create trigger audit_accountancy_document after insert or update on public.mzs_accountancy_documents for each row execute function mzs_private.audit_accountancy_document();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('mzs-private-accountancy-documents','mzs-private-accountancy-documents',false,20971520,array['application/pdf']);
create policy accountancy_storage_read on storage.objects for select to authenticated
 using(bucket_id='mzs-private-accountancy-documents' and (select public.is_admin()));
create policy accountancy_storage_insert on storage.objects for insert to authenticated
 with check(bucket_id='mzs-private-accountancy-documents' and (select public.is_admin())
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(19|20|21)[0-9]{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]pdf$'
  and exists(select 1 from public.mzs_lease_issuers where id::text=split_part(storage.objects.name,'/',1)));
-- Cleanup is restricted to uploads that never became retained documents.
create policy accountancy_storage_cleanup on storage.objects for delete to authenticated
 using(bucket_id='mzs-private-accountancy-documents' and (select public.is_admin())
  and not exists(select 1 from public.mzs_accountancy_documents where file_path=storage.objects.name));
commit;
