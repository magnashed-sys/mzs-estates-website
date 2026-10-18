-- Isolated Phase 3A.3 SQL acceptance test: MZS Staging only.
-- No persistent accounts, requests, assignments or audit rows.
-- Explicit rollback via handled PZ999 subtransaction (failure checks rethrow).
DO $capital3a$
DECLARE
  v_group uuid := gen_random_uuid();
  v_capital uuid := gen_random_uuid();
  v_estates uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_inactive uuid := gen_random_uuid();
  v_request uuid := gen_random_uuid();
  v_old_audit_count integer;
  v_denied boolean;
BEGIN
  IF to_regprocedure('public.mzs_capital_admin_update_request(uuid,text)') IS NULL
     OR to_regprocedure('public.mzs_capital_admin_list_requests()') IS NULL THEN
    RAISE EXCEPTION 'Staging-scoped functions missing';
  END IF;
  BEGIN
    INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data)
    VALUES
      (v_group,'authenticated','authenticated','phase3a-group-'||v_group::text||'@example.invalid','{"full_name":"Synthetic Group"}'::jsonb),
      (v_capital,'authenticated','authenticated','phase3a-capital-'||v_capital::text||'@example.invalid','{"full_name":"Synthetic Capital"}'::jsonb),
      (v_estates,'authenticated','authenticated','phase3a-estates-'||v_estates::text||'@example.invalid','{"full_name":"Synthetic Estates"}'::jsonb),
      (v_client,'authenticated','authenticated','phase3a-client-'||v_client::text||'@example.invalid','{"full_name":"Synthetic Client"}'::jsonb),
      (v_inactive,'authenticated','authenticated','phase3a-inactive-'||v_inactive::text||'@example.invalid','{"full_name":"Synthetic Inactive"}'::jsonb);
    UPDATE public.profiles SET role='admin'::public.user_role,is_active=true WHERE id=v_group;
    UPDATE public.profiles SET is_active=true WHERE id IN(v_capital,v_estates,v_client);
    INSERT INTO public.mzs_capital_requests (id,user_id,request_type,amount_eur,explanation)
      VALUES (v_request,v_client,'capital',125000,'Synthetic Stage 3A Capital Request for isolated testing.');
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub',v_group::text,true);
    IF NOT public.mzs_set_admin_department_scope(v_capital,'capital',true) OR
       NOT public.mzs_set_admin_department_scope(v_estates,'estates',true) THEN
      RAISE EXCEPTION 'Group failed to provision test scopes';
    END IF;
    IF (SELECT count(*) FROM public.mzs_capital_admin_list_requests()
        WHERE id=v_request AND member_name='Synthetic Client') <> 1 THEN
      RAISE EXCEPTION 'Group cannot list request and member identity';
    END IF;
    PERFORM set_config('request.jwt.claim.sub',v_capital::text,true);
    IF (SELECT count(*) FROM public.mzs_capital_admin_list_requests()
        WHERE id=v_request AND member_name='Synthetic Client') <> 1 THEN
      RAISE EXCEPTION 'Scoped Capital Admin cannot read request';
    END IF;
    IF (SELECT count(*) FROM public.mzs_capital_requests WHERE id=v_request) <> 0 THEN
      RAISE EXCEPTION 'Scoped Capital Admin unexpectedly bypassed direct-request RLS';
    END IF;
    IF NOT public.mzs_capital_admin_update_request(v_request,'in_review') THEN
      RAISE EXCEPTION 'Scoped Capital Admin cannot update request';
    END IF;
    IF public.mzs_capital_admin_update_request(v_request,'in_review') THEN
      RAISE EXCEPTION 'No-op status change incorrectly recorded as update';
    END IF;
    PERFORM set_config('request.jwt.claim.sub',v_group::text,true);
    IF (SELECT count(*) FROM public.mzs_capital_request_admin_audit
        WHERE request_id=v_request AND actor_id=v_capital
          AND previous_status='new' AND new_status='in_review') <> 1 THEN
      RAISE EXCEPTION 'Capital status audit missing or incorrect';
    END IF;
    PERFORM set_config('request.jwt.claim.sub',v_estates::text,true);
    v_denied := false;
    BEGIN
      PERFORM 1 FROM public.mzs_capital_admin_list_requests();
    EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
    IF NOT v_denied THEN RAISE EXCEPTION 'Estates Admin gained Capital read'; END IF;
    v_denied := false;
    BEGIN
      PERFORM public.mzs_capital_admin_update_request(v_request,'contacted');
    EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
    IF NOT v_denied THEN RAISE EXCEPTION 'Estates Admin gained Capital write'; END IF;
    PERFORM set_config('request.jwt.claim.sub',v_client::text,true);
    IF (SELECT count(*) FROM public.mzs_capital_requests WHERE id=v_request) <> 1 THEN
      RAISE EXCEPTION 'Request owner cannot read own request';
    END IF;
    v_denied := false;
    BEGIN
      PERFORM 1 FROM public.mzs_capital_admin_list_requests();
    EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
    IF NOT v_denied THEN RAISE EXCEPTION 'Client gained Capital admin read'; END IF;
    v_denied := false;
    BEGIN
      PERFORM public.mzs_capital_admin_update_request(v_request,'contacted');
    EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
    IF NOT v_denied THEN RAISE EXCEPTION 'Client gained Capital admin write'; END IF;
    PERFORM set_config('request.jwt.claim.sub',v_inactive::text,true);
    v_denied := false;
    BEGIN
      PERFORM 1 FROM public.mzs_capital_admin_list_requests();
    EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
    IF NOT v_denied THEN RAISE EXCEPTION 'Inactive user gained Capital admin read'; END IF;
    PERFORM set_config('request.jwt.claim.sub',v_group::text,true);
    IF NOT public.mzs_set_admin_department_scope(v_capital,'capital',false) THEN
      RAISE EXCEPTION 'Could not revoke Capital Admin';
    END IF;
    PERFORM set_config('request.jwt.claim.sub',v_capital::text,true);
    v_denied := false;
    BEGIN
      PERFORM 1 FROM public.mzs_capital_admin_list_requests();
    EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
    IF NOT v_denied THEN RAISE EXCEPTION 'Revoked Capital Admin still has read'; END IF;
    v_denied := false;
    BEGIN
      PERFORM public.mzs_capital_admin_update_request(v_request,'contacted');
    EXCEPTION WHEN insufficient_privilege THEN v_denied := true; END;
    IF NOT v_denied THEN RAISE EXCEPTION 'Revoked Capital Admin still has write'; END IF;
    PERFORM set_config('request.jwt.claim.sub',v_group::text,true);
    IF NOT public.mzs_capital_admin_update_request(v_request,'contacted') THEN
      RAISE EXCEPTION 'Group Admin cannot update Capital Requests';
    END IF;
    IF (SELECT count(*) FROM public.mzs_capital_request_admin_audit
        WHERE request_id=v_request) <> 2 THEN
      RAISE EXCEPTION 'Expected both Capital and Group audit records';
    END IF;
    -- Roll back ALL changes made by this test, including auth.users and auditing.
    RAISE EXCEPTION USING ERRCODE='PZ999',MESSAGE='MZS_CAPITAL_EXPECTED_ROLLBACK';
  EXCEPTION WHEN SQLSTATE 'PZ999' THEN NULL;
  END;
  RAISE NOTICE 'PHASE 3A.3 SQL ACCEPTANCE PASSED; all test rows rolled back';
END
$capital3a$;
