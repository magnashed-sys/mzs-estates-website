-- Queue one admin notification per new complimentary owner-stay request.
ALTER TABLE public.mzs_mail_outbox DROP CONSTRAINT IF EXISTS mzs_mail_outbox_event_type_check;
ALTER TABLE public.mzs_mail_outbox ADD CONSTRAINT mzs_mail_outbox_event_type_check
 CHECK (event_type IN ('application_received','account_activated','new_project_access','capital_access_granted','intro_call_requested','owner_stay_requested'));
CREATE OR REPLACE FUNCTION mzs_private.queue_owner_stay_admin_mail()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status <> 'requested' THEN RETURN NEW; END IF;
 INSERT INTO public.mzs_mail_outbox(user_id,event_type,payload,idempotency_key)
 SELECT p.id,'owner_stay_requested',
   jsonb_build_object('request_id',NEW.id),
   'owner-stay-request:'||NEW.id::text||':'||p.id::text
 FROM public.profiles p WHERE p.role='admin' AND p.is_active=true
 ON CONFLICT (idempotency_key) DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS owner_stay_admin_notification ON public.mzs_owner_stay_requests;
CREATE TRIGGER owner_stay_admin_notification
 AFTER INSERT ON public.mzs_owner_stay_requests
 FOR EACH ROW EXECUTE FUNCTION mzs_private.queue_owner_stay_admin_mail();
