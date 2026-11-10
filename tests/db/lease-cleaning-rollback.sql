-- Hosted staging verification only. Synthetic records and invoice numbers all roll back.
begin;
set local lock_timeout='5s';
do $test$ declare a uuid;w uuid;p uuid;u uuid;e uuid;begin
 select id into a from public.profiles where role::text='admin' and is_active order by id limit 1;
 select id into w from public.profiles where role::text in ('client','partner') and is_active order by id limit 1;
 select x.id,x.property_id into u,p from public.mzs_estate_units x where not exists(
  select 1 from public.mzs_lease_contracts c where x.id=any(c.unit_ids)) order by x.id limit 1;
 insert into public.mzs_lease_issuers(name,address,iban,tax_id,prefix,kind) values('ROLLBACK ONLY issuer','Synthetic address','SYNTHETIC-IBAN','TEST-TAX-ID','CLNTEST','person') returning id into e;
 if a is null or w is null or p is null or e is null then raise exception 'Missing isolated staging fixture prerequisites';end if;
 perform set_config('mzs.test.admin',a::text,true);perform set_config('mzs.test.worker',w::text,true);
 perform set_config('mzs.test.property',p::text,true);perform set_config('mzs.test.unit',u::text,true);perform set_config('mzs.test.issuer',e::text,true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 insert into public.mzs_ops_staff_area_scopes(profile_id,area_id,action,recorded_by,reason) values(w,'zorgbalans','grant',a,'ROLLBACK ONLY monthly cleaning verification');
end $test$;
set local role authenticated;
do $test$ declare v uuid;c uuid;begin
 perform set_config('request.jwt.claim.sub',current_setting('mzs.test.worker'),true);
 insert into public.mzs_ops_staff_visits(work_area_id,worked_on,actual_minutes,task_category,description)
 values('zorgbalans',current_date,45,'cleaning','ROLLBACK ONLY synthetic cleaning') returning id into v;
 perform set_config('mzs.test.visit',v::text,true);
 perform set_config('request.jwt.claim.sub',current_setting('mzs.test.admin'),true);
 insert into public.mzs_ops_visit_reviews(visit_id,decision,reason,recharge_class)
 values(v,'approved','ROLLBACK ONLY approved actual minutes','not_billable');
 insert into public.mzs_lease_contracts(title,property_id,unit_ids,tenant_name,tenant_address,tenant_email,issuer_id,
 contract_date,lease_start,first_period,first_generation_date,lines)
 values('ROLLBACK ONLY cleaning lease',current_setting('mzs.test.property')::uuid,array[current_setting('mzs.test.unit')::uuid],
 'Synthetic Zorgbalans tenant','Synthetic test address','synthetic@example.invalid',current_setting('mzs.test.issuer')::uuid,
 current_date,date_trunc('month',current_date)+interval '1 month',date_trunc('month',current_date)+interval '1 month',date_trunc('month',current_date)+interval '13 days',
 '[{"description":"Synthetic rent","amount":"1000","vat":"exempt"},{"description":"Synthetic advance","amount":"100","vat":"21"}]') returning id into c;
 update public.mzs_lease_contracts set status='active' where id=c;
 perform public.mzs_configure_lease_cleaning(c,current_date);
 perform set_config('mzs.test.contract',c::text,true);
end $test$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select mzs_private.generate_lease_drafts(greatest(current_date,(date_trunc('month',current_date)+interval '13 days')::date));
do $test$ declare d public.mzs_lease_invoice_drafts;begin
 select * into strict d from public.mzs_lease_invoice_drafts where contract_id=current_setting('mzs.test.contract')::uuid;
 if not exists(select 1 from public.mzs_ops_lease_cleaning_visits where visit_id=current_setting('mzs.test.visit')::uuid and draft_id=d.id)
 then raise exception 'Cron without JWT failed to include approved visit';end if;
 if (select count(*) from jsonb_array_elements(d.lines) l where l->>'source'='zorgbalans_cleaning')<>1 then raise exception 'Cleaning must be one invoice line';end if;
 if d.lines->0->>'net'<>'1000.00' and (d.lines->0->>'net')::numeric<>1000 then raise exception 'Rent changed';end if;
 perform set_config('mzs.test.draft',d.id::text,true);
 perform set_config('request.jwt.claim.sub',current_setting('mzs.test.admin'),true);
end $test$;
set local role authenticated;
do $test$ declare d uuid:=current_setting('mzs.test.draft')::uuid;i uuid;c uuid;begin
 perform public.mzs_refresh_lease_cleaning(d);
 update public.mzs_lease_invoice_drafts set review_status='checked' where id=d;
 perform set_config('request.jwt.claim.sub',current_setting('mzs.test.worker'),true);
 insert into public.mzs_ops_visit_correction_requests(visit_id,proposed_minutes,reason)
 values(current_setting('mzs.test.visit')::uuid,75,'ROLLBACK ONLY pending time correction') returning id into c;
 perform set_config('request.jwt.claim.sub',current_setting('mzs.test.admin'),true);
 begin perform public.mzs_issue_lease_invoice(d);raise exception 'Unexpected stale issue';
 exception when raise_exception then if sqlerrm not like 'Cleaning hours changed%' then raise;end if;end;
 insert into public.mzs_ops_visit_correction_decisions(correction_id,decision,reason) values(c,'rejected','ROLLBACK ONLY retained original time');
 i:=public.mzs_issue_lease_invoice(d);
 if not exists(select 1 from public.mzs_lease_invoices where id=i and payload->'snapshot'->'cleaning'->'entries' is not null and delivery_status='unsent')
 then raise exception 'Frozen attachment or no-send invariant failed';end if;
 perform set_config('request.jwt.claim.sub',current_setting('mzs.test.worker'),true);
 begin insert into public.mzs_ops_visit_correction_requests(visit_id,proposed_minutes,reason)
 values(current_setting('mzs.test.visit')::uuid,80,'ROLLBACK ONLY denied after issue');raise exception 'Unexpected issued correction';
 exception when raise_exception then if sqlerrm not like 'These hours are on an issued%' then raise;end if;end;
 if exists(select 1 from public.mzs_ops_lease_cleaning_settings) or exists(select 1 from public.mzs_ops_lease_cleaning_visits)
 then raise exception 'Worker can read customer billing data';end if;
 begin perform public.mzs_refresh_lease_cleaning(d);raise exception 'Unexpected worker refresh';exception when insufficient_privilege then null;end;
end $test$;
reset role;
rollback;
select 'PASS: real staff approval, JWT-free scheduler, one cleaning line, refreshed draft, stale-issue rejection, frozen PDF payload, no sending, worker RLS; all writes rolled back' as result;
