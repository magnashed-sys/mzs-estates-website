begin;
set local lock_timeout='5s';
-- Issuers can retain an established numeric series without a display prefix.
alter table public.mzs_lease_issuers add column if not exists number_format text not null default 'prefixed' check (number_format in ('prefixed','numeric'));

CREATE OR REPLACE FUNCTION mzs_private.issue_lease_invoice(p_draft uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 invoice_number:=case when e.number_format='numeric' then e.next_number::text else e.prefix||'-'||lpad(e.next_number::text,greatest(6,length(e.next_number::text)), '0') end;
 update public.mzs_lease_issuers set next_number=next_number+1 where id=e.id;
 insert into public.mzs_lease_invoices(draft_id,contract_id,issuer_id,number,issued_on,issued_by,due_date,total,payload)
 values(d.id,c.id,e.id,invoice_number,(now() at time zone 'Europe/Amsterdam')::date,auth.uid(),d.due_date,d.total,to_jsonb(d)||jsonb_build_object('issuer_registration',coalesce(d.snapshot->>'issuer_registration',''))) returning id into result;
 insert into public.mzs_lease_audit(contract_id,actor_id,action,new_record) values(c.id,auth.uid(),'invoice:issued',jsonb_build_object('invoice_id',result,'number',invoice_number));
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION public.mzs_admin_issue_booking_invoice(p_draft uuid, p_revision integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.mzs_booking_invoice_drafts%rowtype; e public.mzs_lease_issuers%rowtype;
 v_booking public.rental_bookings%rowtype; v_id uuid; v_number text;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator required';end if;
 select * into d from public.mzs_booking_invoice_drafts where id=p_draft for update;
 if not found then raise exception 'Draft not found';end if;
 select id into v_id from public.mzs_booking_invoices where draft_id=p_draft;
 if v_id is not null then return v_id;end if;
 if d.review_status<>'reviewed' or d.revision<>p_revision then raise exception 'Current reviewed revision required';end if;
 select * into v_booking from public.rental_bookings where id=d.booking_id for update;
 if not found or v_booking.status<>'confirmed' or coalesce(v_booking.quoted_total_eur,0)<=0 then raise exception 'Booking is not chargeable and confirmed';end if;
 if exists(select 1 from public.mzs_owner_stay_requests where booking_id=d.booking_id) then raise exception 'Owner stay cannot be invoiced';end if;
 if round(v_booking.quoted_total_eur,2)<>d.gross_total then raise exception 'Booking total changed since draft; review required';end if;
 if d.gross_total<=0 or d.net_total+d.vat_total<>d.gross_total or length(btrim(d.tax_note))<5 then raise exception 'Invalid monetary or tax assessment';end if;
 if length(btrim(d.recipient_name))<2 or coalesce(length(btrim(d.recipient_email)),0)<3 then raise exception 'Complete recipient details';end if;
 select * into e from public.mzs_lease_issuers where id=d.issuer_id for update;
 if not found or length(btrim(coalesce(e.prefix,'')))<1 or coalesce(e.next_number,0)<1
   or length(btrim(coalesce(e.name,'')))<2 or length(btrim(coalesce(e.address,'')))<5
 then raise exception 'Issuing entity incomplete';end if;
 v_number:=case when e.number_format='numeric' then e.next_number::text else e.prefix||'-'||lpad(e.next_number::text,greatest(6,length(e.next_number::text)),'0') end;
 if exists(select 1 from public.mzs_lease_invoices where number=v_number) or
    exists(select 1 from public.mzs_booking_invoices where number=v_number) then raise exception 'Invoice number collision';end if;
 update public.mzs_lease_issuers set next_number=next_number+1 where id=e.id;
 insert into public.mzs_booking_invoices(draft_id,booking_id,issuer_id,number,issued_on,issued_by,total,net_total,vat_total,payload)
 values(d.id,d.booking_id,e.id,v_number,(now() at time zone 'Europe/Amsterdam')::date,auth.uid(),d.gross_total,d.net_total,d.vat_total,
   to_jsonb(d)||jsonb_build_object('issuer_name',e.name,'issuer_address',e.address,'issuer_tax_id',e.tax_id,
     'booking_check_in',v_booking.check_in,'booking_check_out',v_booking.check_out))
 returning id into v_id;
 return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION mzs_private.issue_service_invoice(p_draft uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.mzs_service_invoice_drafts;e public.mzs_lease_issuers;existing uuid;result uuid;num text;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 select * into d from public.mzs_service_invoice_drafts where id=p_draft for update;if not found then raise exception 'Draft not found' using errcode='22023';end if;
 select id into existing from public.mzs_service_invoices where draft_id=p_draft;if found then return existing;end if;
 if exists(select 1 from public.mzs_service_draft_cancellations where draft_id=p_draft) then raise exception 'Draft cancelled' using errcode='22023';end if;
 if d.due_on<(now() at time zone 'Europe/Madrid')::date then raise exception 'Create a revised draft with a current due date' using errcode='22023';end if;
 select * into strict e from public.mzs_lease_issuers where id=d.issuer_id for update;
 num:=case when e.number_format='numeric' then e.next_number::text else e.prefix||'-'||lpad(e.next_number::text,greatest(6,length(e.next_number::text)),'0') end;
 insert into public.mzs_service_invoices(draft_id,issuer_id,customer_id,number,issued_on,due_on,net_cents,vat_cents,gross_cents,payload,issued_by) values(d.id,d.issuer_id,d.customer_id,num,(now() at time zone 'Europe/Madrid')::date,d.due_on,d.net_cents,d.vat_cents,d.gross_cents,d.payload,auth.uid()) returning id into result;
 update public.mzs_lease_issuers set next_number=next_number+1 where id=e.id;return result;
end $function$
;

CREATE OR REPLACE FUNCTION mzs_private.issue_service_credit(p_draft uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d public.mzs_service_credit_drafts;v jsonb;e public.mzs_lease_issuers;num text;
begin
 if auth.uid() is null or public.is_admin() is distinct from true then raise exception 'Active administrator required' using errcode='42501';end if;
 select * into d from public.mzs_service_credit_drafts where id=p_draft for update;if not found then raise exception 'Credit draft not found' using errcode='22023';end if;
 if exists(select 1 from public.mzs_service_credit_notes where id=p_draft) then return p_draft;end if;
 v:=mzs_private.service_credit_preview(d.invoice_id,d.spec);if v is distinct from d.preview then raise exception 'Another credit was issued. Create a fresh preview.' using errcode='22023';end if;
 select * into strict e from public.mzs_lease_issuers where id=(v->>'issuer_id')::uuid for update;
 num:=case when e.number_format='numeric' then e.next_number::text else e.prefix||'-'||lpad(e.next_number::text,greatest(6,length(e.next_number::text)),'0') end;
 insert into public.mzs_service_credit_notes(id,invoice_id,issuer_id,customer_id,number,issued_on,net_cents,vat_cents,gross_cents,lines,payload,reason,issued_by) values(p_draft,d.invoice_id,e.id,(v->>'customer_id')::uuid,num,(now() at time zone 'Europe/Madrid')::date,(v->>'net_cents')::bigint,(v->>'vat_cents')::bigint,(v->>'gross_cents')::bigint,v->'lines',v->'payload',v->>'reason',auth.uid());
 update public.mzs_lease_issuers set next_number=next_number+1 where id=e.id;return p_draft;
end $function$
;
commit;
