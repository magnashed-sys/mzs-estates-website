-- Preserve original receipts and log reversals rather than deleting financial records.
alter table public.mzs_booking_receipts
 add column if not exists reversed_at timestamptz,
 add column if not exists reversed_by uuid references public.profiles(id),
 add column if not exists reversal_reason text check(length(btrim(reversal_reason))>=5 and length(reversal_reason)<=500);
create or replace function public.mzs_admin_reverse_booking_receipt(p_receipt_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_booking uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator required'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 500 then raise exception 'Reason required (5 to 500 characters)'; end if;
 update public.mzs_booking_receipts
 set reversed_at=now(), reversed_by=auth.uid(), reversal_reason=btrim(p_reason)
 where id=p_receipt_id and reversed_at is null
 returning booking_id into v_booking;
 if v_booking is null then raise exception 'Receipt not found or already reversed'; end if;
 return v_booking;
end $$;
revoke all on function public.mzs_admin_reverse_booking_receipt(uuid,text) from public,anon;
grant execute on function public.mzs_admin_reverse_booking_receipt(uuid,text) to authenticated;
