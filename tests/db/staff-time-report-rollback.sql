-- Run after the report migration inside BEGIN; always ends in ROLLBACK.
-- Existing accounts are used only as transaction-local actors. All fixture writes roll back.
do $test$ declare a uuid;w uuid;p uuid;begin
 select id into a from public.profiles where role::text='admin' and is_active order by id limit 1;
 select id into w from public.profiles where role::text in ('client','partner') and is_active order by id limit 1;
 select id into p from public.mzs_estate_properties order by id limit 1;
 if a is null or w is null or p is null then raise exception 'Missing fixture actors/property';end if;
 perform set_config('mzs.test.admin',a::text,true);perform set_config('mzs.test.worker',w::text,true);perform set_config('mzs.test.property',p::text,true);
 perform set_config('request.jwt.claim.sub',a::text,true);
end $test$;
set local role authenticated;
do $test$ declare v uuid;begin
 if coalesce((select action from public.mzs_ops_staff_scope_events where profile_id=current_setting('mzs.test.worker')::uuid and property_id=current_setting('mzs.test.property')::uuid order by sequence_no desc limit 1),'revoke')<>'grant' then
 insert into public.mzs_ops_staff_scope_events(profile_id,property_id,action,reason) values(current_setting('mzs.test.worker')::uuid,current_setting('mzs.test.property')::uuid,'grant','ROLLBACK ONLY report verification');end if;
 perform set_config('request.jwt.claim.sub',current_setting('mzs.test.worker'),true);
 insert into public.mzs_ops_staff_visits(property_id,worked_on,actual_minutes,task_category,description) values(current_setting('mzs.test.property')::uuid,current_date,45,'cleaning','ROLLBACK ONLY report fixture') returning id into v;
 perform set_config('mzs.test.visit',v::text,true);
 begin perform public.mzs_ops_staff_time_report(current_date,current_date);raise exception 'Unexpected worker report access';exception when insufficient_privilege then null;end;
end $test$;
do $test$ declare c uuid;begin
 insert into public.mzs_ops_visit_correction_requests(visit_id,proposed_minutes,reason) values(current_setting('mzs.test.visit')::uuid,71,'ROLLBACK ONLY correct recorded minutes') returning id into c;
 perform set_config('mzs.test.correction',c::text,true);perform set_config('request.jwt.claim.sub',current_setting('mzs.test.admin'),true);
 insert into public.mzs_ops_visit_correction_decisions(correction_id,decision,reason) values(c,'approved','ROLLBACK ONLY accepted correction');
 insert into public.mzs_ops_visit_reviews(visit_id,correction_id,decision,reason,recharge_class,minimum_minutes,increment_minutes) values(current_setting('mzs.test.visit')::uuid,c,'approved','ROLLBACK ONLY reviewed minutes','review_candidate',60,30);
end $test$;
do $test$ declare r jsonb;v jsonb;begin
 r:=public.mzs_ops_staff_time_report(current_date,current_date,current_setting('mzs.test.property')::uuid,current_setting('mzs.test.worker')::uuid);
 select item into v from jsonb_array_elements(r->'visits') item where item->>'id'=current_setting('mzs.test.visit');
 if v is null or (v->>'actual_minutes')::int<>45 or (v->>'effective_minutes')::int<>71 or v->>'review_decision'<>'approved' or (v->>'correction_pending')::bool then raise exception 'Source minutes or review state incorrect';end if;
 if (r->>'record_count')::int<>jsonb_array_length(r->'visits') then raise exception 'Incomplete report';end if;
 if exists(select 1 from jsonb_array_elements(r->'properties') item where item - 'id' - 'name'<>'{}'::jsonb) or exists(select 1 from jsonb_array_elements(r->'people') item where item - 'id' - 'full_name'<>'{}'::jsonb) then raise exception 'Excess directory data';end if;
 begin perform public.mzs_ops_staff_time_report(current_date,current_date+366);raise exception 'Unexpected long period';exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claim.sub',current_setting('mzs.test.worker'),true);
 insert into public.mzs_ops_visit_correction_requests(visit_id,proposed_minutes,reason) values(current_setting('mzs.test.visit')::uuid,80,'ROLLBACK ONLY pending correction');
 perform set_config('request.jwt.claim.sub',current_setting('mzs.test.admin'),true);
 r:=public.mzs_ops_staff_time_report(current_date,current_date,current_setting('mzs.test.property')::uuid,current_setting('mzs.test.worker')::uuid);
 select item into v from jsonb_array_elements(r->'visits') item where item->>'id'=current_setting('mzs.test.visit');
 if (v->>'effective_minutes')::int<>71 or not (v->>'correction_pending')::bool or v->>'review_decision'<>'approved' then raise exception 'Pending correction lost current state';end if;
end $test$;
reset role;
select 'PASS: report filters, original/current minutes, review/correction state, minimal directories and worker denial; all fixture writes rolled back' as result;
rollback;
