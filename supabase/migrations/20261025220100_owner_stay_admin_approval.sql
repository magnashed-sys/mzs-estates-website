-- All approval steps run atomically; clients can never call this function successfully.
create or replace function public.mzs_admin_decide_owner_stay(p_request_id uuid,p_approve boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.mzs_owner_stay_requests%rowtype; partner public.mzs_property_partners%rowtype; booking_uuid uuid;
begin
 if auth.uid() is null or (select public.is_admin()) is not true then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 select * into r from public.mzs_owner_stay_requests where id=p_request_id for update;
 if not found or r.status<>'requested' then raise exception 'Request unavailable or reviewed'; end if;
 select * into partner from public.mzs_property_partners where id=r.partner_id;
 if not partner.is_active or not partner.complimentary_owner_stays or not partner.requires_approval then
  raise exception 'Partner owner-stay grant inactive';
 end if;
 if p_approve then
  if r.check_in<current_date then raise exception 'Past dates unavailable'; end if;
  perform 1 from public.projects where id=partner.project_id for update;
  if exists(select 1 from public.rental_bookings b
    where b.project_id=partner.project_id and b.status in ('confirmed','blocked')
      and not b.is_test and b.check_in<r.check_out and b.check_out>r.check_in)
   then raise exception 'Dates are no longer available'; end if;
  insert into public.rental_bookings(project_id,user_id,check_in,check_out,guest_count,
    quoted_total_eur,quoted_nightly_rate_eur,status,is_test,admin_notes,reviewed_at,reviewed_by)
   values(partner.project_id,partner.profile_id,r.check_in,r.check_out,r.guest_count,
     0,0,'confirmed',false,'Complimentary owner/partner stay; no rental income.',now(),auth.uid())
   returning id into booking_uuid;
 end if;
 update public.mzs_owner_stay_requests
  set status=case when p_approve then 'confirmed' else 'declined' end,
      booking_id=booking_uuid,reviewed_by=auth.uid(),reviewed_at=now()
 where id=p_request_id;
 return booking_uuid;
end $$;
revoke all on function public.mzs_admin_decide_owner_stay(uuid,boolean) from public,anon;
grant execute on function public.mzs_admin_decide_owner_stay(uuid,boolean) to authenticated;
-- Audited admin override for guest booking prices, including deliberate zero rate.
create or replace function public.mzs_admin_set_booking_total(p_booking_id uuid,p_expected_total numeric,p_total numeric,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare b public.rental_bookings%rowtype;
begin
 if auth.uid() is null or (select public.is_admin()) is not true then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_total is null or p_total<0 or p_total>999999999 or p_total<>round(p_total,2)
 or length(btrim(coalesce(p_reason,'')))<5 or length(p_reason)>500 then raise exception 'Invalid price or reason'; end if;
 select * into b from public.rental_bookings where id=p_booking_id for update;
 if not found or b.status not in ('confirmed','requested') or b.is_test then raise exception 'Booking unavailable for repricing'; end if;
 if b.quoted_total_eur is distinct from p_expected_total then raise exception 'Booking price changed; refresh required'; end if;
 if b.quoted_total_eur is not distinct from p_total then raise exception 'Price unchanged'; end if;
 update public.rental_bookings set quoted_total_eur=p_total,
  quoted_nightly_rate_eur=round(p_total/(check_out-check_in),2)
  where id=b.id;
 insert into public.mzs_booking_price_audit(booking_id,admin_id,old_total,new_total,reason)
 values(b.id,auth.uid(),b.quoted_total_eur,p_total,p_reason);
 return true;
end $$;
revoke all on function public.mzs_admin_set_booking_total(uuid,numeric,numeric,text) from public,anon;
grant execute on function public.mzs_admin_set_booking_total(uuid,numeric,numeric,text) to authenticated;
