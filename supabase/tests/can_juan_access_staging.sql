-- Run ONLY against MZS Staging (senonkpxdtlhyhrubicg).
-- Synthetic identities and grants live inside a rolled-back subtransaction.
-- No existing account, grant, financial record, email or session is modified.
DO $audit$
#variable_conflict use_variable
DECLARE
  project_id uuid := gen_random_uuid();
  other_project_id uuid := gen_random_uuid();
  investment_id uuid := gen_random_uuid();
  sale_id uuid := gen_random_uuid();
  other_offering_id uuid := gen_random_uuid();
  member_ids uuid[] := ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  labels text[] := ARRAY['no grants','project only','investment','acquisition','both','offering without project','inactive','partner investment','other project offering'];
  expected_access boolean[] := ARRAY[false,false,true,true,true,false,false,true,false];
  expected_investment boolean[] := ARRAY[false,false,true,false,true,false,false,true,false];
  expected_sale boolean[] := ARRAY[false,false,false,true,true,false,false,false,false];
  i integer;
  has_access boolean;
  has_investment boolean;
  has_sale boolean;
  checks integer := 0;
  before_grants text;
  after_grants text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id='d14bb1c4-8fe7-46e5-b56c-bad717ff297d' AND slug='staging-test-residence')
     OR EXISTS (SELECT 1 FROM public.projects WHERE slug='villa-can-juan-ibiza') THEN
    RAISE EXCEPTION 'Expected synthetic-only MZS Staging project inventory';
  END IF;
  SELECT md5(coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.user_id,p.project_id)::text FROM public.project_access p),'[]') ||
             coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.user_id,o.offering_id)::text FROM public.offering_access o),'[]')) INTO before_grants;
  BEGIN
    FOR i IN 1..array_length(member_ids,1) LOOP
      INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data)
      VALUES(member_ids[i],'authenticated','authenticated','can-juan-audit-'||member_ids[i]||'@example.invalid','{"full_name":"Synthetic access audit"}'::jsonb);
      UPDATE public.profiles SET is_active=(i<>7),role=(CASE WHEN i=8 THEN 'partner' ELSE 'client' END)::public.user_role WHERE id=member_ids[i];
    END LOOP;
    INSERT INTO public.projects(id,slug,title,status) VALUES
      (project_id,'can-juan-audit-'||project_id,'Synthetic presentation audit','active'),
      (other_project_id,'can-juan-audit-'||other_project_id,'Synthetic unrelated project','active');
    INSERT INTO public.offerings(id,project_id,offering_type,status) VALUES
      (investment_id,project_id,'investment','active'),(sale_id,project_id,'sale','active'),(other_offering_id,other_project_id,'investment','active');
    INSERT INTO public.project_access(user_id,project_id)
      SELECT member_ids[n],project_id FROM unnest(ARRAY[2,3,4,5,7,8,9]) n;
    INSERT INTO public.offering_access(user_id,offering_id)
      SELECT member_ids[n],investment_id FROM unnest(ARRAY[3,5,6,7,8]) n;
    INSERT INTO public.offering_access(user_id,offering_id)
      SELECT member_ids[n],sale_id FROM unnest(ARRAY[4,5,7]) n;
    INSERT INTO public.offering_access(user_id,offering_id) VALUES(member_ids[9],other_offering_id);

    EXECUTE 'SET LOCAL ROLE authenticated';
    FOR i IN 1..array_length(member_ids,1) LOOP
      PERFORM set_config('request.jwt.claim.sub',member_ids[i]::text,true);
      -- Matches the page's project AND project-specific offering checks under real RLS.
      SELECT EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.project_access pa ON pa.project_id=p.id AND pa.user_id=auth.uid()
        JOIN public.offerings o ON o.project_id=p.id AND o.status='active'
        JOIN public.offering_access oa ON oa.offering_id=o.id AND oa.user_id=auth.uid()
        WHERE p.id=project_id AND p.status='active'
      ) INTO has_access;
      SELECT has_access AND EXISTS(SELECT 1 FROM public.offerings WHERE id=investment_id),
             has_access AND EXISTS(SELECT 1 FROM public.offerings WHERE id=sale_id)
        INTO has_investment,has_sale;
      IF has_access IS DISTINCT FROM expected_access[i]
         OR has_investment IS DISTINCT FROM expected_investment[i]
         OR has_sale IS DISTINCT FROM expected_sale[i] THEN
        RAISE EXCEPTION 'Failed %: page %, investment %, sale %',labels[i],has_access,has_investment,has_sale;
      END IF;
      IF EXISTS(SELECT 1 FROM public.project_access WHERE user_id=member_ids[5] AND user_id<>auth.uid())
         OR EXISTS(SELECT 1 FROM public.offering_access WHERE user_id=member_ids[5] AND user_id<>auth.uid()) THEN
        RAISE EXCEPTION 'Cross-client grant disclosure for %',labels[i];
      END IF;
      checks := checks+1;
    END LOOP;
    -- A member cannot self-grant access.
    PERFORM set_config('request.jwt.claim.sub',member_ids[1]::text,true);
    BEGIN
      INSERT INTO public.project_access(user_id,project_id) VALUES(member_ids[1],project_id);
      RAISE EXCEPTION 'Unauthorized self-grant succeeded';
    EXCEPTION WHEN insufficient_privilege THEN checks := checks+1;
    END;
    -- Revocation takes effect immediately, using only our synthetic grant.
    EXECUTE 'RESET ROLE';
    DELETE FROM public.offering_access WHERE user_id=member_ids[3] AND offering_id=investment_id;
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub',member_ids[3]::text,true);
    IF EXISTS(SELECT 1 FROM public.offerings WHERE id=investment_id) THEN RAISE EXCEPTION 'Revoked offering still visible'; END IF;
    checks := checks+1;
    -- Anonymous queries may be rejected by table privileges or return no rows.
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM set_config('request.jwt.claim.sub','',true);
    BEGIN
      IF EXISTS(SELECT 1 FROM public.projects WHERE id=project_id) THEN RAISE EXCEPTION 'Anonymous project disclosure'; END IF;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    checks := checks+1;
    RAISE EXCEPTION USING ERRCODE='PZ999',MESSAGE='CAN_JUAN_AUDIT_EXPECTED_ROLLBACK';
  EXCEPTION WHEN SQLSTATE 'PZ999' THEN NULL;
  END;
  IF checks<>12 THEN RAISE EXCEPTION 'Incomplete test matrix: %',checks; END IF;
  IF EXISTS(SELECT 1 FROM auth.users WHERE id=ANY(member_ids))
     OR EXISTS(SELECT 1 FROM public.projects WHERE id IN(project_id,other_project_id)) THEN
    RAISE EXCEPTION 'Synthetic fixture rollback failed';
  END IF;
  SELECT md5(coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.user_id,p.project_id)::text FROM public.project_access p),'[]') ||
             coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.user_id,o.offering_id)::text FROM public.offering_access o),'[]')) INTO after_grants;
  IF before_grants IS DISTINCT FROM after_grants THEN RAISE EXCEPTION 'Existing assignments changed'; END IF;
END
$audit$;
SELECT 'PASS: 12 Staging RLS cases; synthetic fixtures rolled back; existing project/offering assignments unchanged' AS result;
