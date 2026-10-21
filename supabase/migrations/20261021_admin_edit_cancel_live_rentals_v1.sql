CREATE TABLE IF NOT EXISTS public.rental_booking_admin_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 booking_id uuid NOT NULL REFERENCES public.rental_bookings(id),
 administrator_id uuid NOT NULL REFERENCES public.profiles(id),
 action text NOT NULL CHECK (action IN ('modified','cancelled')),
 previous_values jsonb NOT NULL, resulting_values jsonb NOT NULL,
 reason text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rental_booking_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rental_booking_admin_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.rental_booking_admin_audit_id_seq FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.admin_cancel_live_rental_booking(p_booking_id uuid, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_booking public.rental_bookings%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason,''));
BEGIN
  IF v_uid IS NULL OR (SELECT public.is_admin()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
  END IF;
  IF length(v_reason)<3 OR length(v_reason)>1000 THEN
    RAISE EXCEPTION 'Cancellation reason must be 3 to 1000 characters';
  END IF;
  SELECT * INTO v_booking FROM public.rental_bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF v_booking.is_test OR v_booking.status <> 'confirmed' OR v_booking.user_id IS NULL THEN
    RAISE EXCEPTION 'Only confirmed live client bookings can be cancelled';
  END IF;
  IF v_booking.check_out <= CURRENT_DATE THEN
    RAISE EXCEPTION 'Past reservation cannot be cancelled';
  END IF;
  UPDATE public.rental_bookings
  SET status='cancelled',reviewed_at=now(),reviewed_by=v_uid,
      admin_notes=left(concat_ws(E'\n',nullif(admin_notes,''),
       'Cancelled by administrator: '||v_reason),2000)
  WHERE id=p_booking_id;
  UPDATE public.rental_cancellation_requests
  SET status='approved',reviewed_at=now(),reviewed_by=v_uid
  WHERE booking_id=p_booking_id AND status='pending';
  INSERT INTO public.rental_booking_admin_audit
    (booking_id,administrator_id,action,previous_values,resulting_values,reason)
  VALUES (p_booking_id,v_uid,'cancelled',
    jsonb_build_object('status',v_booking.status,'check_in',v_booking.check_in,'check_out',v_booking.check_out),
    jsonb_build_object('status','cancelled','check_in',v_booking.check_in,'check_out',v_booking.check_out),
    v_reason);
  RETURN 'cancelled';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_modify_live_rental_booking(p_booking_id uuid, p_check_in date, p_check_out date, p_guest_count integer, p_expected_check_in date, p_expected_check_out date, p_expected_guest_count integer, p_admin_notes text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_before public.rental_bookings%ROWTYPE;
  v_after public.rental_bookings%ROWTYPE;
  v_min integer;
  v_max integer;
  v_old_nights integer;
  v_new_nights integer;
  v_total numeric;
BEGIN
  IF v_uid IS NULL OR (SELECT public.is_admin()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_before FROM public.rental_bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF v_before.is_test OR v_before.status NOT IN ('requested','confirmed') OR v_before.user_id IS NULL THEN
    RAISE EXCEPTION 'Only live pending or confirmed client bookings can be modified';
  END IF;
  IF v_before.check_in IS DISTINCT FROM p_expected_check_in
    OR v_before.check_out IS DISTINCT FROM p_expected_check_out
    OR v_before.guest_count IS DISTINCT FROM p_expected_guest_count THEN
    RAISE EXCEPTION 'Booking changed since last refresh';
  END IF;
  IF v_before.check_in < CURRENT_DATE OR p_check_in IS NULL OR p_check_out IS NULL
    OR p_check_in < CURRENT_DATE OR p_check_out <= p_check_in THEN
    RAISE EXCEPTION 'Invalid stay dates';
  END IF;
  v_new_nights := p_check_out - p_check_in;
  v_old_nights := v_before.check_out - v_before.check_in;
  IF v_old_nights < 1 OR v_new_nights > 365 OR v_before.quoted_total_eur IS NULL THEN
    RAISE EXCEPTION 'Invalid stay or original quote';
  END IF;
  IF v_before.rental_configuration_id IS NOT NULL THEN
    SELECT c.minimum_nights,c.maximum_guests INTO v_min,v_max
    FROM public.rental_configurations c
    WHERE c.id=v_before.rental_configuration_id AND c.project_id=v_before.project_id;
  ELSE
    SELECT s.minimum_nights,s.maximum_guests INTO v_min,v_max
    FROM public.rental_settings s WHERE s.project_id=v_before.project_id;
  END IF;
  IF v_min IS NULL OR v_max IS NULL THEN RAISE EXCEPTION 'Rental settings unavailable'; END IF;
  IF v_new_nights < v_min THEN RAISE EXCEPTION 'Minimum stay requirement not met'; END IF;
  IF p_guest_count IS NULL OR p_guest_count < 1 OR p_guest_count > v_max THEN
    RAISE EXCEPTION 'Invalid guest count';
  END IF;
  IF length(coalesce(p_admin_notes,'')) > 2000 THEN RAISE EXCEPTION 'Admin notes too long'; END IF;
  IF v_before.status='confirmed' AND EXISTS (
    SELECT 1 FROM public.rental_cancellation_requests
    WHERE booking_id=p_booking_id AND status='pending'
  ) THEN RAISE EXCEPTION 'Review pending cancellation request before editing'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.rental_bookings b WHERE b.project_id=v_before.project_id
    AND b.id <> p_booking_id AND b.status IN ('confirmed','blocked')
    AND daterange(b.check_in,b.check_out,'[)') && daterange(p_check_in,p_check_out,'[)')
  ) THEN RAISE EXCEPTION 'Dates are no longer available'; END IF;
  -- Keep the originally agreed per-night quote (including selected extras), not current tariff.
  v_total := ROUND((v_before.quoted_total_eur / v_old_nights) * v_new_nights, 2);
  UPDATE public.rental_bookings
  SET check_in=p_check_in, check_out=p_check_out, guest_count=p_guest_count,
      quoted_total_eur=v_total, admin_notes=nullif(btrim(p_admin_notes),'')
  WHERE id=p_booking_id RETURNING * INTO v_after;
  INSERT INTO public.rental_booking_admin_audit
    (booking_id,administrator_id,action,previous_values,resulting_values)
  VALUES(p_booking_id,v_uid,'modified',
    jsonb_build_object('check_in',v_before.check_in,'check_out',v_before.check_out,
      'guests',v_before.guest_count,'total_eur',v_before.quoted_total_eur,'notes',v_before.admin_notes),
    jsonb_build_object('check_in',v_after.check_in,'check_out',v_after.check_out,
      'guests',v_after.guest_count,'total_eur',v_after.quoted_total_eur,'notes',v_after.admin_notes));
  RETURN 'updated';
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'Dates are no longer available';
END;
$function$
;

REVOKE ALL ON FUNCTION public.admin_modify_live_rental_booking(uuid,date,date,integer,date,date,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_modify_live_rental_booking(uuid,date,date,integer,date,date,integer,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_cancel_live_rental_booking(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_live_rental_booking(uuid,text) TO authenticated;
