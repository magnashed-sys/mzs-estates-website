-- Phase 3A.5 Staging-only regression. All synthetic rows rolled back.
-- The marker MUST live in Auth app_metadata, not editable profile/user metadata.
DO $pilot_test$
DECLARE
  v_admin uuid := gen_random_uuid();
  v_trusted uuid := gen_random_uuid();
  v_spoofed uuid := gen_random_uuid();
  v_wrong_email uuid := gen_random_uuid();
  v_rejected boolean;
BEGIN
  IF to_regprocedure('public.mzs_phase3a_pilot_set_capital_scope(uuid,boolean)') IS NULL THEN
    RAISE EXCEPTION 'Phase 3A.5 Staging migration is missing';
  END IF;
  BEGIN
    INSERT INTO auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
    VALUES
      (v_admin,'authenticated','authenticated','phase3a-group-'||v_admin||'@example.invalid','{}'::jsonb,'{"full_name":"Synthetic Group"}'::jsonb),
      (v_trusted,'authenticated','authenticated','phase3a-test-'||v_trusted||'@example.invalid','{"mzs_phase3a_test":true}'::jsonb,'{"full_name":"Phase 3A Test Trusted"}'::jsonb),
      (v_spoofed,'authenticated','authenticated','phase3a-test-'||v_spoofed||'@example.invalid','{}'::jsonb,'{"full_name":"Phase 3A Test Spoofed","mzs_phase3a_test":true}'::jsonb),
      (v_wrong_email,'authenticated','authenticated','regular-client-'||v_wrong_email||'@example.invalid','{"mzs_phase3a_test":true}'::jsonb,'{"full_name":"Phase 3A Test Wrong Email"}'::jsonb);
    UPDATE public.profiles SET role='admin'::public.user_role,is_active=true WHERE id=v_admin;
    UPDATE public.profiles SET is_active=true WHERE id IN(v_trusted,v_spoofed,v_wrong_email);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);

    IF (SELECT count(*) FROM public.mzs_phase3a_pilot_list_capital_accounts()
        WHERE user_id=v_trusted) <> 1 THEN
      RAISE EXCEPTION 'Trusted test identity not listed';
    END IF;
    IF (SELECT count(*) FROM public.mzs_phase3a_pilot_list_capital_accounts()
        WHERE user_id in(v_spoofed,v_wrong_email)) <> 0 THEN
      RAISE EXCEPTION 'Spoofed or wrongly addressed client listed as synthetic';
    END IF;

    v_rejected := false;
    BEGIN
      PERFORM public.mzs_phase3a_pilot_set_capital_scope(v_spoofed,true);
    EXCEPTION WHEN insufficient_privilege THEN v_rejected := true; END;
    IF NOT v_rejected THEN
      RAISE EXCEPTION 'User-controlled name/metadata fooled the pilot grant';
    END IF;
    v_rejected := false;
    BEGIN
      PERFORM public.mzs_phase3a_pilot_set_capital_scope(v_wrong_email,true);
    EXCEPTION WHEN insufficient_privilege THEN v_rejected := true; END;
    IF NOT v_rejected THEN
      RAISE EXCEPTION 'Non-test email fooled the pilot grant';
    END IF;
    IF NOT public.mzs_phase3a_pilot_set_capital_scope(v_trusted,true) THEN
      RAISE EXCEPTION 'Trusted Staging test could not be assigned';
    END IF;
    IF (SELECT count(*) FROM public.mzs_admin_scope_audit
        WHERE target_user_id=v_trusted and new_active=true) <> 1 THEN
      RAISE EXCEPTION 'Trusted Staging grant did not create audit';
    END IF;

    PERFORM set_config('request.jwt.claim.sub',v_spoofed::text,true);
    v_rejected := false;
    BEGIN
      PERFORM public.mzs_phase3a_pilot_list_capital_accounts();
    EXCEPTION WHEN insufficient_privilege THEN v_rejected := true; END;
    IF NOT v_rejected THEN RAISE EXCEPTION 'Client accessed pilot user listing'; END IF;
    v_rejected := false;
    BEGIN
      PERFORM public.mzs_phase3a_pilot_set_capital_scope(v_trusted,false);
    EXCEPTION WHEN insufficient_privilege THEN v_rejected := true; END;
    IF NOT v_rejected THEN RAISE EXCEPTION 'Client revoked scoped admin access'; END IF;

    PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
    IF NOT public.mzs_phase3a_pilot_set_capital_scope(v_trusted,false) THEN
      RAISE EXCEPTION 'Group Admin could not revoke trusted Capital test scope';
    END IF;
    IF (SELECT count(*) FROM public.mzs_admin_scope_audit
        WHERE target_user_id=v_trusted) <> 2 THEN
      RAISE EXCEPTION 'Trusted grant/revoke audit record count incorrect';
    END IF;
    RAISE EXCEPTION USING ERRCODE='PZ999',MESSAGE='MZS_PHASE3A_TRUSTED_PILOT_ROLLBACK';
  EXCEPTION WHEN SQLSTATE 'PZ999' THEN NULL;
  END;
  RAISE NOTICE 'TRUSTED PILOT TEST PASSED; synthetic rows rolled back';
END
$pilot_test$;
