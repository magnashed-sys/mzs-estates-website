-- Reservation invoice issue register shares the lease issuer number sequence.
create table if not exists public.mzs_booking_invoices(
 id uuid primary key default gen_random_uuid(),
 draft_id uuid not null unique references public.mzs_booking_invoice_drafts(id),
 booking_id uuid not null unique references public.rental_bookings(id),
 issuer_id uuid not null references public.mzs_lease_issuers(id),
 number text not null unique,
 issued_on date not null,
 issued_by uuid not null references public.profiles(id),
 total numeric(14,2) not null,
 net_total numeric(14,2) not null,
 vat_total numeric(14,2) not null,
 payload jsonb not null,
 delivery_status text not null default 'unsent' check(delivery_status='unsent'),
 created_at timestamptz not null default now()
);
alter table public.mzs_booking_invoices enable row level security;
revoke all on public.mzs_booking_invoices from anon,authenticated;
grant select on public.mzs_booking_invoices to authenticated;
create policy booking_invoices_admin_read on public.mzs_booking_invoices for select to authenticated using((select public.is_admin()));
create or replace function public.mzs_admin_issue_booking_invoice(p_draft uuid,p_revision integer)
returns uuid language plpgsql security definer set search_path=''
as $$
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
 v_number:=e.prefix||'-'||lpad(e.next_number::text,greatest(6,length(e.next_number::text)),'0');
 if exists(select 1 from public.mzs_lease_invoices where number=v_number) or
    exists(select 1 from public.mzs_booking_invoices where number=v_number) then raise exception 'Invoice number collision';end if;
 update public.mzs_lease_issuers set next_number=next_number+1 where id=e.id;
 insert into public.mzs_booking_invoices(draft_id,booking_id,issuer_id,number,issued_on,issued_by,total,net_total,vat_total,payload)
 values(d.id,d.booking_id,e.id,v_number,(now() at time zone 'Europe/Amsterdam')::date,auth.uid(),d.gross_total,d.net_total,d.vat_total,
   to_jsonb(d)||jsonb_build_object('issuer_name',e.name,'issuer_address',e.address,'issuer_tax_id',e.tax_id,
     'booking_check_in',v_booking.check_in,'booking_check_out',v_booking.check_out))
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.mzs_admin_issue_booking_invoice(uuid,integer) from public,anon;
grant execute on function public.mzs_admin_issue_booking_invoice(uuid,integer) to authenticated;
