-- Execute only against isolated Staging. Synthetic fixtures are all rolled back.
DO $test$
DECLARE
 a uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); inactive uuid:=gen_random_uuid();
 p uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); b2 uuid:=gen_random_uuid();
 first_id uuid; cancellation_id uuid; n integer; start_date date:=current_date+500;
 denied boolean; claimed public.rental_change_notifications%ROWTYPE;
BEGIN
 BEGIN
  INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data) VALUES
   (a,'authenticated','authenticated','rental-admin-'||a||'@example.invalid','{"full_name":"Synthetic rental admin"}'),
   (c,'authenticated','authenticated','rental-guest-'||c||'@example.invalid','{"full_name":"Synthetic rental guest"}'),
   (inactive,'authenticated','authenticated','rental-inactive-'||inactive||'@example.invalid','{"full_name":"Synthetic inactive admin"}');
  INSERT INTO public.profiles(id,role,email,full_name,is_active) VALUES
   (a,'admin','rental-admin-'||a||'@example.invalid','Synthetic admin',true),
   (c,'client','rental-guest-'||c||'@example.invalid','Synthetic guest',true),
   (inactive,'admin','rental-inactive-'||inactive||'@example.invalid','Synthetic inactive',false)
  ON CONFLICT(id) DO UPDATE SET role=excluded.role,is_active=excluded.is_active;
  INSERT INTO public.projects(id,slug,title) VALUES(p,'staging-rental-notification-'||p,'Synthetic Rental Villa');
  INSERT INTO public.rental_settings(project_id,nightly_rate_eur,minimum_nights,maximum_guests)
   VALUES(p,300,1,12);
  INSERT INTO public.rental_bookings(id,project_id,user_id,check_in,check_out,guest_count,status,is_test,quoted_total_eur)
   VALUES(b,p,c,start_date,start_date+7,2,'requested',false,2100);
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM public.admin_modify_live_rental_booking(b,start_date,start_date+7,3,start_date,start_date+7,2,'SECRET_PENDING');
  IF EXISTS(SELECT 1 FROM public.rental_change_notifications WHERE booking_id=b) THEN RAISE EXCEPTION 'Pending booking notified'; END IF;
  UPDATE public.rental_bookings SET status='confirmed' WHERE id=b;
  IF EXISTS(SELECT 1 FROM public.rental_change_notifications WHERE booking_id=b) THEN RAISE EXCEPTION 'Initial confirmation duplicated'; END IF;
  PERFORM public.admin_modify_live_rental_booking(b,start_date,start_date+7,3,start_date,start_date+7,3,'SECRET_INTERNAL');
  IF EXISTS(SELECT 1 FROM public.rental_change_notifications WHERE booking_id=b) THEN RAISE EXCEPTION 'Internal note notified'; END IF;
  PERFORM public.admin_modify_live_rental_booking(b,start_date,start_date+8,4,start_date,start_date+7,3,'SECRET_INTERNAL');
  IF (SELECT quoted_total_eur FROM public.rental_bookings WHERE id=b)<>2400 THEN RAISE EXCEPTION 'Price changed incorrectly'; END IF;
  IF (SELECT count(*) FROM public.rental_change_notifications WHERE booking_id=b)<>1 THEN RAISE EXCEPTION 'Missing/duplicate update'; END IF;
  SELECT id INTO first_id FROM public.rental_change_notifications WHERE booking_id=b;
  IF (SELECT payload::text FROM public.rental_change_notifications WHERE id=first_id) LIKE '%SECRET%' THEN RAISE EXCEPTION 'Internal data leaked'; END IF;
  IF (SELECT recipient_user_id FROM public.rental_change_notifications WHERE id=first_id)<>c THEN RAISE EXCEPTION 'Wrong recipient'; END IF;
  IF (SELECT recipient_email FROM public.rental_change_notifications WHERE id=first_id)<>'rental-guest-'||c||'@example.invalid' THEN RAISE EXCEPTION 'Wrong address'; END IF;
  PERFORM public.admin_modify_live_rental_booking(b,start_date,start_date+8,4,start_date,start_date+8,4,'SECRET_INTERNAL');
  IF (SELECT count(*) FROM public.rental_change_notifications WHERE booking_id=b)<>1 THEN RAISE EXCEPTION 'No-op duplicated'; END IF;
  IF (SELECT count(*) FROM public.rental_booking_admin_audit WHERE booking_id=b)<>4 THEN RAISE EXCEPTION 'Existing audit changed'; END IF;
  -- Invalid and stale edits must not enqueue anything.
  denied:=false; BEGIN
   PERFORM public.admin_modify_live_rental_booking(b,start_date,start_date+8,5,start_date,start_date+7,3,NULL);
  EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Stale update allowed'; END IF;
  PERFORM set_config('request.jwt.claim.sub',c::text,true);
  EXECUTE 'set local role authenticated';
  denied:=false; BEGIN PERFORM public.admin_cancel_live_rental_booking(b,'unauthorised'); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Client cancelled booking'; END IF;
  denied:=false; BEGIN PERFORM 1 FROM public.rental_change_notifications; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Client outbox access'; END IF;
  denied:=false; BEGIN PERFORM public.claim_rental_change_notification(b); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Client claimed mail'; END IF;
  PERFORM set_config('request.jwt.claim.sub',inactive::text,true);
  denied:=false; BEGIN PERFORM public.admin_cancel_live_rental_booking(b,'inactive admin'); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Inactive administrator accepted'; END IF;
  EXECUTE 'set local role anon';
  denied:=false; BEGIN PERFORM public.claim_rental_change_notification(b); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Anonymous mail claim allowed'; END IF;
  EXECUTE 'reset role';
  EXECUTE 'set local role service_role';
  SELECT * INTO claimed FROM public.claim_rental_change_notification(b);
  IF claimed.id<>first_id OR claimed.attempts<>1 OR claimed.claim_token IS NULL THEN RAISE EXCEPTION 'Claim failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.claim_rental_change_notification(b)) THEN RAISE EXCEPTION 'Duplicate worker claim'; END IF;
  EXECUTE 'reset role';
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM public.admin_cancel_live_rental_booking(b,'SECRET_CANCELLATION_REASON');
  SELECT id INTO cancellation_id FROM public.rental_change_notifications WHERE booking_id=b AND kind='cancelled';
  IF cancellation_id IS NULL THEN RAISE EXCEPTION 'Cancellation not queued'; END IF;
  IF (SELECT payload::text FROM public.rental_change_notifications WHERE id=cancellation_id) LIKE '%SECRET%' THEN RAISE EXCEPTION 'Reason exposed'; END IF;
  IF (SELECT count(*) FROM public.rental_booking_admin_audit WHERE booking_id=b AND action='cancelled')<>1 THEN RAISE EXCEPTION 'Cancellation audit missing'; END IF;
  IF EXISTS(SELECT 1 FROM public.claim_rental_change_notification(b)) THEN RAISE EXCEPTION 'Concurrent booking email allowed'; END IF;
  UPDATE public.rental_change_notifications SET claimed_at=now()-interval '6 minutes' WHERE id=first_id;
  IF EXISTS(SELECT 1 FROM public.claim_rental_change_notification(b)) THEN RAISE EXCEPTION 'Unknown send retried'; END IF;
  IF (SELECT status FROM public.rental_change_notifications WHERE id=first_id)<>'uncertain' THEN RAISE EXCEPTION 'Expired work not surfaced'; END IF;
  PERFORM public.resolve_rental_change_notification(first_id,'accepted','Synthetic server logs confirm acceptance');
  SELECT * INTO claimed FROM public.claim_rental_change_notification(b);
  IF claimed.id<>cancellation_id THEN RAISE EXCEPTION 'Cancellation order broken'; END IF;
  UPDATE public.rental_change_notifications SET status='captured' WHERE id=cancellation_id;
  IF EXISTS(SELECT 1 FROM public.claim_rental_change_notification(b)) THEN RAISE EXCEPTION 'Completed event claimed again'; END IF;
  denied:=false; BEGIN PERFORM public.admin_cancel_live_rental_booking(b,'Repeat cancellation'); EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Repeated cancellation allowed'; END IF;
  -- Unsent edits are superseded by newer facts, including a cancellation.
  INSERT INTO public.rental_bookings(id,project_id,user_id,check_in,check_out,guest_count,status,is_test,quoted_total_eur)
   VALUES(b2,p,c,start_date+20,start_date+27,2,'confirmed',false,2100);
  PERFORM public.admin_modify_live_rental_booking(b2,start_date+20,start_date+27,3,start_date+20,start_date+27,2,'PRIVATE');
  PERFORM public.admin_cancel_live_rental_booking(b2,'Private operational reason');
  IF (SELECT count(*) FROM public.rental_change_notifications WHERE booking_id=b2 AND status='superseded')<>1 THEN RAISE EXCEPTION 'Old details not superseded'; END IF;
  SELECT * INTO claimed FROM public.claim_rental_change_notification(b2);
  IF claimed.kind<>'cancelled' THEN RAISE EXCEPTION 'Stale update sent after cancellation'; END IF;
  -- Rollback must include every booking, audit record and outbox item.
  RAISE SQLSTATE 'PZ999' USING MESSAGE='Tests passed; rollback fixtures';
 EXCEPTION WHEN SQLSTATE 'PZ999' THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM public.rental_bookings WHERE id IN(b,b2)) OR
    EXISTS(SELECT 1 FROM public.rental_change_notifications WHERE booking_id IN(b,b2)) THEN
   RAISE EXCEPTION 'Fixture rollback failed';
 END IF;
END $test$;
SELECT 'PASS: update, cancellation, notes-only/no-op suppression, recipient, price, audit, permissions, duplicate claims, uncertain outcome, ordered delivery, supersession and rollback' AS result;
