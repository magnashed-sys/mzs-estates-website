-- STAGING ONLY. Transaction rollback prevents persistent fixtures or delivery.
BEGIN;
DO $test$
DECLARE admin_id uuid; project uuid; legacy_id uuid; block_id uuid; live_id uuid; owner_id uuid; grant_id uuid; request_id uuid;
 p jsonb; result jsonb; source_before jsonb; n integer; failed boolean;
BEGIN
 SELECT id INTO admin_id FROM public.profiles WHERE role='admin' AND is_active LIMIT 1;
 IF admin_id IS NULL THEN RAISE EXCEPTION 'Staging admin fixture required'; END IF;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 SELECT b.id,b.project_id INTO legacy_id,project FROM public.rental_bookings b
 JOIN public.mzs_booking_legacy_sources s ON s.booking_id=b.id
 WHERE b.status='confirmed' AND b.check_out<current_date LIMIT 1;
 IF legacy_id IS NULL THEN RAISE EXCEPTION 'Historical staging fixture required'; END IF;
 SELECT to_jsonb(s) INTO source_before FROM public.mzs_booking_legacy_sources s WHERE booking_id=legacy_id;
 p:=public.mzs_admin_booking_cancellation_plan(legacy_id);
 IF p->>'kind'<>'historical' OR NOT (p->>'canCancel')::boolean THEN RAISE EXCEPTION 'Historical plan: %',p; END IF;
 failed:=false;
 BEGIN PERFORM public.mzs_admin_cancel_booking_dossier(legacy_id,'Regression reason','stale'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Stale snapshot accepted'; END IF;
 failed:=false;
 BEGIN PERFORM public.mzs_admin_cancel_booking_dossier(legacy_id,'x',p->>'fingerprint'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Short reason accepted'; END IF;
 SELECT count(*) INTO n FROM public.rental_change_notifications WHERE booking_id=legacy_id;
 result:=public.mzs_admin_cancel_booking_dossier(legacy_id,'Incorrectly recorded historical stay',p->>'fingerprint');
 IF result->>'status'<>'cancelled' OR (result->>'emailQueued')::boolean THEN RAISE EXCEPTION 'Historical outcome incorrect'; END IF;
 IF (SELECT count(*) FROM public.rental_change_notifications WHERE booking_id=legacy_id)<>n THEN RAISE EXCEPTION 'Historical email queued'; END IF;
 IF (SELECT to_jsonb(s) FROM public.mzs_booking_legacy_sources s WHERE booking_id=legacy_id) IS DISTINCT FROM source_before THEN RAISE EXCEPTION 'Source changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.rental_booking_admin_audit WHERE booking_id=legacy_id AND reason='Incorrectly recorded historical stay') THEN RAISE EXCEPTION 'Audit missing'; END IF;
 IF (public.mzs_admin_booking_cancellation_plan(legacy_id)->>'canCancel')::boolean THEN RAISE EXCEPTION 'Repeat cancellation allowed'; END IF;
 INSERT INTO public.rental_bookings(project_id,check_in,check_out,status,is_test) VALUES(project,'2050-01-01','2050-01-03','blocked',false) RETURNING id INTO block_id;
 p:=public.mzs_admin_booking_cancellation_plan(block_id);
 IF p->>'kind'<>'block' OR NOT (p->>'canCancel')::boolean THEN RAISE EXCEPTION 'Block plan failed'; END IF;
 result:=public.mzs_admin_cancel_booking_dossier(block_id,'Release test block',p->>'fingerprint');
 IF (SELECT status FROM public.rental_bookings WHERE id=block_id)<>'cancelled' THEN RAISE EXCEPTION 'Block not released'; END IF;
 INSERT INTO public.rental_bookings(project_id,user_id,check_in,check_out,status,is_test,quoted_total_eur) VALUES(project,admin_id,'2051-01-01','2051-01-03','confirmed',false,0) RETURNING id INTO owner_id;
 INSERT INTO public.mzs_property_partners(project_id,profile_id,complimentary_owner_stays) VALUES(project,admin_id,true)
 ON CONFLICT(project_id,profile_id) DO UPDATE SET complimentary_owner_stays=true RETURNING id INTO grant_id;
 INSERT INTO public.mzs_owner_stay_requests(partner_id,check_in,check_out,status,booking_id) VALUES(grant_id,'2051-01-01','2051-01-03','confirmed',owner_id) RETURNING id INTO request_id;
 p:=public.mzs_admin_booking_cancellation_plan(owner_id);
 IF p->>'kind'<>'owner' OR NOT (p->>'canCancel')::boolean THEN RAISE EXCEPTION 'Owner plan failed'; END IF;
 result:=public.mzs_admin_cancel_booking_dossier(owner_id,'Owner no longer visiting',p->>'fingerprint');
 IF (SELECT status FROM public.mzs_owner_stay_requests WHERE id=request_id)<>'cancelled'
 OR (SELECT status FROM public.rental_bookings WHERE id=owner_id)<>'cancelled' THEN RAISE EXCEPTION 'Owner states diverged'; END IF;
 IF EXISTS(SELECT 1 FROM public.rental_change_notifications WHERE booking_id=owner_id) THEN RAISE EXCEPTION 'Owner cancellation email queued'; END IF;
 INSERT INTO public.rental_bookings(project_id,user_id,check_in,check_out,status,is_test,quoted_total_eur) VALUES(project,admin_id,'2052-01-01','2052-01-03','confirmed',false,100) RETURNING id INTO live_id;
 p:=public.mzs_admin_booking_cancellation_plan(live_id);
 IF p->>'kind'<>'live' OR NOT (p->>'canCancel')::boolean THEN RAISE EXCEPTION 'Live plan failed'; END IF;
 INSERT INTO public.mzs_booking_receipts(booking_id,amount,received_on,reference,recorded_by)
 VALUES(live_id,10,current_date,'rollback-cancellation-regression',admin_id);
 IF (public.mzs_admin_booking_cancellation_plan(live_id)->>'canCancel')::boolean THEN RAISE EXCEPTION 'Receipt guard missing'; END IF;
 failed:=false;
 BEGIN PERFORM public.mzs_admin_cancel_booking_dossier(live_id,'Must be blocked by receipt',p->>'fingerprint'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Stale plan bypassed financial guard'; END IF;
 UPDATE public.mzs_booking_receipts SET reversed_at=now(),reversed_by=admin_id,reversal_reason='Rollback fixture only' WHERE booking_id=live_id;
 UPDATE public.profiles SET is_active=false WHERE id=admin_id;
 failed:=false;
 BEGIN PERFORM public.mzs_admin_cancel_booking_dossier(live_id,'Inactive admin test',p->>'fingerprint'); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Inactive administrator accepted'; END IF;
 UPDATE public.profiles SET is_active=true WHERE id=admin_id;
 result:=public.mzs_admin_cancel_booking_dossier(live_id,'Live cancellation regression',p->>'fingerprint');
 IF NOT (result->>'emailQueued')::boolean OR NOT EXISTS(SELECT 1 FROM public.rental_change_notifications WHERE booking_id=live_id AND kind='cancelled') THEN RAISE EXCEPTION 'Live cancellation notification missing'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 failed:=false;
 BEGIN PERFORM public.mzs_admin_booking_cancellation_plan(legacy_id); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Unauthenticated plan allowed'; END IF;
 failed:=false;
 BEGIN PERFORM public.mzs_admin_cancel_booking_dossier(legacy_id,'Unauthorized cancellation',p->>'fingerprint'); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Unauthenticated mutation allowed'; END IF;
 IF has_function_privilege('anon','public.mzs_admin_cancel_booking_dossier(uuid,text,text)','execute') THEN RAISE EXCEPTION 'Anonymous execute grant'; END IF;
END $test$;
ROLLBACK;
