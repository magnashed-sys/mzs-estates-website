-- Add a cancelled state without removing owner request or original booking history.
ALTER TABLE public.mzs_owner_stay_requests DROP CONSTRAINT mzs_owner_stay_requests_status_check;
ALTER TABLE public.mzs_owner_stay_requests ADD CONSTRAINT mzs_owner_stay_requests_status_check
 CHECK(status IN ('requested','confirmed','declined','cancelled'));

CREATE OR REPLACE FUNCTION public.mzs_admin_booking_cancellation_plan(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.rental_bookings%ROWTYPE; o public.mzs_owner_stay_requests%ROWTYPE;
 k text; reasons text[]:='{}'; legacy boolean; today date:=(timezone('Europe/Madrid',now()))::date;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR (SELECT public.is_admin()) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO b FROM public.rental_bookings WHERE id=p_booking_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking unavailable'; END IF;
 SELECT * INTO o FROM public.mzs_owner_stay_requests WHERE booking_id=b.id;
 SELECT EXISTS(SELECT 1 FROM public.mzs_booking_legacy_sources WHERE booking_id=b.id) INTO legacy;
 k:=CASE WHEN o.id IS NOT NULL THEN 'owner' WHEN legacy THEN 'historical' WHEN b.status='blocked' THEN 'block' ELSE 'live' END;
 IF b.is_test THEN reasons:=array_append(reasons,'Use the test booking workflow'); END IF;
 IF k='block' THEN
  IF b.user_id IS NOT NULL THEN reasons:=array_append(reasons,'This block has a linked client; review it before release'); END IF;
 ELSIF b.status<>'confirmed' THEN reasons:=array_append(reasons,'Only confirmed reservations can be cancelled');
 END IF;
 IF k='live' AND b.user_id IS NULL THEN reasons:=array_append(reasons,'No client account or historical source is linked'); END IF;
 IF k IN ('owner','live') AND b.check_out<=today THEN reasons:=array_append(reasons,'Completed stays cannot be cancelled'); END IF;
 IF k='owner' AND o.status<>'confirmed' THEN reasons:=array_append(reasons,'Owner request and booking status must both be confirmed'); END IF;
 IF EXISTS(SELECT 1 FROM public.mzs_booking_invoice_drafts WHERE booking_id=b.id)
 OR EXISTS(SELECT 1 FROM public.mzs_booking_invoices WHERE booking_id=b.id) THEN
  reasons:=array_append(reasons,'An invoice or draft exists; resolve the financial records first');
 END IF;
 IF EXISTS(SELECT 1 FROM public.mzs_booking_receipts WHERE booking_id=b.id AND reversed_at IS NULL) THEN
  reasons:=array_append(reasons,'Recorded receipts require financial review before cancellation');
 END IF;
 IF EXISTS(SELECT 1 FROM public.rental_change_notifications WHERE booking_id=b.id AND status IN ('sending','uncertain')) THEN
  reasons:=array_append(reasons,'A notification is sending or uncertain; resolve delivery first');
 END IF;
 RETURN jsonb_build_object('kind',k,'canCancel',cardinality(reasons)=0,'blockers',to_jsonb(reasons),
  'fingerprint',md5(jsonb_build_object('booking',to_jsonb(b),'owner',to_jsonb(o))::text),
  'label',CASE k WHEN 'block' THEN 'Release blocked dates' WHEN 'owner' THEN 'Cancel owner stay' WHEN 'historical' THEN 'Cancel historical booking' ELSE 'Cancel booking' END,
  'notification',CASE k WHEN 'live' THEN 'A cancellation email is queued for the linked client. Delivery is tracked separately.' ELSE 'No automatic email is sent. Notify the guest or owner separately if needed.' END);
END $$;
REVOKE ALL ON FUNCTION public.mzs_admin_booking_cancellation_plan(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mzs_admin_booking_cancellation_plan(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mzs_admin_cancel_booking_dossier(p_booking_id uuid,p_reason text,p_fingerprint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.rental_bookings%ROWTYPE; a public.rental_bookings%ROWTYPE;
 o public.mzs_owner_stay_requests%ROWTYPE; plan jsonb; old_flag text;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR (SELECT public.is_admin()) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
 END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'A reason of 5 to 500 characters is required'; END IF;
 SELECT * INTO b FROM public.rental_bookings WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking unavailable'; END IF;
 SELECT * INTO o FROM public.mzs_owner_stay_requests WHERE booking_id=b.id FOR UPDATE;
 plan:=public.mzs_admin_booking_cancellation_plan(b.id);
 IF p_fingerprint IS DISTINCT FROM plan->>'fingerprint' THEN RAISE EXCEPTION 'Booking changed; reload the dossier'; END IF;
 IF NOT (plan->>'canCancel')::boolean THEN RAISE EXCEPTION 'Cancellation unavailable: %',plan->'blockers'; END IF;
 IF plan->>'kind'='live' THEN
  PERFORM public.admin_cancel_live_rental_booking(b.id,btrim(p_reason));
 ELSE
  old_flag:=current_setting('mzs.internal_legacy_booking_edit',true);
  PERFORM set_config('mzs.internal_legacy_booking_edit','on',true);
  UPDATE public.rental_bookings SET status='cancelled',reviewed_by=auth.uid(),reviewed_at=now(),
   admin_notes=left(concat_ws(E'\n',nullif(admin_notes,''),'Administrative cancellation: '||btrim(p_reason)),2000)
   WHERE id=b.id RETURNING * INTO a;
  PERFORM set_config('mzs.internal_legacy_booking_edit',coalesce(old_flag,'off'),true);
  IF o.id IS NOT NULL THEN
   UPDATE public.mzs_owner_stay_requests SET status='cancelled',reviewed_by=auth.uid(),reviewed_at=now() WHERE id=o.id;
  END IF;
  UPDATE public.rental_cancellation_requests SET status='approved',reviewed_by=auth.uid(),reviewed_at=now()
   WHERE booking_id=b.id AND status='pending';
  UPDATE public.rental_change_notifications SET status='superseded',completed_at=now()
   WHERE booking_id=b.id AND status IN ('pending','retry','failed');
  INSERT INTO public.rental_booking_admin_audit(booking_id,administrator_id,action,previous_values,resulting_values,reason)
   VALUES(b.id,auth.uid(),'cancelled',jsonb_build_object('booking',to_jsonb(b),'owner',to_jsonb(o)),
    jsonb_build_object('booking',to_jsonb(a),'owner',(SELECT to_jsonb(r) FROM public.mzs_owner_stay_requests r WHERE id=o.id),'kind',plan->>'kind'),btrim(p_reason));
 END IF;
 RETURN jsonb_build_object('status','cancelled','kind',plan->>'kind','emailQueued',plan->>'kind'='live');
END $$;
REVOKE ALL ON FUNCTION public.mzs_admin_cancel_booking_dossier(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mzs_admin_cancel_booking_dossier(uuid,text,text) TO authenticated;
