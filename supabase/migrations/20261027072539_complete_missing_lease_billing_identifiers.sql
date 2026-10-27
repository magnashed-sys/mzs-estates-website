-- Complete missing billing identifiers before the first invoice; retain existing audit and RLS.
CREATE OR REPLACE FUNCTION mzs_private.validate_lease()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
   -- Only fill missing identifiers from linked master records before first invoicing.
   if not coalesce(
    old.status='active' and new.status='active'
    and (current_user in ('postgres','supabase_admin') or coalesce(public.is_admin(),false))
    and (to_jsonb(new)-array['updated_at','version','tenant_email','issuer_tax_id'])
      = (to_jsonb(old)-array['updated_at','version','tenant_email','issuer_tax_id'])
    and not exists(select 1 from public.mzs_lease_invoice_drafts i where i.contract_id=old.id)
    and (new.tenant_email=old.tenant_email or (
      length(trim(old.tenant_email))=0
      and new.tenant_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      and new.tenant_email=(select r.email from public.mzs_lease_relationships r where r.id=old.tenant_relationship_id)
    ))
    and (new.issuer_tax_id=old.issuer_tax_id or (
      length(trim(old.issuer_tax_id))=0 and length(trim(new.issuer_tax_id))>0
      and new.issuer_tax_id=(select e.tax_id from public.mzs_lease_issuers e where e.id=old.issuer_id)
    )),false) then
    raise exception 'Activated terms are locked. Stop the billing schedule and create a replacement contract for changed terms';
   end if;
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
end $function$
