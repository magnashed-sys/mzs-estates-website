-- Reuse private retained originals; links never change financial records.
begin;
alter table public.mzs_accountancy_documents drop constraint mzs_accountancy_documents_category_check;
alter table public.mzs_accountancy_documents add constraint mzs_accountancy_documents_category_check check(category in ('balance_sheet','profit_loss','trial_balance','journal','corporate_tax','vat_return','vat_summary','analysis','other','supplier_invoice','purchase_deed'));
create table public.mzs_accountancy_document_links (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.mzs_accountancy_documents(id) on delete restrict,
 draft_id uuid references public.mzs_ops_expense_drafts(id) on delete restrict,
 property_id uuid references public.mzs_estate_properties(id) on delete restrict,
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),
 is_active boolean not null default true,
 removal_reason text not null default '' check(length(removal_reason)<=500),
 removed_by uuid references public.profiles(id),removed_at timestamptz,
 check(num_nonnulls(draft_id,property_id)=1),
 check((is_active and removal_reason='' and removed_by is null and removed_at is null) or
       (not is_active and length(btrim(removal_reason))>=2 and removed_by is not null and removed_at is not null))
);
create unique index accountancy_document_cost_link on public.mzs_accountancy_document_links(document_id,draft_id) where is_active and draft_id is not null;
create unique index accountancy_document_property_link on public.mzs_accountancy_document_links(document_id,property_id) where is_active and property_id is not null;
create index accountancy_document_links_draft on public.mzs_accountancy_document_links(draft_id);
create index accountancy_document_links_property on public.mzs_accountancy_document_links(property_id);
create index accountancy_document_links_creator on public.mzs_accountancy_document_links(created_by);
create index accountancy_document_links_remover on public.mzs_accountancy_document_links(removed_by);
create table public.mzs_accountancy_document_link_events (
 id uuid primary key default gen_random_uuid(),link_id uuid not null references public.mzs_accountancy_document_links(id),
 actor_id uuid not null references public.profiles(id),occurred_at timestamptz not null default now(),
 event_type text not null check(event_type in ('linked','unlinked')),before_data jsonb,after_data jsonb not null
);
create index accountancy_document_link_events_link on public.mzs_accountancy_document_link_events(link_id,occurred_at);
create index accountancy_document_link_events_actor on public.mzs_accountancy_document_link_events(actor_id);
alter table public.mzs_accountancy_document_links enable row level security;
alter table public.mzs_accountancy_document_link_events enable row level security;
revoke all on public.mzs_accountancy_document_links,public.mzs_accountancy_document_link_events from public,anon,authenticated;
grant select on public.mzs_accountancy_document_links,public.mzs_accountancy_document_link_events to authenticated;
grant insert(document_id,draft_id,property_id) on public.mzs_accountancy_document_links to authenticated;
grant update(is_active,removal_reason) on public.mzs_accountancy_document_links to authenticated;
create policy document_links_read on public.mzs_accountancy_document_links for select to authenticated using((select public.is_admin()));
create policy document_links_insert on public.mzs_accountancy_document_links for insert to authenticated with check((select public.is_admin()) and created_by=(select auth.uid()));
create policy document_links_update on public.mzs_accountancy_document_links for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy document_link_events_read on public.mzs_accountancy_document_link_events for select to authenticated using((select public.is_admin()));
create function mzs_private.validate_accountancy_document_link() returns trigger language plpgsql security invoker set search_path='' as $$
declare d public.mzs_accountancy_documents; c public.mzs_ops_expense_drafts;begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required';end if;
 if TG_OP='UPDATE' then
  if not old.is_active or new.is_active or (new.id,new.document_id,new.draft_id,new.property_id,new.created_by,new.created_at) is distinct from (old.id,old.document_id,old.draft_id,old.property_id,old.created_by,old.created_at) then raise exception 'Links can only be removed with a reason';end if;
  new.removed_by:=auth.uid();new.removed_at:=now();return new;
 end if;
 select * into d from public.mzs_accountancy_documents where id=new.document_id for share;
 if d.id is null or d.review_status='superseded' then raise exception 'Available retained document required';end if;
 if new.draft_id is not null then
  select * into c from public.mzs_ops_expense_drafts where id=new.draft_id;
  if c.id is null or c.legal_entity_id<>d.issuer_id or extract(year from c.invoice_date)<>d.fiscal_year then raise exception 'Document entity and year must match invoice';end if;
 elsif new.property_id is not null then
  if not exists(select 1 from public.mzs_ops_property_entity_links l where l.property_id=new.property_id and l.legal_entity_id=d.issuer_id
   and l.effective_from<=coalesce(d.document_date,make_date(d.fiscal_year,12,31)) and (l.effective_until is null or l.effective_until>=coalesce(d.document_date,make_date(d.fiscal_year,1,1)))) then raise exception 'Dated property entity association required';end if;
 end if;
 new.created_by:=auth.uid();new.created_at:=now();new.is_active:=true;new.removal_reason:='';new.removed_by:=null;new.removed_at:=null;return new;
end;$$;
revoke all on function mzs_private.validate_accountancy_document_link() from public,anon,authenticated;
create trigger validate_accountancy_document_link before insert or update on public.mzs_accountancy_document_links for each row execute function mzs_private.validate_accountancy_document_link();
create function mzs_private.audit_accountancy_document_link() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.mzs_accountancy_document_link_events(link_id,actor_id,event_type,before_data,after_data)
 values(new.id,auth.uid(),case when TG_OP='INSERT' then 'linked' else 'unlinked' end,case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;
end;$$;
revoke all on function mzs_private.audit_accountancy_document_link() from public,anon,authenticated;
create trigger audit_accountancy_document_link after insert or update on public.mzs_accountancy_document_links for each row execute function mzs_private.audit_accountancy_document_link();
commit;
