-- Synthetic Staging-only fixtures. All records are rolled back; never run on Production.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $test$
declare
 rid uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); uid uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid();
 uid2 uuid:=gen_random_uuid(); cid2 uuid:=gen_random_uuid();
 pid uuid; blocked boolean; c public.mzs_lease_contracts; snap jsonb; n int;
begin
 select property_id into strict pid from public.mzs_lease_contracts limit 1;
 insert into public.mzs_lease_relationships(id,name,kind,address,email) values(rid,'Billing completion fixture','person','Test street 1','');
 insert into public.mzs_lease_issuers(id,name,kind,address,iban,prefix) values(eid,'Fixture issuer','person','Test street 2','NL00TEST0000000000','QA'||upper(substr(md5(eid::text),1,8)));
 insert into public.mzs_estate_units(id,property_id,address,unit_type,monthly_rent,source_reference) values(uid,pid,'Fixture unit','studio',100,'billing-test-'||uid);
 insert into public.mzs_lease_contracts(id,title,property_id,unit_ids,tenant_name,tenant_address,tenant_relationship_id,issuer_id,contract_date,lease_start,first_period,first_generation_date,lines)
 values(cid,'Billing completion fixture',pid,array[uid],'Fixture tenant','Test street 1',rid,eid,'2026-10-27','2026-11-01','2026-12-01','2026-11-14','[{"description":"Rent","amount":"100.00","vat":"21"}]');
 update public.mzs_lease_contracts set status='active' where id=cid;
 update public.mzs_lease_relationships set email='billing@example.invalid' where id=rid;
 update public.mzs_lease_issuers set tax_id='NL000000000B01' where id=eid;
 blocked:=false;
 begin update public.mzs_lease_contracts set tenant_email='wrong@example.invalid' where id=cid;
 exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'FAIL: unlinked email accepted'; end if;
 blocked:=false;
 begin update public.mzs_lease_contracts set issuer_tax_id='WRONG' where id=cid;
 exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'FAIL: unlinked tax accepted'; end if;
 blocked:=false;
 begin update public.mzs_lease_contracts set tenant_email='billing@example.invalid',deposit=1 where id=cid;
 exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'FAIL: economic change accepted'; end if;
 update public.mzs_lease_contracts set tenant_email='billing@example.invalid',issuer_tax_id='NL000000000B01' where id=cid;
 select * into strict c from public.mzs_lease_contracts where id=cid;
 if c.version<>3 or c.tenant_email<>'billing@example.invalid' or c.issuer_tax_id<>'NL000000000B01' or c.deposit<>0 then raise exception 'FAIL: completion or version'; end if;
 if not exists(select 1 from public.mzs_lease_audit where contract_id=cid and old_record->>'tenant_email'='' and new_record->>'tenant_email'='billing@example.invalid' and old_record->>'issuer_tax_id'='' and new_record->>'issuer_tax_id'='NL000000000B01') then raise exception 'FAIL: audit missing'; end if;
 update public.mzs_lease_relationships set email='changed@example.invalid' where id=rid;
 blocked:=false;
 begin update public.mzs_lease_contracts set tenant_email='changed@example.invalid' where id=cid;
 exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'FAIL: existing value overwritten'; end if;
 insert into public.mzs_estate_units(id,property_id,address,unit_type,monthly_rent,source_reference) values(uid2,pid,'Fixture unit 2','studio',100,'billing-test-'||uid2);
 insert into public.mzs_lease_contracts(id,title,property_id,unit_ids,tenant_name,tenant_address,tenant_relationship_id,issuer_id,contract_date,lease_start,first_period,first_generation_date,lines)
 values(cid2,'Billing completion fixture 2',pid,array[uid2],'Fixture tenant','Test street 1',rid,eid,'2026-10-27','2026-11-01','2026-12-01','2026-11-14','[{"description":"Rent","amount":"100.00","vat":"21"}]');
 update public.mzs_lease_contracts set status='active' where id=cid2;
 perform mzs_private.generate_lease_drafts('2026-11-14');
 select snapshot into strict snap from public.mzs_lease_invoice_drafts where contract_id=cid and period_start='2026-12-01';
 if snap->>'tenant_email'<>'billing@example.invalid' or snap->>'issuer_tax_id'<>'NL000000000B01' then raise exception 'FAIL: future snapshot missing details'; end if;
 if not exists(select 1 from public.mzs_lease_invoice_drafts where contract_id=cid and total=121 and due_date='2026-11-30') then raise exception 'FAIL: amount or date changed'; end if;
 blocked:=false;
 begin update public.mzs_lease_contracts set tenant_email='changed@example.invalid' where id=cid2;
 exception when raise_exception then blocked:=true; end;
 if not blocked then raise exception 'FAIL: post-invoice completion accepted'; end if;
 n:=mzs_private.generate_lease_drafts('2026-11-14');
 if n<>0 then raise exception 'FAIL: duplicate generation'; end if;
end $test$;
do $permission$
declare affected int;
begin
 execute 'set local role authenticated';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 update public.mzs_lease_contracts set tenant_email='denied@example.invalid' where title like 'Billing completion fixture%';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL: non-admin write allowed'; end if;
 execute 'reset role';
end $permission$;

select 'PASS: non-admin RLS denial, linked missing identifiers, audit, version, unchanged amounts/dates, no existing-value overwrite, no unrelated changes, pre-invoice restriction, generated snapshots, idempotency' as result;
rollback;