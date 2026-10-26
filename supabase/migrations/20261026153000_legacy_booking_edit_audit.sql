
-- Keep the originally imported PDF metadata immutable; store editable business corrections separately.
CREATE TABLE IF NOT EXISTS public.mzs_booking_legacy_overrides (
  booking_id uuid PRIMARY KEY REFERENCES public.rental_bookings(id) ON DELETE RESTRICT,
  guest_name text NOT NULL CHECK(length(btrim(guest_name)) BETWEEN 2 AND 250),
  contact_name text NOT NULL CHECK(length(btrim(contact_name)) BETWEEN 2 AND 250),
  contact_email text CHECK(contact_email IS NULL OR length(contact_email) <= 254),
  invoice_recipient_kind text NOT NULL CHECK(invoice_recipient_kind IN ('person','company')),
  invoice_recipient_name text NOT NULL CHECK(length(btrim(invoice_recipient_name)) BETWEEN 2 AND 250),
  invoice_recipient_relationship_id uuid REFERENCES public.mzs_lease_relationships(id),
  version integer NOT NULL DEFAULT 1 CHECK(version>=1),
  modified_by uuid NOT NULL REFERENCES public.profiles(id),
  modified_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mzs_legacy_override_company CHECK(invoice_recipient_kind <> 'company' OR invoice_recipient_relationship_id IS NOT NULL),
  CONSTRAINT mzs_legacy_override_person CHECK(invoice_recipient_kind <> 'person' OR invoice_recipient_relationship_id IS NULL)
);
CREATE TABLE IF NOT EXISTS public.mzs_booking_legacy_change_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.rental_bookings(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  old_booking jsonb NOT NULL,
  new_booking jsonb NOT NULL,
  old_override jsonb,
  new_override jsonb NOT NULL,
  reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mzs_booking_legacy_change_audit_booking_idx
 ON public.mzs_booking_legacy_change_audit (booking_id,created_at DESC);
ALTER TABLE public.mzs_booking_legacy_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mzs_booking_legacy_change_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mzs_booking_legacy_overrides FROM anon,authenticated;
REVOKE ALL ON public.mzs_booking_legacy_change_audit FROM anon,authenticated;
GRANT SELECT ON public.mzs_booking_legacy_overrides,public.mzs_booking_legacy_change_audit TO authenticated;
DROP POLICY IF EXISTS mzs_legacy_overrides_admin ON public.mzs_booking_legacy_overrides;
CREATE POLICY mzs_legacy_overrides_admin ON public.mzs_booking_legacy_overrides
 FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
DROP POLICY IF EXISTS mzs_legacy_changes_admin ON public.mzs_booking_legacy_change_audit;
CREATE POLICY mzs_legacy_changes_admin ON public.mzs_booking_legacy_change_audit
 FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

-- Keep all existing notification behavior unless an authenticated historical correction
-- explicitly requests the one-transaction suppression flag.
CREATE OR REPLACE FUNCTION mzs_private.queue_rental_change_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_email text; v_title text;
BEGIN
 -- Covers direct admin cancellation and approval of a client's cancellation request.
 IF current_setting('mzs.internal_legacy_booking_edit', true) = 'on'
    OR OLD.status <> 'confirmed' OR OLD.is_test OR NEW.is_test
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
END $function$
;

-- Only a verified administrator can correct an imported confirmed reservation.
CREATE OR REPLACE FUNCTION public.mzs_admin_correct_legacy_booking(
 p_booking_id uuid,p_expected_booking jsonb,p_expected_override_version integer,
 p_changes jsonb,p_reason text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
 v_uid uuid := auth.uid();
 v_before public.rental_bookings%ROWTYPE;
 v_after public.rental_bookings%ROWTYPE;
 v_source public.mzs_booking_legacy_sources%ROWTYPE;
 v_override public.mzs_booking_legacy_overrides%ROWTYPE;
 v_prev_override jsonb;
 v_before_json jsonb;
 v_after_json jsonb;
 v_expected_json jsonb;
 v_new_date_in date;
 v_new_date_out date;
 v_new_in_time time;
 v_new_out_time time;
 v_new_guests integer;
 v_new_total numeric;
 v_new_notes text;
 v_new_guest text;
 v_new_contact text;
 v_new_email text;
 v_new_kind text;
 v_new_invoice text;
 v_new_company uuid;
 v_revision integer;
BEGIN
 IF v_uid IS NULL OR (SELECT public.is_admin()) IS DISTINCT FROM TRUE THEN
   RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
 END IF;
 IF p_booking_id IS NULL OR jsonb_typeof(p_expected_booking) <> 'object'
    OR jsonb_typeof(p_changes) <> 'object'
    OR p_expected_override_version IS NULL OR p_expected_override_version < 0
    OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN
   RAISE EXCEPTION 'Invalid booking correction data';
 END IF;
 SELECT * INTO v_before FROM public.rental_bookings WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND OR v_before.status <> 'confirmed' OR v_before.is_test THEN
   RAISE EXCEPTION 'Only a confirmed non-test booking can be corrected here';
 END IF;
 SELECT * INTO v_source FROM public.mzs_booking_legacy_sources WHERE booking_id=p_booking_id;
 IF NOT FOUND OR v_source.project_id IS DISTINCT FROM v_before.project_id THEN
   RAISE EXCEPTION 'This booking is not an imported historical confirmation';
 END IF;
 IF EXISTS (SELECT 1 FROM public.mzs_owner_stay_requests WHERE booking_id=p_booking_id) THEN
   RAISE EXCEPTION 'Owner stays require their own administrative workflow';
 END IF;
 IF EXISTS (SELECT 1 FROM public.mzs_booking_invoice_drafts WHERE booking_id=p_booking_id)
    OR EXISTS (SELECT 1 FROM public.mzs_booking_invoices WHERE booking_id=p_booking_id) THEN
   RAISE EXCEPTION 'An invoice draft or issued invoice exists; resolve its status before changing the booking';
 END IF;

 v_before_json := jsonb_build_object(
    'check_in',v_before.check_in,'check_out',v_before.check_out,
    'check_in_time',to_char(v_before.preferred_check_in,'HH24:MI'),
    'check_out_time',to_char(v_before.preferred_check_out,'HH24:MI'),
    'guest_count',v_before.guest_count,'total',v_before.quoted_total_eur,
    'admin_notes',coalesce(v_before.admin_notes,''));
 IF v_before_json IS DISTINCT FROM p_expected_booking THEN
    RAISE EXCEPTION 'Booking was changed; reload the dossier before saving';
 END IF;

 SELECT * INTO v_override FROM public.mzs_booking_legacy_overrides
    WHERE booking_id=p_booking_id FOR UPDATE;
 IF FOUND THEN
    v_revision:=v_override.version;
    v_prev_override:=to_jsonb(v_override);
 ELSE
    v_revision:=0;
    v_prev_override:=NULL;
 END IF;
 IF v_revision IS DISTINCT FROM p_expected_override_version THEN
    RAISE EXCEPTION 'Historical guest/billing details changed; reload first';
 END IF;

 v_new_date_in:=(p_changes->>'check_in')::date;
 v_new_date_out:=(p_changes->>'check_out')::date;
 v_new_in_time:=nullif(p_changes->>'check_in_time','')::time;
 v_new_out_time:=nullif(p_changes->>'check_out_time','')::time;
 v_new_guests:=nullif(p_changes->>'guest_count','')::integer;
 v_new_total:=(p_changes->>'total')::numeric;
 v_new_notes:=nullif(btrim(coalesce(p_changes->>'admin_notes','')),'');
 v_new_guest:=btrim(coalesce(p_changes->>'guest_name',''));
 v_new_contact:=btrim(coalesce(p_changes->>'contact_name',''));
 v_new_email:=nullif(lower(btrim(coalesce(p_changes->>'contact_email',''))),'');
 v_new_kind:=p_changes->>'invoice_recipient_kind';
 v_new_company:=nullif(p_changes->>'invoice_recipient_relationship_id','')::uuid;
 IF v_new_date_in IS NULL OR v_new_date_out IS NULL OR v_new_date_out<=v_new_date_in
   OR v_new_date_out-v_new_date_in>365 OR v_new_total IS NULL
   OR v_new_total<0 OR round(v_new_total,2)<>v_new_total
   OR (v_new_guests IS NOT NULL AND (v_new_guests<1 OR v_new_guests>50))
   OR length(coalesce(v_new_notes,''))>2000
   OR length(v_new_guest) NOT BETWEEN 2 AND 250
   OR length(v_new_contact) NOT BETWEEN 2 AND 250
   OR length(coalesce(v_new_email,''))>254
   OR (v_new_email IS NOT NULL AND v_new_email !~* '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$')
   OR v_new_kind NOT IN ('person','company')
   OR (v_new_in_time IS NULL AND nullif(p_changes->>'check_in_time','') IS NOT NULL)
   OR (v_new_out_time IS NULL AND nullif(p_changes->>'check_out_time','') IS NOT NULL)
 THEN
   RAISE EXCEPTION 'Invalid correction values';
 END IF;
 IF v_new_kind='company' THEN
   SELECT name INTO v_new_invoice FROM public.mzs_lease_relationships
     WHERE id=v_new_company AND kind='company';
   IF NOT FOUND THEN RAISE EXCEPTION 'Select an existing company billing relationship'; END IF;
 ELSE
   IF v_new_company IS NOT NULL THEN RAISE EXCEPTION 'Private invoice recipient cannot have a company relationship'; END IF;
   v_new_invoice:=btrim(coalesce(p_changes->>'invoice_recipient_name',''));
   IF length(v_new_invoice) NOT BETWEEN 2 AND 250 THEN RAISE EXCEPTION 'Enter invoice recipient name'; END IF;
 END IF;
 -- RLS-independent overlap protection also enforced by the exclusion constraint.
 IF EXISTS (
   SELECT 1 FROM public.rental_bookings b
   WHERE b.project_id=v_before.project_id AND b.id<>p_booking_id
     AND b.status IN ('confirmed','blocked')
     AND daterange(b.check_in,b.check_out,'[)') &&
         daterange(v_new_date_in,v_new_date_out,'[)')
 ) THEN
   RAISE EXCEPTION 'Dates overlap an existing confirmed reservation or blocked period';
 END IF;

 -- Suppress only the automatic change email emitted during THIS explicitly
 -- audited historical correction; unrelated reservation edits remain unaffected.
 PERFORM set_config('mzs.internal_legacy_booking_edit','on',true);
 UPDATE public.rental_bookings SET
   check_in=v_new_date_in,check_out=v_new_date_out,
   preferred_check_in=v_new_in_time,preferred_check_out=v_new_out_time,
   guest_count=v_new_guests,quoted_total_eur=v_new_total,admin_notes=v_new_notes
 WHERE id=p_booking_id RETURNING * INTO v_after;
 PERFORM set_config('mzs.internal_legacy_booking_edit','off',true);

 INSERT INTO public.mzs_booking_legacy_overrides (
   booking_id,guest_name,contact_name,contact_email,
   invoice_recipient_kind,invoice_recipient_name,invoice_recipient_relationship_id,
   version,modified_by,modified_at
 ) VALUES (
   p_booking_id,v_new_guest,v_new_contact,v_new_email,
   v_new_kind,v_new_invoice,v_new_company,v_revision+1,v_uid,now()
 ) ON CONFLICT (booking_id) DO UPDATE SET
   guest_name=EXCLUDED.guest_name,contact_name=EXCLUDED.contact_name,
   contact_email=EXCLUDED.contact_email,
   invoice_recipient_kind=EXCLUDED.invoice_recipient_kind,
   invoice_recipient_name=EXCLUDED.invoice_recipient_name,
   invoice_recipient_relationship_id=EXCLUDED.invoice_recipient_relationship_id,
   version=EXCLUDED.version,modified_by=EXCLUDED.modified_by,modified_at=EXCLUDED.modified_at;
 v_after_json:=jsonb_build_object(
    'check_in',v_after.check_in,'check_out',v_after.check_out,
    'check_in_time',to_char(v_after.preferred_check_in,'HH24:MI'),
    'check_out_time',to_char(v_after.preferred_check_out,'HH24:MI'),
    'guest_count',v_after.guest_count,'total',v_after.quoted_total_eur,
    'admin_notes',coalesce(v_after.admin_notes,''));
 INSERT INTO public.mzs_booking_legacy_change_audit(
   booking_id,actor_id,old_booking,new_booking,old_override,new_override,reason
 ) VALUES (
   p_booking_id,v_uid,v_before_json,v_after_json,v_prev_override,
   (SELECT to_jsonb(c) FROM public.mzs_booking_legacy_overrides c WHERE c.booking_id=p_booking_id),
   btrim(p_reason)
 );
 RETURN v_revision+1;
EXCEPTION WHEN exclusion_violation THEN
 RAISE EXCEPTION 'Dates overlap an existing reservation';
END;
$function$;
REVOKE ALL ON FUNCTION public.mzs_admin_correct_legacy_booking(uuid,jsonb,integer,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mzs_admin_correct_legacy_booking(uuid,jsonb,integer,jsonb,text) TO authenticated;
