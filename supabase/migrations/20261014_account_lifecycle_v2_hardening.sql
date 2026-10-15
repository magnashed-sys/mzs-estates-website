-- APPLY ONLY AFTER THE NEW REGISTRATION FORM IS LIVE AND TESTED.
-- No new requests should be inserted directly by anonymous clients;
-- the signup trigger creates verified-account applications atomically.
BEGIN;
DROP POLICY IF EXISTS access_requests_public_insert ON public.access_requests;
REVOKE INSERT ON public.access_requests FROM anon, authenticated;
COMMIT;
