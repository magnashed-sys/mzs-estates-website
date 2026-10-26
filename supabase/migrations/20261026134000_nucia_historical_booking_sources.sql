-- Historic rental confirmation provenance and billing recipient.
-- Distinct source_key is required: document 2411 prints booking number 2409 too.
CREATE TABLE IF NOT EXISTS public.mzs_booking_legacy_sources (
 booking_id uuid PRIMARY KEY REFERENCES public.rental_bookings(id) ON DELETE RESTRICT,
 project_id uuid NOT NULL REFERENCES public.projects(id),
 source_key text NOT NULL UNIQUE CHECK(length(btrim(source_key)) between 3 and 90),
 import_batch text NOT NULL CHECK(length(import_batch) between 5 and 100),
 source_filename text NOT NULL,
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
 source_page integer NOT NULL DEFAULT 1,
 original_booking_number text NOT NULL,
 confirmation_date date,
 booking_contact_name text NOT NULL,
 source_guest_name text NOT NULL,
 source_email text,
 source_phone text,
 source_address jsonb NOT NULL DEFAULT '{}'::jsonb,
 source_nights integer NOT NULL CHECK(source_nights > 0),
 source_billed_days integer CHECK(source_billed_days > 0),
 invoice_recipient_kind text NOT NULL CHECK(invoice_recipient_kind IN ('person','company')),
 invoice_recipient_name text NOT NULL,
 invoice_recipient_relationship_id uuid REFERENCES public.mzs_lease_relationships(id),
 invoice_issuer_id uuid NOT NULL REFERENCES public.mzs_lease_issuers(id),
 price_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
 source_terms jsonb NOT NULL DEFAULT '{}'::jsonb,
 original_blocked_record jsonb,
 imported_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT legacy_company_recipient_requires_relationship CHECK (
   invoice_recipient_kind <> 'company' OR invoice_recipient_relationship_id IS NOT NULL
 )
);
CREATE INDEX IF NOT EXISTS mzs_booking_legacy_project_idx ON public.mzs_booking_legacy_sources(project_id,confirmation_date);
CREATE INDEX IF NOT EXISTS mzs_booking_legacy_issuer_idx ON public.mzs_booking_legacy_sources(invoice_issuer_id);
ALTER TABLE public.mzs_booking_legacy_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mzs_booking_legacy_sources FROM anon,authenticated;
GRANT SELECT ON public.mzs_booking_legacy_sources TO authenticated;
DROP POLICY IF EXISTS mzs_booking_legacy_admin_read ON public.mzs_booking_legacy_sources;
CREATE POLICY mzs_booking_legacy_admin_read ON public.mzs_booking_legacy_sources
 FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
-- Intentionally no authenticated INSERT / UPDATE / DELETE policies.
