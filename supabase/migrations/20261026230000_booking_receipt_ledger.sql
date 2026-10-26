-- Isolated booking payment ledger: booking receipts are not lease-contract payments.
create table if not exists public.mzs_booking_receipts (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.rental_bookings(id) on delete restrict,
 amount numeric(14,2) not null check(amount > 0),
 received_on date not null,
 reference text not null check (length(btrim(reference)) between 1 and 200),
 notes text,
 recorded_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create unique index if not exists mzs_booking_receipts_reference_unique
 on public.mzs_booking_receipts(booking_id, lower(btrim(reference)));
create index if not exists mzs_booking_receipts_booking_idx
 on public.mzs_booking_receipts(booking_id,received_on desc);
alter table public.mzs_booking_receipts enable row level security;
revoke all on public.mzs_booking_receipts from anon,authenticated;
grant select on public.mzs_booking_receipts to authenticated;
drop policy if exists mzs_booking_receipts_admin_select on public.mzs_booking_receipts;
create policy mzs_booking_receipts_admin_select on public.mzs_booking_receipts
 for select to authenticated using ((select public.is_admin()));
create or replace function public.mzs_admin_record_booking_receipt(
 p_booking_id uuid,p_amount numeric,p_received_on date,p_reference text,p_notes text default null
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator required'; end if;
 if p_amount is null or p_amount <= 0 or round(p_amount,2) <> p_amount or p_received_on is null
   or length(btrim(coalesce(p_reference,''))) not between 1 and 200
   or length(coalesce(p_notes,'')) > 2000 then raise exception 'Invalid receipt data'; end if;
 if not exists (select 1 from public.rental_bookings b
   where b.id=p_booking_id and b.status='confirmed'
     and coalesce(b.quoted_total_eur,0)>0
     and not exists(select 1 from public.mzs_owner_stay_requests os where os.booking_id=b.id))
 then raise exception 'Only confirmed, chargeable guest bookings accept receipts'; end if;
 insert into public.mzs_booking_receipts(booking_id,amount,received_on,reference,notes,recorded_by)
 values(p_booking_id,p_amount,p_received_on,btrim(p_reference),nullif(btrim(p_notes),''),auth.uid())
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.mzs_admin_record_booking_receipt(uuid,numeric,date,text,text) from public,anon;
grant execute on function public.mzs_admin_record_booking_receipt(uuid,numeric,date,text,text) to authenticated;
