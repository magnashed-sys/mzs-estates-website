-- Approved admin release: offline tenant relationships and December 2026 cutover.
-- Browser roles cannot manufacture invoice snapshots or audit records.
revoke insert on public.mzs_lease_invoice_drafts,public.mzs_lease_audit from authenticated;
revoke usage on sequence public.mzs_lease_audit_id_seq from authenticated;
drop policy lease_admin_insert on public.mzs_lease_invoice_drafts;
drop policy lease_admin_insert on public.mzs_lease_audit;
revoke execute on function mzs_private.generate_lease_drafts(date) from public,anon,authenticated,service_role;

-- Drafts may be saved before billing details are complete; activation validates them.
alter table public.mzs_lease_contracts drop constraint mzs_lease_contracts_tenant_address_check;
alter table public.mzs_lease_contracts drop constraint mzs_lease_contracts_issuer_address_check;
alter table public.mzs_lease_contracts drop constraint mzs_lease_contracts_issuer_iban_check;
alter table public.mzs_lease_contracts add constraint lease_tenant_address_length check(length(tenant_address)<=1000), add constraint lease_issuer_address_length check(length(issuer_address)<=1000), add constraint lease_issuer_iban_length check(length(issuer_iban)<=40);

create table public.mzs_lease_relationships (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 200),
 kind text not null default 'company' check(kind in ('company','person')),
 address text not null default '' check(length(address)<=1000),
 email text not null default '' check(length(email)<=254),
 phone text not null default '' check(length(phone)<=100),
 reference text not null default '' check(length(reference)<=200),
 version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.mzs_lease_relationships enable row level security;
revoke all on public.mzs_lease_relationships from public,anon,authenticated,service_role;
grant select,insert,update on public.mzs_lease_relationships to authenticated;
create policy lease_relationship_admin on public.mzs_lease_relationships for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create function mzs_private.version_lease_relationship() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.version:=case when tg_op='INSERT' then 1 else old.version+1 end; new.updated_at:=now(); return new; end $$;
revoke all on function mzs_private.version_lease_relationship() from public,anon,authenticated,service_role;
create trigger version_lease_relationship before insert or update on public.mzs_lease_relationships for each row execute function mzs_private.version_lease_relationship();
alter table public.mzs_lease_contracts add column tenant_relationship_id uuid references public.mzs_lease_relationships(id);
create index mzs_lease_contracts_relationship on public.mzs_lease_contracts(tenant_relationship_id);
create or replace function mzs_private.validate_lease() returns trigger language plpgsql security invoker set search_path='' as $$
declare line jsonb; n integer;
begin
 if new.status='draft' then new.first_generation_date:=(new.first_period-interval '1 month')::date+13; end if;
 if new.status='active' then
  if new.first_period<'2026-12-01' then raise exception 'The first MZS billing month is December 2026 or later'; end if;
  if new.first_generation_date<>(new.first_period-interval '1 month')::date+13 then raise exception 'Drafts must be prepared on the 14th of the preceding month'; end if;
  if length(trim(new.tenant_address))<2 or length(trim(new.issuer_address))<2 or length(trim(new.issuer_iban))<5 then raise exception 'Complete tenant address, issuer address and IBAN before activating billing'; end if;
 end if;
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
create or replace function mzs_private.audit_lease() returns trigger language plpgsql security definer set search_path='' as $$
declare parent_id uuid;
begin
 if tg_table_schema<>'public' or tg_table_name not in ('mzs_lease_contracts','mzs_lease_invoice_drafts') then raise exception 'Unsupported audit source'; end if;
 if tg_table_name='mzs_lease_contracts' then parent_id:=new.id; else parent_id:=new.contract_id; end if;
 insert into public.mzs_lease_audit(contract_id,actor_id,action,old_record,new_record)
 values(parent_id,auth.uid(),tg_table_name||':'||tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
create or replace function mzs_private.generate_lease_drafts(p_today date) returns integer language plpgsql security invoker set search_path='' as $$
declare c public.mzs_lease_contracts; n int; added int:=0; inserted int; ps date; pe date; scheduled date; cover_start date; cover_end date; factor numeric; l jsonb; out_lines jsonb; net numeric; vat numeric; net_total numeric; vat_total numeric; address_text text; subject_text text; months text[];
begin
 if current_user not in ('postgres','supabase_admin') and not coalesce(public.is_admin(),false) then raise exception 'Active Group administrator required' using errcode='42501'; end if;
 if p_today is null then raise exception 'Processing date required'; end if;
 -- Database uniqueness is the final duplicate guard; row locks also serialise concurrent runs.
 for c in select * from public.mzs_lease_contracts where status='active' and first_period>='2026-12-01' order by id for update loop
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
    values(c.id,ps,pe,scheduled,ps-1,subject_text,to_jsonb(c)||jsonb_build_object('unit_addresses',address_text,'covered_from',cover_start,'covered_to',cover_end,'proration_factor',factor),out_lines,net_total,vat_total,net_total+vat_total)
    on conflict(contract_id,period_start) do nothing;
   get diagnostics inserted=row_count; added:=added+inserted;
  end loop;
 end loop;
 return added;
end $$;

-- A narrow, private privileged entry point replaces direct browser INSERT grants.
-- Identity and the active full-admin role are checked before any privileged work.
create function mzs_private.prepare_lease_drafts() returns integer language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) then raise exception 'Active Group administrator required' using errcode='42501'; end if;
 return mzs_private.generate_lease_drafts((now() at time zone 'Europe/Amsterdam')::date);
end $$;
revoke all on function mzs_private.prepare_lease_drafts() from public,anon,authenticated,service_role;
grant execute on function mzs_private.prepare_lease_drafts() to authenticated;
create or replace function public.mzs_generate_lease_drafts() returns integer language sql security invoker set search_path='' as $$select mzs_private.prepare_lease_drafts();$$;
revoke all on function mzs_private.audit_lease() from public,anon,authenticated,service_role;
