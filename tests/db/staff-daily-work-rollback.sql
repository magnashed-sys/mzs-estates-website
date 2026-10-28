-- Run inside a transaction AFTER migrations; always end with ROLLBACK.
-- Uses existing profiles as actors and creates temporary operational records only.
do $test$ declare a uuid;w uuid;p uuid;begin
 select id into a from public.profiles where role::text='admin' and is_active order by id limit 1;
 select id into w from public.profiles where role::text in ('client','partner') and is_active order by id limit 1;
 select id into p from public.mzs_estate_properties order by id limit 1;
 if a is null or w is null or p is null then raise exception 'Missing fixture actors/property';end if;
 perform set_config('mzs.test.admin',a::text,true);perform set_config('mzs.test.worker',w::text,true);perform set_config('mzs.test.property',p::text,true);
 perform set_config('request.jwt.claim.sub',a::text,true);
end $test$;
set local role authenticated;
do $test$ begin
 if public.is_admin() is distinct from true then raise exception 'Admin authentication failed';end if;
 if coalesce((select action from public.mzs_ops_staff_scope_events where profile_id=current_setting('mzs.test.worker')::uuid and property_id=current_setting('mzs.test.property')::uuid order by sequence_no desc limit 1),'revoke')<>'grant' then
 insert into public.mzs_ops_staff_scope_events(profile_id,property_id,action,reason) values(current_setting('mzs.test.worker')::uuid,current_setting('mzs.test.property')::uuid,'grant','ROLLBACK ONLY integration verification');end if;
 perform set_config('request.jwt.claim.sub',current_setting('mzs.test.worker'),true);
end $test$;
do $test$ declare v uuid;t uuid;begin
 if (select count(*) from public.mzs_ops_staff_property_directory where id=current_setting('mzs.test.property')::uuid)<>1 then raise exception 'Staff directory scope failed';end if;
 insert into public.mzs_ops_staff_visits(property_id,worked_on,actual_minutes,task_category,description) values(current_setting('mzs.test.property')::uuid,current_date,45,'cleaning','ROLLBACK ONLY synthetic integration visit') returning id into v;
 insert into public.mzs_ops_maintenance_tickets(property_id,priority,title,description) values(current_setting('mzs.test.property')::uuid,'routine','ROLLBACK ONLY test','Synthetic issue; all records are rolled back') returning id into t;
 perform set_config('mzs.test.visit',v::text,true);perform set_config('mzs.test.ticket',t::text,true);
 begin update public.mzs_ops_staff_visits set actual_minutes=80 where id=v;raise exception 'Unexpected UPDATE permitted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',current_setting('mzs.test.admin'),true);
end $test$;
do $test$ begin
 insert into public.mzs_ops_visit_reviews(visit_id,decision,reason,recharge_class,minimum_minutes,increment_minutes) values(current_setting('mzs.test.visit')::uuid,'approved','ROLLBACK ONLY time review','review_candidate',60,30);
 perform set_config('request.jwt.claim.sub',current_setting('mzs.test.worker'),true);
end $test$;
do $test$ declare c uuid;begin
 if (select review_decision from public.mzs_ops_current_visits where id=current_setting('mzs.test.visit')::uuid)<>'approved' then raise exception 'Staff review status failed';end if;
 if exists(select 1 from public.mzs_ops_visit_reviews where visit_id=current_setting('mzs.test.visit')::uuid) then raise exception 'Commercial review data exposed';end if;
 insert into public.mzs_ops_visit_correction_requests(visit_id,proposed_minutes,reason) values(current_setting('mzs.test.visit')::uuid,71,'ROLLBACK ONLY post-review correction') returning id into c;
 perform set_config('mzs.test.correction',c::text,true);perform set_config('request.jwt.claim.sub',current_setting('mzs.test.admin'),true);
end $test$;
do $test$ declare v public.mzs_ops_current_visits; t uuid:=current_setting('mzs.test.ticket')::uuid;w uuid:=current_setting('mzs.test.worker')::uuid;begin
 insert into public.mzs_ops_visit_correction_decisions(correction_id,decision,reason) values(current_setting('mzs.test.correction')::uuid,'approved','ROLLBACK ONLY accepted correction');
 insert into public.mzs_ops_visit_reviews(visit_id,correction_id,decision,reason,recharge_class,minimum_minutes,increment_minutes) values(current_setting('mzs.test.visit')::uuid,current_setting('mzs.test.correction')::uuid,'approved','ROLLBACK ONLY revision review','review_candidate',60,30);
 select * into v from public.mzs_ops_current_visits where id=current_setting('mzs.test.visit')::uuid;
 if v.actual_minutes<>45 or v.effective_minutes<>71 or v.review_decision<>'approved' then raise exception 'Revision or original invariant failed';end if;
 if (select billable_minutes from public.mzs_ops_visit_reviews where correction_id=current_setting('mzs.test.correction')::uuid)<>90 then raise exception 'Separate rounding failed';end if;
 insert into public.mzs_ops_maintenance_events(ticket_id,action,note) values(t,'triaged','ROLLBACK ONLY triage');
 insert into public.mzs_ops_maintenance_events(ticket_id,action,note,responsible_profile_id,scheduled_for,expected_event_id) values(t,'scheduled','ROLLBACK ONLY planned work',w,current_date,(select latest_event_id from public.mzs_ops_current_tickets where id=t));
 insert into public.mzs_ops_maintenance_events(ticket_id,action,note,responsible_profile_id,scheduled_for,expected_event_id) values(t,'in_progress','ROLLBACK ONLY work started',w,current_date,(select latest_event_id from public.mzs_ops_current_tickets where id=t));
 insert into public.mzs_ops_maintenance_events(ticket_id,action,note,responsible_profile_id,scheduled_for,expected_event_id) values(t,'resolved','ROLLBACK ONLY issue resolved',w,current_date,(select latest_event_id from public.mzs_ops_current_tickets where id=t));
 if (select status from public.mzs_ops_current_tickets where id=t)<>'resolved' then raise exception 'Status projection failed';end if;
 if not exists(select 1 from public.mzs_ops_property_work_summary where property_id=current_setting('mzs.test.property')::uuid and approved_minutes>=71) then raise exception 'Summary failed';end if;
 insert into public.mzs_ops_staff_scope_events(profile_id,property_id,action,reason) values(w,current_setting('mzs.test.property')::uuid,'revoke','ROLLBACK ONLY revoke verification');
 perform set_config('request.jwt.claim.sub',w::text,true);
end $test$;
do $test$ begin
 if exists(select 1 from public.mzs_ops_current_visits where id=current_setting('mzs.test.visit')::uuid) then raise exception 'Revoked visit still visible';end if;
 if exists(select 1 from public.mzs_ops_current_tickets where id=current_setting('mzs.test.ticket')::uuid) then raise exception 'Revoked ticket still visible';end if;
end $test$;
reset role;
select 'PASS: authenticated workflow, RLS, correction, rounding, planning, summary, revocation; all writes rolled back' as result;
rollback;
