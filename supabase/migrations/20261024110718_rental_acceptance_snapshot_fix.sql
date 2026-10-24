-- Preserve the registration number alongside the other approved issuer details.
-- No backfill from mutable master data: existing contracts, invoice snapshots,
-- payments and issuer sequences remain unchanged. Legacy drafts without this
-- field omit registration rather than inventing a historical value.
alter table public.mzs_lease_contracts
 add column issuer_registration text not null default '' check(length(issuer_registration)<=100);

create or replace function mzs_private.link_lease_issuer() returns trigger language plpgsql security invoker set search_path='' as $$
declare e public.mzs_lease_issuers;
begin
 if new.status='draft' and new.issuer_id is not null then
 select * into strict e from public.mzs_lease_issuers where id=new.issuer_id;
 new.issuer_name:=e.name;new.issuer_address:=e.address;new.issuer_iban:=e.iban;new.issuer_tax_id:=e.tax_id;new.issuer_registration:=e.registration_number;
 end if;return new;
end $$;

create or replace function mzs_private.issue_lease_invoice(p_draft uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.mzs_lease_invoice_drafts;e public.mzs_lease_issuers;c public.mzs_lease_contracts;existing uuid;result uuid;invoice_number text;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) then raise exception 'Active Group administrator required' using errcode='42501';end if;
 select * into strict d from public.mzs_lease_invoice_drafts where id=p_draft for update;
 select id into existing from public.mzs_lease_invoices where draft_id=p_draft;
 if existing is not null then return existing;end if;
 if d.review_status<>'checked' then raise exception 'Review and check this draft before issuing';end if;
 select * into strict c from public.mzs_lease_contracts where id=d.contract_id;
 if c.issuer_id is null then raise exception 'Select a registered issuing entity on the contract before activation';end if;
 select * into strict e from public.mzs_lease_issuers where id=c.issuer_id for update;
 if length(trim(d.snapshot->>'tenant_address'))<2 or length(trim(d.snapshot->>'issuer_address'))<2 or d.total<=0 then raise exception 'Complete billing details and a positive total are required';end if;
 invoice_number:=e.prefix||'-'||lpad(e.next_number::text,greatest(6,length(e.next_number::text)), '0');
 update public.mzs_lease_issuers set next_number=next_number+1 where id=e.id;
 insert into public.mzs_lease_invoices(draft_id,contract_id,issuer_id,number,issued_on,issued_by,due_date,total,payload)
 values(d.id,c.id,e.id,invoice_number,(now() at time zone 'Europe/Amsterdam')::date,auth.uid(),d.due_date,d.total,to_jsonb(d)||jsonb_build_object('issuer_registration',coalesce(d.snapshot->>'issuer_registration',''))) returning id into result;
 insert into public.mzs_lease_audit(contract_id,actor_id,action,new_record) values(c.id,auth.uid(),'invoice:issued',jsonb_build_object('invoice_id',result,'number',invoice_number));
 return result;
end $$;
