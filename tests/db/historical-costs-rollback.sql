-- Run after the migration inside BEGIN. No real historical source data is used.
-- Every fixture and any schema changes in the caller transaction are rolled back.
do $test$ declare b uuid:=gen_random_uuid();i uuid:=gen_random_uuid();w uuid;e uuid;c uuid;p uuid;n text;begin
 select id into w from public.profiles where role::text in ('client','partner') and is_active order by id limit 1;
 select id into e from public.mzs_lease_issuers order by id limit 1;
 select id into c from public.mzs_lease_relationships order by id limit 1;
 select id into p from public.mzs_estate_properties order by id limit 1;
 if w is null or e is null or c is null or p is null then raise exception 'Missing fixture targets';end if;
 n:='ROLLBACK-'||left(i::text,8);
 insert into public.mzs_ops_historical_batches(id,profile_id,reporting_year,source_key,source_name,source_file_id,source_sha256,hash_basis,expected_rows,expected_cost_cents,authorization_reference)
 values(b,w,2026,'rollback-'||b::text,'Synthetic historical source.csv','libfile_rollback',md5(b::text)||md5(b::text),'extracted_csv_utf8_lf',2,6250,'ROLLBACK ONLY integration test');
 insert into public.mzs_ops_external_sales_invoices(id,batch_id,issuer_id,customer_id,property_id,number,issued_on,due_on,period_from,period_until,customer_reference,net_cents,vat_cents,gross_cents,vat_basis_points,billed_hours,hourly_rate_cents,source_file_id,source_name,source_snapshot)
 values(i,b,e,c,p,n,'2026-10-28','2026-11-11','2026-02-09','2026-02-15','ROLLBACK ONLY',7500,1575,9075,2100,3,2500,'libfile_rollback_invoice','Synthetic invoice.pdf','{}');
 insert into public.mzs_ops_historical_cost_rows(batch_id,profile_id,reporting_year,reference,iso_week,period_from,period_until,original_location,category,description,cost_cents,recharge,source_reference,source_check,source_billing_reference,invoice_id,billed_hours,recharge_cents)
 values(b,w,2026,'T1-'||b::text,7,'2026-02-09','2026-02-15','Synthetic location','Cleaning','ROLLBACK ONLY source row',5000,'Ja','#fixture','Synthetic','Synthetic external invoice',i,2,5000),
 (b,w,2026,'T2-'||b::text,7,'2026-02-09','2026-02-15','Synthetic location','Cleaning','ROLLBACK ONLY source row',1250,'Ja','#fixture','Synthetic','Synthetic external invoice',i,1,2500);
 begin insert into public.mzs_lease_invoices(issuer_id,number) values(e,n);raise exception 'Unexpected duplicate rental number';exception when unique_violation then null;end;
 begin insert into public.mzs_booking_invoices(issuer_id,number) values(e,n);raise exception 'Unexpected duplicate booking number';exception when unique_violation then null;end;
 perform set_config('mzs.test.history_batch',b::text,true);perform set_config('mzs.test.history_invoice',i::text,true);perform set_config('mzs.test.history_worker',w::text,true);perform set_config('mzs.test.history_issuer',e::text,true);
 perform set_config('request.jwt.claim.sub',(select id::text from public.profiles where role::text='admin' and is_active order by id limit 1),true);
end $test$;
set constraints all immediate;
set local role authenticated;
do $test$ declare s jsonb;v jsonb;begin
 s:=public.mzs_ops_historical_source(2026,current_setting('mzs.test.history_worker')::uuid);
 if (select count(*) from jsonb_array_elements(s->'rows') x where x->>'batch_id'=current_setting('mzs.test.history_batch'))<>2 then raise exception 'Incomplete historical rows';end if;
 s:=public.mzs_ops_accountant_source(current_setting('mzs.test.history_issuer')::uuid);
 select x into v from jsonb_array_elements(s->'external') x where x->>'id'=current_setting('mzs.test.history_invoice');
 if v is null or (v->>'net_total')::numeric<>75 or (v->>'vat_total')::numeric<>15.75 or (v->>'total')::numeric<>90.75 then raise exception 'Incorrect external sales export';end if;
 perform set_config('request.jwt.claim.sub',current_setting('mzs.test.history_worker'),true);
 if exists(select 1 from public.mzs_ops_historical_cost_rows where batch_id=current_setting('mzs.test.history_batch')::uuid) then raise exception 'Worker can read private costs';end if;
 begin perform public.mzs_ops_historical_source(2026);raise exception 'Unexpected worker report access';exception when insufficient_privilege then null;end;
end $test$;
reset role;
select 'PASS: complete historical import, existing invoice number guards, exact accountant amounts and worker denial; all changes rolled back' as result;
rollback;
