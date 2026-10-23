-- Additive only: existing rental RPCs, pricing, permissions and audit are unchanged.
-- No backfill: historic bookings must never generate unsolicited notifications.
CREATE SCHEMA IF NOT EXISTS mzs_private;
REVOKE ALL ON SCHEMA mzs_private FROM PUBLIC, anon, authenticated;

CREATE TABLE public.rental_change_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  booking_id uuid NOT NULL REFERENCES public.rental_bookings(id),
  recipient_user_id uuid NOT NULL REFERENCES public.profiles(id),
  recipient_email text,
  kind text NOT NULL CHECK (kind IN ('modified','cancelled')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','sending','retry','accepted','captured','failed','uncertain','superseded')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claim_token uuid,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rental_change_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rental_change_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.rental_change_notifications TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.rental_change_notifications_sequence_seq TO service_role;
CREATE INDEX rental_change_notification_due ON public.rental_change_notifications(available_at,sequence)
 WHERE status IN ('pending','retry');
CREATE INDEX rental_change_notification_booking ON public.rental_change_notifications(booking_id,sequence);
CREATE UNIQUE INDEX rental_change_notification_one_sender ON public.rental_change_notifications(booking_id)
 WHERE status='sending';

CREATE TABLE public.rental_notification_resolutions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 notification_id uuid NOT NULL REFERENCES public.rental_change_notifications(id),
 administrator_id uuid NOT NULL REFERENCES public.profiles(id),
 decision text NOT NULL CHECK (decision IN ('accepted','retry')),
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rental_notification_resolutions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rental_notification_resolutions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.rental_notification_resolutions TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.rental_notification_resolutions_id_seq TO service_role;

CREATE FUNCTION mzs_private.queue_rental_change_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text; v_title text;
BEGIN
 -- Covers direct admin cancellation and approval of a client's cancellation request.
 IF OLD.status <> 'confirmed' OR OLD.is_test OR NEW.is_test
    OR NEW.user_id IS NULL OR OLD.user_id IS DISTINCT FROM NEW.user_id
    OR (SELECT auth.uid()) IS NULL OR (SELECT public.is_admin()) IS NOT TRUE THEN
   RETURN NEW;
 END IF;
 IF NEW.status <> 'cancelled' AND NOT (NEW.status='confirmed' AND
   (ROW(OLD.check_in,OLD.check_out,OLD.guest_count,OLD.quoted_total_eur)
    IS DISTINCT FROM ROW(NEW.check_in,NEW.check_out,NEW.guest_count,NEW.quoted_total_eur))) THEN
   RETURN NEW;
 END IF;
 SELECT email INTO v_email FROM auth.users WHERE id=NEW.user_id;
 SELECT title INTO v_title FROM public.projects WHERE id=NEW.project_id;
 -- Supersede unsent older information; never resend a currently sending/uncertain event.
 UPDATE public.rental_change_notifications SET status='superseded',completed_at=now()
 WHERE booking_id=NEW.id AND status IN ('pending','retry','failed');
 INSERT INTO public.rental_change_notifications(booking_id,recipient_user_id,recipient_email,kind,payload)
 VALUES(NEW.id,NEW.user_id,lower(btrim(v_email)),
   CASE WHEN NEW.status='cancelled' THEN 'cancelled' ELSE 'modified' END,
   jsonb_build_object('property',v_title,'check_in',NEW.check_in,'check_out',NEW.check_out,
     'guests',NEW.guest_count,'total_eur',NEW.quoted_total_eur));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION mzs_private.queue_rental_change_notification() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER rental_change_notification AFTER UPDATE ON public.rental_bookings
 FOR EACH ROW EXECUTE FUNCTION mzs_private.queue_rental_change_notification();

-- Service-only atomic claim. Serializes claim selection, not SMTP network I/O.
CREATE FUNCTION public.claim_rental_change_notification(p_booking_id uuid DEFAULT NULL)
RETURNS SETOF public.rental_change_notifications LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(731021337);
 -- Expired work might already have reached SMTP. Never blindly re-queue it.
 UPDATE public.rental_change_notifications SET status='uncertain',last_error='worker_expired'
 WHERE status='sending' AND claimed_at < now()-interval '5 minutes';
 SELECT n.id INTO v_id FROM public.rental_change_notifications n
 WHERE n.status IN ('pending','retry') AND n.available_at<=now()
   AND (p_booking_id IS NULL OR n.booking_id=p_booking_id)
   AND NOT EXISTS (SELECT 1 FROM public.rental_change_notifications other
     WHERE other.booking_id=n.booking_id AND other.status IN ('sending','uncertain'))
 ORDER BY n.sequence LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF v_id IS NULL THEN RETURN; END IF;
 RETURN QUERY UPDATE public.rental_change_notifications SET status='sending',attempts=attempts+1,
   claimed_at=now(),claim_token=gen_random_uuid(),last_error=NULL
 WHERE id=v_id RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.claim_rental_change_notification(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_rental_change_notification(uuid) TO service_role;

CREATE FUNCTION public.resolve_rental_change_notification(p_id uuid,p_decision text,p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_event public.rental_change_notifications%ROWTYPE; v_status text;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR (SELECT public.is_admin()) IS NOT TRUE THEN
   RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
 END IF;
 IF p_decision NOT IN ('accepted','retry') OR p_decision IS NULL
    OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 1000 THEN
   RAISE EXCEPTION 'A delivery-log verification reason is required';
 END IF;
 SELECT * INTO v_event FROM public.rental_change_notifications WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_event.status NOT IN ('failed','uncertain') THEN
   RAISE EXCEPTION 'Only failed or uncertain notifications can be resolved';
 END IF;
 v_status:=CASE WHEN p_decision='accepted' THEN 'accepted' ELSE 'pending' END;
 IF p_decision='retry' AND EXISTS(SELECT 1 FROM public.rental_change_notifications
   WHERE booking_id=v_event.booking_id AND sequence>v_event.sequence) THEN v_status:='superseded'; END IF;
 UPDATE public.rental_change_notifications SET status=v_status,available_at=now(),claim_token=NULL,
   recipient_email=CASE WHEN p_decision='retry' THEN
     (SELECT lower(btrim(u.email)) FROM auth.users u JOIN public.rental_bookings b ON b.user_id=u.id
      WHERE b.id=v_event.booking_id AND u.id=v_event.recipient_user_id)
     ELSE recipient_email END,
   attempts=0,completed_at=CASE WHEN v_status IN ('accepted','superseded') THEN now() ELSE NULL END,
   last_error=NULL WHERE id=p_id;
 INSERT INTO public.rental_notification_resolutions(notification_id,administrator_id,decision,reason)
 VALUES(p_id,(SELECT auth.uid()),p_decision,btrim(p_reason));
 RETURN v_status;
END $$;
REVOKE ALL ON FUNCTION public.resolve_rental_change_notification(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_rental_change_notification(uuid,text,text) TO authenticated;
