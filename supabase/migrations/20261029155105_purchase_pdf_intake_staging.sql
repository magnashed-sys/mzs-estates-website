-- STAGING ONLY: PDF-first purchase intake. No data seeded; no payment/ledger writes.
begin;
create table public.mzs_purchase_pdf_intakes(
 id uuid primary key, year_id uuid not null references public.mzs_accountancy_years(id),
 issuer_id uuid not null references public.mzs_lease_issuers(id),
 original_name text not null check(length(original_name) between 1 and 160 and original_name !~ '[[:cntrl:]]'),
 file_path text not null unique, sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 file_size integer not null check(file_size between 128 and 4194304),
 uploaded_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 unique(issuer_id,sha256),check(file_path=issuer_id::text||'/'||id::text||'.pdf')
);
create table public.mzs_purchase_pdf_results(
 id uuid primary key default gen_random_uuid(),intake_id uuid not null unique references public.mzs_purchase_pdf_intakes(id),
 sha256 text not null,verdict text not null check(verdict in('clean','malicious','unscannable')),
 scanner text not null check(scanner='Cloudmersive Advanced Virus Scan v1'),
 extraction text not null check(extraction in('text','manual','blocked')),
 pages jsonb not null default '[]' check(jsonb_typeof(pages)='array' and jsonb_array_length(pages)<=20 and octet_length(pages::text)<=300000),
 proposal jsonb not null default '{}' check(jsonb_typeof(proposal)='object' and octet_length(proposal::text)<=10000),
 created_at timestamptz not null default now(),
 check((verdict='clean' and extraction in('text','manual')) or (verdict<>'clean' and extraction='blocked' and pages='[]'::jsonb and proposal='{}'::jsonb))
);
create table public.mzs_purchase_pdf_decisions(
 intake_id uuid primary key references public.mzs_purchase_pdf_intakes(id),
 result_id uuid not null references public.mzs_purchase_pdf_results(id),
 action text not null check(action in('accepted','rejected')),
 draft_id uuid unique references public.mzs_ops_expense_drafts(id),
 reason text not null check(length(btrim(reason)) between 5 and 2000),
 confirmed_fields jsonb not null,
 actor_id uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 check((action='accepted' and draft_id is not null) or (action='rejected' and draft_id is null))
);
create index mzs_purchase_intake_year on public.mzs_purchase_pdf_intakes(year_id);
create index mzs_purchase_intake_uploader on public.mzs_purchase_pdf_intakes(uploaded_by);
create index mzs_purchase_decision_result on public.mzs_purchase_pdf_decisions(result_id);
create index mzs_purchase_decision_actor on public.mzs_purchase_pdf_decisions(actor_id);
alter table public.mzs_purchase_pdf_intakes enable row level security;
alter table public.mzs_purchase_pdf_results enable row level security;
alter table public.mzs_purchase_pdf_decisions enable row level security;
revoke all on public.mzs_purchase_pdf_intakes,public.mzs_purchase_pdf_results,public.mzs_purchase_pdf_decisions from public,anon,authenticated,service_role;
grant select on public.mzs_purchase_pdf_intakes,public.mzs_purchase_pdf_results,public.mzs_purchase_pdf_decisions to authenticated,service_role;
grant insert on public.mzs_purchase_pdf_intakes,public.mzs_purchase_pdf_results to service_role;
create policy purchase_intake_admin on public.mzs_purchase_pdf_intakes for select to authenticated using((select public.is_admin()));
create policy purchase_result_admin on public.mzs_purchase_pdf_results for select to authenticated using((select public.is_admin()));
create policy purchase_decision_admin on public.mzs_purchase_pdf_decisions for select to authenticated using((select public.is_admin()));
create function mzs_private.purchase_pdf_validate() returns trigger language plpgsql security definer set search_path='' as $$
declare i public.mzs_purchase_pdf_intakes;
begin
 if tg_table_name='mzs_purchase_pdf_intakes' then
  if not exists(select 1 from public.mzs_accountancy_years y where y.id=new.year_id and y.issuer_id=new.issuer_id) or not exists(select 1 from public.profiles where id=new.uploaded_by and role='admin' and is_active) then raise exception 'Invalid intake scope';end if;
 else
  select * into strict i from public.mzs_purchase_pdf_intakes where id=new.intake_id for update;
  if new.sha256<>i.sha256 then raise exception 'Source checksum mismatch';end if;
  if not exists(select 1 from storage.objects where bucket_id='mzs-purchase-pdf-quarantine' and name=i.file_path and (metadata->>'size')::bigint=i.file_size) then raise exception 'Original file missing';end if;
 end if;return new;
end $$;
revoke all on function mzs_private.purchase_pdf_validate() from public,anon,authenticated,service_role;
create trigger purchase_intake_validate before insert on public.mzs_purchase_pdf_intakes for each row execute function mzs_private.purchase_pdf_validate();
create trigger purchase_result_validate before insert on public.mzs_purchase_pdf_results for each row execute function mzs_private.purchase_pdf_validate();
create function mzs_private.purchase_pdf_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Purchase source and decisions are immutable';end $$;
revoke all on function mzs_private.purchase_pdf_immutable() from public,anon,authenticated,service_role;
create trigger purchase_intake_immutable before update or delete on public.mzs_purchase_pdf_intakes for each row execute function mzs_private.purchase_pdf_immutable();
create trigger purchase_result_immutable before update or delete on public.mzs_purchase_pdf_results for each row execute function mzs_private.purchase_pdf_immutable();
create trigger purchase_decision_immutable before update or delete on public.mzs_purchase_pdf_decisions for each row execute function mzs_private.purchase_pdf_immutable();

create function public.mzs_confirm_purchase_pdf(p_intake uuid,p_result uuid,p_fields jsonb,p_reason text,p_accept boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.mzs_purchase_pdf_intakes;r public.mzs_purchase_pdf_results;prior public.mzs_purchase_pdf_decisions;y public.mzs_accountancy_years;d uuid;n bigint;v bigint;g bigint;dt date;prop uuid;proj uuid;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active Group Admin required' using errcode='42501';end if;
 select * into strict i from public.mzs_purchase_pdf_intakes where id=p_intake for update;
 select * into strict r from public.mzs_purchase_pdf_results where id=p_result and intake_id=i.id;
 select * into prior from public.mzs_purchase_pdf_decisions where intake_id=i.id;
 if found then
  if prior.result_id=p_result and prior.action=(case when p_accept then 'accepted' else 'rejected' end) and prior.confirmed_fields=p_fields and prior.reason=p_reason then return prior.draft_id;end if;
  raise exception 'This document was already decided';
 end if;
 if p_accept is null or p_fields is null or jsonb_typeof(p_fields)<>'object' or p_reason is null or length(btrim(p_reason)) not between 5 and 2000 then raise exception 'Review reason required';end if;
 if p_accept then
  if r.verdict<>'clean' or r.sha256<>i.sha256 then raise exception 'Clean source required';end if;
  if p_fields->'original_checked' is distinct from 'true'::jsonb or p_fields->'entity_checked' is distinct from 'true'::jsonb or p_fields->>'currency' is distinct from 'EUR' then raise exception 'Confirm original, entity and EUR';end if;
  if coalesce(p_fields->>'net','') !~ '^[0-9]{1,12}$' or coalesce(p_fields->>'vat','') !~ '^[0-9]{1,12}$' or coalesce(p_fields->>'gross','') !~ '^[0-9]{1,12}$' then raise exception 'Integer cents required';end if;
  n:=(p_fields->>'net')::bigint;v:=(p_fields->>'vat')::bigint;g:=(p_fields->>'gross')::bigint;
  if n+v<>g or g<=0 or g>100000000000 then raise exception 'Amounts do not reconcile';end if;
  if coalesce(p_fields->>'date','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid invoice date';end if;
  dt:=(p_fields->>'date')::date;select * into strict y from public.mzs_accountancy_years where id=i.year_id;
  if extract(year from dt)<>y.fiscal_year then raise exception 'Wrong financial year';end if;
  prop:=nullif(p_fields->>'property','')::uuid;proj:=nullif(p_fields->>'project','')::uuid;
  if proj is not null and not exists(select 1 from public.mzs_accountancy_projects where id=proj and year_id=y.id and property_id is not distinct from prop) then raise exception 'Project scope mismatch';end if;
  insert into public.mzs_ops_expense_drafts(legal_entity_id,property_id,cost_scope,supplier_relationship_id,supplier_invoice_number,invoice_date,category,description,net_cents,vat_cents,allocations)
  values(i.issuer_id,prop,case when prop is null then 'entity' else 'property' end,(p_fields->>'supplier')::uuid,btrim(p_fields->>'number'),dt,p_fields->>'category',p_fields->>'description',n,v,jsonb_build_array(jsonb_build_object('unit_id',null,'net_cents',n,'vat_cents',v))) returning id into d;
  insert into public.mzs_accountancy_cost_reviews(draft_id,year_id,category,project_id,review_status,evidence_reference,note)
  values(d,y.id,p_fields->>'category',proj,'pending','Purchase PDF '||i.id::text||' SHA-256 '||i.sha256,p_reason);
 end if;
 insert into public.mzs_purchase_pdf_decisions(intake_id,result_id,action,draft_id,reason,confirmed_fields,actor_id) values(i.id,r.id,case when p_accept then 'accepted' else 'rejected' end,d,p_reason,p_fields,auth.uid());return d;
end $$;
revoke all on function public.mzs_confirm_purchase_pdf(uuid,uuid,jsonb,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.mzs_confirm_purchase_pdf(uuid,uuid,jsonb,text,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mzs-purchase-pdf-quarantine','mzs-purchase-pdf-quarantine',false,4194304,array['application/pdf']);
-- No authenticated upload/overwrite/delete policies. Only the checked backend ingests bytes.
create policy purchase_pdf_clean_read on storage.objects for select to authenticated using(bucket_id='mzs-purchase-pdf-quarantine' and (select public.is_admin()) and exists(select 1 from public.mzs_purchase_pdf_intakes i join public.mzs_purchase_pdf_results r on r.intake_id=i.id where i.file_path=name and r.sha256=i.sha256 and r.verdict='clean'));
commit;
