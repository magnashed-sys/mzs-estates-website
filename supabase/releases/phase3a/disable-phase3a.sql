-- Emergency containment; preserves all data. Requires separate execution approval.
-- Run only after independently verifying project and installed core migration.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
DO $$ BEGIN
 IF current_setting('mzs.phase3a_release_authorized',true) IS DISTINCT FROM 'ptrnjzmcehrhbsfxntgw' THEN
 RAISE EXCEPTION 'Explicit release target acknowledgement required'; END IF;
END $$;
revoke execute on function public.mzs_has_department_scope(text), public.mzs_set_admin_department_scope(uuid,text,boolean), public.mzs_capital_admin_list_requests(), public.mzs_capital_admin_update_request(uuid,text) from public,anon,authenticated,service_role;
-- Unexpected pilot functions are also contained if present.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('mzs_phase3a_pilot_list_capital_accounts','mzs_phase3a_pilot_set_capital_scope') LOOP
 EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 END LOOP;
END $$;
commit;
