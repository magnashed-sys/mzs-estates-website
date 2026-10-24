-- Staging-first lease administration. No invoice issuing, emailing or account creation.
create schema if not exists mzs_private;
revoke all on schema mzs_private from public, anon;
grant usage on schema mzs_private to authenticated;

create table public.mzs_lease_contracts (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 2 and 200),
 status text not null default 'draft' check(status in ('draft','active','stopped')),
 property_id uuid not null references public.mzs_estate_properties(id),
 unit_ids uuid[] not null check(cardinality(unit_ids) between 1 and 100),
 tenant_profile_id uuid references public.profiles(id),
 tenant_name text not null check(length(trim(tenant_name)) between 2 and 200),
 tenant_address text not null check(length(trim(tenant_address)) between 2 and 1000),
 tenant_email text not null default '' check(length(tenant_email)<=254),
 issuer_name text not null check(length(trim(issuer_name)) between 2 and 200),
 issuer_address text not null check(length(trim(issuer_address)) between 2 and 1000),
 issuer_iban text not null check(length(trim(issuer_iban)) between 5 and 40),
 issuer_tax_id text not null default '' check(length(issuer_tax_id)<=60),
 contract_date date not null,
 lease_start date not null,
 lease_end date,
 first_period date not null check(extract(day from first_period)=1),
 first_generation_date date not null,
 max_terms integer check(max_terms between 1 and 600),
 payment_days integer not null default 14 check(payment_days between 0 and 120),
 payment_method text not null default 'bank_transfer' check(payment_method='bank_transfer'),
 payment_conditions text not null default '' check(length(payment_conditions)<=1000),
 customer_reference text not null default '' check(length(customer_reference)<=200),
 invoice_subject text not null default 'Huur {unitadres} — {maand} {jaar}' check(length(trim(invoice_subject)) between 2 and 500),
 invoice_language text not null default 'nl' check(invoice_language in ('nl','en','es')),
 planning_color text not null default '#c8b18a' check(planning_color ~ '^#[0-9a-fA-F]{6}$'),
 deposit numeric(14,2) not null default 0 check(deposit>=0),
 prorate boolean not null default true,
 lines jsonb not null check(jsonb_typeof(lines)='array' and jsonb_array_length(lines) between 1 and 20),
 notes text not null default '' check(length(notes)<=4000),
 version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(lease_end is null or lease_end>=lease_start),
 check(first_period>=date_trunc('month',lease_start)::date),
 check(first_period between '2000-01-01' and '2100-12-01'),
 check(first_generation_date between (first_period-interval '1 month')::date and (first_period+interval '1 month'-interval '1 day')::date)
);
create index mzs_lease_contracts_property on public.mzs_lease_contracts(property_id);
create index mzs_lease_contracts_profile on public.mzs_lease_contracts(tenant_profile_id);

create table public.mzs_lease_invoice_drafts (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.mzs_lease_contracts(id),
 period_start date not null,
 period_end date not null,
 scheduled_date date not null,
 due_date date not null,
 subject text not null,
 snapshot jsonb not null,
 lines jsonb not null,
 subtotal numeric(14,2) not null,
 tax_total numeric(14,2) not null,
 total numeric(14,2) not null,
 review_status text not null default 'pending' check(review_status in ('pending','checked')),
 review_note text not null default '' check(length(review_note)<=2000),
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(contract_id,period_start),
 check(total=subtotal+tax_total)
);
create index mzs_lease_drafts_reviewer on public.mzs_lease_invoice_drafts(reviewed_by);
create table public.mzs_lease_audit (
 id bigint generated always as identity primary key,
 contract_id uuid not null references public.mzs_lease_contracts(id),
 actor_id uuid, action text not null, old_record jsonb, new_record jsonb not null,
 created_at timestamptz not null default now()
);
create index mzs_lease_audit_contract on public.mzs_lease_audit(contract_id,created_at);

-- Authenticated access is strictly active Group administrators, including direct REST access.
do $$ declare t text; begin
 foreach t in array array['mzs_lease_contracts','mzs_lease_invoice_drafts','mzs_lease_audit'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert on public.%I to authenticated',t);
  execute format('create policy lease_admin_read on public.%I for select to authenticated using ((select public.is_admin()))',t);
  execute format('create policy lease_admin_insert on public.%I for insert to authenticated with check ((select public.is_admin()))',t);
 end loop;
end $$;
grant update on public.mzs_lease_contracts to authenticated;
create policy lease_admin_update on public.mzs_lease_contracts for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant update(review_status,review_note) on public.mzs_lease_invoice_drafts to authenticated;
create policy lease_admin_review on public.mzs_lease_invoice_drafts for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on sequence public.mzs_lease_audit_id_seq from public,anon,authenticated,service_role;
grant usage on sequence public.mzs_lease_audit_id_seq to authenticated;

create function mzs_private.validate_lease() returns trigger language plpgsql security invoker set search_path='' as $$
declare line jsonb; n integer;
begin
 -- Serialise activation for units in the same property, preventing conflicting active contracts.
 perform pg_advisory_xact_lock(hashtext(new.property_id::text));
 perform 1 from public.mzs_estate_properties where id=new.property_id;
 if not found then raise exception 'Property unavailable'; end if;
 select count(*) into n from public.mzs_estate_units where property_id=new.property_id and id=any(new.unit_ids);
 if n<>cardinality(new.unit_ids) then raise exception 'Select distinct units belonging to the selected property'; end if;
 if regexp_replace(new.invoice_subject,'\{(unitadres|maand|jaar)\}','','g') ~ '[{}]' then raise exception 'Unknown invoice subject placeholder'; end if;
 for line in select value from jsonb_array_elements(new.lines) loop
  if coalesce(length(trim(line->>'description')),0) not between 1 and 200
   or coalesce(line->>'amount','') !~ '^\d{1,10}(\.\d{1,2})?$'
   or coalesce(line->>'vat','') not in ('exempt','0','9','21') then
   raise exception 'Each line needs a description, a non-negative amount with at most two decimals and a VAT choice';
  end if;
 end loop;
 if new.lease_end is not null and new.first_period>new.lease_end then raise exception 'First invoice period is after the contract ends'; end if;
 if tg_op='UPDATE' then
  if old.status<>'draft' and (to_jsonb(new)-array['status','updated_at','version']) is distinct from (to_jsonb(old)-array['status','updated_at','version']) then
   raise exception 'Activated terms are locked. Stop the billing schedule and create a replacement contract for changed terms';
  end if;
  if old.status='active' and new.status not in ('active','stopped') or old.status='stopped' and new.status<>'stopped' then raise exception 'Invalid contract transition'; end if;
  new.version:=old.version+1;
 else
  if new.status<>'draft' then raise exception 'Create and review a draft before activation'; end if;
  new.version:=1;
 end if;
 if new.status='active' and exists(select 1 from public.mzs_lease_contracts c where c.id<>new.id and c.status='active' and c.unit_ids && new.unit_ids and daterange(c.lease_start,c.lease_end,'[]') && daterange(new.lease_start,new.lease_end,'[]')) then
  raise exception 'A selected unit already has an active contract for this period';
 end if;
 if new.status='active' and (tg_op='INSERT' or old.status='draft') and exists(select 1 from public.mzs_lease_invoice_drafts i where i.contract_id<>new.id and (i.snapshot->'unit_ids') ?| new.unit_ids::text[] and i.period_start>=new.first_period and i.period_start<=coalesce(new.lease_end,'infinity'::date)) then
  raise exception 'An invoice draft already covers these units in the proposed billing period. Choose the next uninvoiced month';
 end if;
 new.updated_at:=now(); return new;
end $$;
create trigger validate_lease before insert or update on public.mzs_lease_contracts for each row execute function mzs_private.validate_lease();

create function mzs_private.audit_lease() returns trigger language plpgsql security invoker set search_path='' as $$
declare parent_id uuid;
begin
 if tg_table_name='mzs_lease_contracts' then parent_id:=new.id; else parent_id:=new.contract_id; end if;
 insert into public.mzs_lease_audit(contract_id,actor_id,action,old_record,new_record)
 values(parent_id,auth.uid(),tg_table_name||':'||tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
create trigger lease_contract_audit after insert or update on public.mzs_lease_contracts for each row execute function mzs_private.audit_lease();
create trigger lease_invoice_audit after insert or update on public.mzs_lease_invoice_drafts for each row execute function mzs_private.audit_lease();
create function mzs_private.review_lease_invoice() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.reviewed_by:=auth.uid(); new.reviewed_at:=now(); return new;
end $$;
create trigger lease_invoice_review before update on public.mzs_lease_invoice_drafts for each row execute function mzs_private.review_lease_invoice();

-- Deterministic monthly arithmetic, always anchored to the original day (31 → Feb 28 → Mar 31).
create function mzs_private.lease_month(d date,n integer) returns date language sql immutable set search_path='' as $$
 select (date_trunc('month',d)+(n||' months')::interval)::date
   + least(extract(day from d)::int,extract(day from date_trunc('month',d)+((n+1)||' months')::interval-interval '1 day')::int)-1;
$$;

create function mzs_private.generate_lease_drafts(p_today date) returns integer language plpgsql security invoker set search_path='' as $$
declare c public.mzs_lease_contracts; n int; added int:=0; inserted int; ps date; pe date; scheduled date; cover_start date; cover_end date; factor numeric; l jsonb; out_lines jsonb; net numeric; vat numeric; net_total numeric; vat_total numeric; address_text text; subject_text text; months text[];
begin
 if current_user not in ('postgres','supabase_admin') and not coalesce(public.is_admin(),false) then raise exception 'Active Group administrator required' using errcode='42501'; end if;
 if p_today is null or p_today>(now() at time zone 'Europe/Amsterdam')::date then raise exception 'Future processing is not allowed'; end if;
 -- Database uniqueness is the final duplicate guard; row locks also serialise concurrent runs.
 for c in select * from public.mzs_lease_contracts where status='active' order by id for update loop
  select string_agg(address,', ' order by address) into address_text from public.mzs_estate_units where id=any(c.unit_ids);
  months:=case c.invoice_language when 'nl' then array['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'] when 'es' then array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'] else array['January','February','March','April','May','June','July','August','September','October','November','December'] end;
  for n in 0..least(coalesce(c.max_terms,600)-1,599) loop
   scheduled:=mzs_private.lease_month(c.first_generation_date,n);
   exit when scheduled>p_today;
   ps:=mzs_private.lease_month(c.first_period,n); pe:=(ps+interval '1 month'-interval '1 day')::date;
   exit when c.lease_end is not null and ps>c.lease_end;
   if exists(select 1 from public.mzs_lease_invoice_drafts where contract_id=c.id and period_start=ps) then continue; end if;
   cover_start:=greatest(ps,c.lease_start); cover_end:=least(pe,coalesce(c.lease_end,pe));
   factor:=case when c.prorate then (cover_end-cover_start+1)::numeric/(pe-ps+1) else 1 end;
   net_total:=0; vat_total:=0; out_lines:='[]'::jsonb;
   for l in select value from jsonb_array_elements(c.lines) loop
    net:=round((l->>'amount')::numeric*factor,2);
    vat:=case when l->>'vat'='exempt' then 0 else round(net*(l->>'vat')::numeric/100,2) end;
    net_total:=net_total+net; vat_total:=vat_total+vat;
    out_lines:=out_lines||jsonb_build_array(l||jsonb_build_object('net',net,'tax',vat,'total',net+vat));
   end loop;
   subject_text:=replace(replace(replace(c.invoice_subject,'{unitadres}',address_text),'{maand}',months[extract(month from ps)::int]),'{jaar}',extract(year from ps)::text);
   insert into public.mzs_lease_invoice_drafts(contract_id,period_start,period_end,scheduled_date,due_date,subject,snapshot,lines,subtotal,tax_total,total)
    values(c.id,ps,pe,scheduled,scheduled+c.payment_days,subject_text,to_jsonb(c)||jsonb_build_object('unit_addresses',address_text,'covered_from',cover_start,'covered_to',cover_end,'proration_factor',factor),out_lines,net_total,vat_total,net_total+vat_total)
    on conflict(contract_id,period_start) do nothing;
   get diagnostics inserted=row_count; added:=added+inserted;
  end loop;
 end loop;
 return added;
end $$;
create function public.mzs_generate_lease_drafts() returns integer language sql security invoker set search_path='' as $$
 select mzs_private.generate_lease_drafts((now() at time zone 'Europe/Amsterdam')::date);
$$;
revoke all on all functions in schema mzs_private from public,anon,authenticated,service_role;
grant execute on function mzs_private.lease_month(date,integer),mzs_private.generate_lease_drafts(date) to authenticated;
revoke all on function public.mzs_generate_lease_drafts() from public,anon,authenticated,service_role;
grant execute on function public.mzs_generate_lease_drafts() to authenticated;

-- Private PDF attachments; no client or public access.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mzs-lease-documents','mzs-lease-documents',false,10485760,array['application/pdf']);
create policy lease_documents_read on storage.objects for select to authenticated using(bucket_id='mzs-lease-documents' and (select public.is_admin()));
create policy lease_documents_upload on storage.objects for insert to authenticated with check(bucket_id='mzs-lease-documents' and (select public.is_admin()) and exists(select 1 from public.mzs_lease_contracts where id::text=(storage.foldername(name))[1]));
