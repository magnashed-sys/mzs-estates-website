-- Existing permission checks, pricing, and availability checks remain unchanged.
-- New requests become live pending requests and are confirmed only by review_rental_booking.
DO $$
DECLARE fn text; definition text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['request_rental_booking','request_configured_rental_booking'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=fn;
    IF definition IS NULL THEN RAISE EXCEPTION 'Missing function: %',fn; END IF;
    IF position('nullif(btrim(p_guest_notes),''''),true)' IN lower(definition)) = 0 THEN
      IF position('nullif(btrim(p_guest_notes),''''),false)' IN lower(definition)) = 0
      THEN RAISE EXCEPTION 'Unexpected booking function body: %',fn; END IF;
    ELSE
      definition := replace(definition,'nullif(btrim(p_guest_notes),''''),true)',
                                           'nullif(btrim(p_guest_notes),''''),false)');
      EXECUTE definition;
    END IF;
  END LOOP;
END $$;
