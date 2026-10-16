-- MZS Group | Project Cockpit secure project documents v1
-- ADDITIVE ONLY. Apply to isolated MZS Staging first. NEVER publish without approval.
begin;

create table if not exists public.mzs_project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  offering_id uuid references public.offerings(id) on delete restrict,
  file_path text not null unique,
  title text not null,
  description text,
  mime_type text not null,
  file_size_bytes bigint not null,
  category text not null default 'other',
  position integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mzs_doc_title_check check (char_length(btrim(title)) between 2 and 160),
  constraint mzs_doc_description_check check (description is null or char_length(description) <= 2000),
  constraint mzs_doc_path_check check (file_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|webp|docx|xlsx)$'),
  constraint mzs_doc_mime_check check (mime_type in (
    'application/pdf','image/png','image/jpeg','image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  constraint mzs_doc_size_check check (file_size_bytes between 1 and 20971520),
  constraint mzs_doc_category_check check (category in ('presentation','financial','floorplan','permit','legal','photo','other')),
  constraint mzs_doc_position_check check (position between 0 and 100000)
);

create index if not exists mzs_project_docs_project_order
  on public.mzs_project_documents(project_id,position,created_at);
create index if not exists mzs_project_docs_offering_id
  on public.mzs_project_documents(offering_id);

-- Reject misleading document metadata for an offering from another project.
create or replace function public.mzs_validate_project_document()
returns trigger language plpgsql security invoker
set search_path = ''
as $$
begin
  if split_part(new.file_path, '/', 1) <> new.project_id::text then
    raise exception 'Document path must belong to this project';
  end if;
  if new.offering_id is not null and not exists (
    select 1 from public.offerings o
    where o.id = new.offering_id and o.project_id = new.project_id
  ) then
    raise exception 'Document offering must belong to its project';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists mzs_validate_project_document_trigger on public.mzs_project_documents;
create trigger mzs_validate_project_document_trigger
  before insert or update on public.mzs_project_documents
  for each row execute function public.mzs_validate_project_document();

alter table public.mzs_project_documents enable row level security;

drop policy if exists mzs_documents_admin_all on public.mzs_project_documents;
create policy mzs_documents_admin_all on public.mzs_project_documents
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists mzs_documents_member_read on public.mzs_project_documents;
create policy mzs_documents_member_read on public.mzs_project_documents
  for select to authenticated
  using (
    is_published = true
    and (select public.is_active_member())
    and exists (
      select 1 from public.project_access pa
      join public.projects p on p.id = pa.project_id
      where pa.project_id = mzs_project_documents.project_id
        and pa.user_id = (select auth.uid())
        and p.status = 'active'
    )
    and (
      offering_id is null
      or exists (
        select 1 from public.offering_access oa
        join public.offerings o on o.id = oa.offering_id
        where oa.user_id = (select auth.uid())
          and oa.offering_id = mzs_project_documents.offering_id
          and o.status = 'active'
      )
    )
  );

revoke all on public.mzs_project_documents from anon;
grant select, insert, update, delete on public.mzs_project_documents to authenticated;

-- A PRIVATE storage bucket. Never expose file URLs as public URLs.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'mzs-private-project-documents', 'mzs-private-project-documents', false, 20971520,
  array['application/pdf','image/png','image/jpeg','image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;

drop policy if exists mzs_documents_storage_admin_insert on storage.objects;
create policy mzs_documents_storage_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'mzs-private-project-documents'
    and (select public.is_admin())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|webp|docx|xlsx)$'
  );

drop policy if exists mzs_documents_storage_admin_delete on storage.objects;
create policy mzs_documents_storage_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'mzs-private-project-documents'
    and (select public.is_admin())
  );

drop policy if exists mzs_documents_storage_member_read on storage.objects;
create policy mzs_documents_storage_member_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mzs-private-project-documents'
    and (
      (select public.is_admin())
      or exists (
        select 1 from public.mzs_project_documents d
        where d.file_path = storage.objects.name
          and d.is_published = true
      )
    )
  );

commit;
