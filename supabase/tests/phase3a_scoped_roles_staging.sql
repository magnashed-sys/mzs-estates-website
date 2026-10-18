-- MZS Group Phase 3A.2: repeatable scoped-admin authorization regression.
-- STAGING ONLY (senonkpxdtlhyhrubicg); do not run against Production.
-- Synthetic users and grants exist only in an exception-backed subtransaction.
-- A successful run ends with zero persistent test users, grants or audit rows.
-- This verifies DATABASE behavior, not website/REST/signed-document end-to-end paths.
DO $phase3a$
DECLARE
  v_group uuid := gen_random_uuid();
  v_capital uuid := gen_random_uuid();
  v_estates uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_inactive uuid := gen_random_uuid();
  v_direct_write_denied boolean := false;
  v_unauthorised_rpc_denied boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_tables
        WHERE schemaname='public' AND tablename='mzs_admin_scope_audit') THEN
    RAISE EXCEPTION 'Phase 3A Staging schema missing';
  END IF;
  BEGIN
    INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data)
    VALUES
      (v_group,'authenticated','authenticated','phase3a-group-'||v_group::text||'@example.invalid','{"full_name":"Synthetic Group"}'::jsonb),
      (v_capital,'authenticated','authenticated','phase3a-capital-'||v_capital::text||'@example.invalid','{"full_name":"Synthetic Capital"}'::jsonb),
      (v_estates,'authenticated','authenticated','phase3a-estates-'||v_estates::text||'@example.invalid','{"full_name":"Synthetic Estates"}'::jsonb),
      (v_client,'authenticated','authenticated','phase3a-client-'||v_client::text||'@example.invalid','{"full_name":"Synthetic Client"}'::jsonb),
      (v_inactive,'authenticated','authenticated','phase3a-inactive-'||v_inactive::text||'@example.invalid','{"full_name":"Synthetic Inactive"}'::jsonb);
    -- Auth trigger creates five inactive, standard client profiles.
    UPDATE public.profiles SET role='admin'::public.user_role,is_active=true WHERE id=v_group;
    UPDATE public.profiles SET is_active=true
      WHERE id IN(v_capital,v_estates,v_client);
    IF (SELECT count(*) FROM public.profiles
        WHERE id IN(v_group,v_capital,v_estates,v_client,v_inactive))<>5 THEN
      RAISE EXCEPTION 'Synthetic profile fixture setup failed';
    END IF;
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub',v_group::text,true);
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Group administrator was not recognised';
    END IF;
    IF NOT public.mzs_set_admin_department_scope(v_capital,'capital',true) OR
       NOT public.mzs_set_admin_department_scope(v_estates,'estates',true) THEN
      RAISE EXCEPTION 'Group administrator provisioning was not applied';
    END IF;
    IF (SELECT count(*) FROM public.mzs_admin_scope_audit
        WHERE target_user_id IN(v_capital,v_estates)) <> 2 THEN
      RAISE EXCEPTION 'Scope grant audit did not record both changes';
    END IF;
    BEGIN
      PERFORM public.mzs_set_admin_department_scope(v_group,'capital',true);
      RAISE EXCEPTION 'Group administrator unexpectedly self-assigned';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'Self-assignment is not permitted' THEN RAISE; END IF;
    END;
    BEGIN
      PERFORM public.mzs_set_admin_department_scope(v_inactive,'capital',true);
      RAISE EXCEPTION 'Inactive target unexpectedly granted access';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'Target account must be active' THEN RAISE; END IF;
    END;
    PERFORM set_config('request.jwt.claim.sub',v_capital::text,true);
    IF public.is_admin() OR NOT public.mzs_has_department_scope('capital') OR
       public.mzs_has_department_scope('estates') THEN
      RAISE EXCEPTION 'Capital role leaked global/Estates scope';
    END IF;
    BEGIN
      PERFORM public.mzs_set_admin_department_scope(v_client,'capital',true);
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'Unauthorized' THEN RAISE; END IF;
      v_unauthorised_rpc_denied := true;
    END;
    IF NOT v_unauthorised_rpc_denied THEN
      RAISE EXCEPTION 'Capital operator could assign administrator scopes';
    END IF;
    BEGIN
      UPDATE public.mzs_admin_scope_assignments SET is_active=false
        WHERE user_id=v_estates;
    EXCEPTION WHEN insufficient_privilege THEN
      v_direct_write_denied := true;
    END;
    IF NOT v_direct_write_denied THEN
      RAISE EXCEPTION 'Direct assignment writes were not denied';
    END IF;
    IF (SELECT count(*) FROM public.mzs_admin_scope_audit) <> 0 THEN
      RAISE EXCEPTION 'Capital role can read Group audit events';
    END IF;
    PERFORM set_config('request.jwt.claim.sub',v_estates::text,true);
    IF public.is_admin() OR NOT public.mzs_has_department_scope('estates') OR
       public.mzs_has_department_scope('capital') THEN
      RAISE EXCEPTION 'Estates role leaked global/Capital scope';
    END IF;
    PERFORM set_config('request.jwt.claim.sub',v_client::text,true);
    IF public.is_admin() OR public.mzs_has_department_scope('capital')
       OR public.mzs_has_department_scope('estates') THEN
      RAISE EXCEPTION 'Unassigned client acquired department access';
    END IF;
    PERFORM set_config('request.jwt.claim.sub',v_inactive::text,true);
    IF public.is_admin() OR public.mzs_has_department_scope('capital')
       OR public.mzs_has_department_scope('estates') THEN
      RAISE EXCEPTION 'Inactive account acquired department access';
    END IF;
    PERFORM set_config('request.jwt.claim.sub',v_group::text,true);
    IF NOT public.mzs_set_admin_department_scope(v_capital,'capital',false) THEN
      RAISE EXCEPTION 'Capital revocation was not applied';
    END IF;
    IF (SELECT count(*) FROM public.mzs_admin_scope_audit
        WHERE target_user_id=v_capital) <> 2 THEN
      RAISE EXCEPTION 'Revocation audit not recorded';
    END IF;
    PERFORM set_config('request.jwt.claim.sub',v_capital::text,true);
    IF public.mzs_has_department_scope('capital') THEN
      RAISE EXCEPTION 'Capital permissions persisted after revocation';
    END IF;
    RAISE EXCEPTION USING
      ERRCODE='PZ999',MESSAGE='MZS_PHASE3A_EXPECTED_ROLLBACK';
  EXCEPTION WHEN SQLSTATE 'PZ999' THEN NULL;
  END;
  RAISE NOTICE 'PHASE 3A.2 CHECKS PASSED; synthetic changes rolled back';
END
$phase3a$;
