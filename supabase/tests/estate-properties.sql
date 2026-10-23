-- Run only in Staging. All fixture rows and test changes are rolled back.
begin;
select set_config('mzs.test_admin',id::text,true) from public.profiles where role='admin' and is_active limit 1;
select set_config('mzs.test_client',id::text,true) from public.profiles where role='client' and is_active limit 1;
do $$ begin
 if nullif(current_setting('mzs.test_admin',true),'') is null or nullif(current_setting('mzs.test_client',true),'') is null then
  raise exception 'Staging admin and client fixtures required';
 end if;
end $$;
with p as (
 insert into public.mzs_estate_properties(slug,name,address,city,country_code,owner_name,ownership_kind,rent_basis,source_reference)
 values('test-'||gen_random_uuid()::text,'Synthetic property','Test Street 1','Test City','NL','Synthetic owner','personal','Excludes utilities','Automated rollback test') returning id
) select set_config('mzs.test_property',id::text,true) from p;
insert into public.mzs_estate_units(property_id,address,unit_type,tenant_name,monthly_rent,utilities_advance,source_reference)
 values(current_setting('mzs.test_property')::uuid,'Test Street 1A','room','Synthetic tenant',500.01,null,'Automated rollback test');
do $$ begin
 if (select count(*) from public.mzs_estate_audit where property_id=current_setting('mzs.test_property')::uuid)<>2 then raise exception 'Missing creation audit'; end if;
 begin
  insert into public.mzs_estate_units(property_id,address,unit_type,monthly_rent,source_reference)
   values(current_setting('mzs.test_property')::uuid,'Test Street 1A','room',100,'Duplicate test');
  raise exception 'Duplicate unit accepted';
 exception when unique_violation then null; end;
 begin
  insert into public.mzs_estate_units(property_id,address,unit_type,monthly_rent,source_reference)
   values(current_setting('mzs.test_property')::uuid,'Test Street 2','room',-1,'Negative rent test');
  raise exception 'Negative rent accepted';
 exception when check_violation then null; end;
 update public.mzs_estate_units set monthly_rent=500.02 where property_id=current_setting('mzs.test_property')::uuid;
 if not exists(select 1 from public.mzs_estate_audit where property_id=current_setting('mzs.test_property')::uuid and action='UPDATE' and old_record->>'monthly_rent'='500.01' and new_record->>'monthly_rent'='500.02') then raise exception 'Change audit missing'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('mzs.test_admin'),true);
do $$ begin
 if (select count(*) from public.mzs_estate_properties where id=current_setting('mzs.test_property')::uuid)<>1 then raise exception 'Admin property denied'; end if;
 if (select count(*) from public.mzs_estate_units where property_id=current_setting('mzs.test_property')::uuid)<>1 then raise exception 'Admin units denied'; end if;
 if (select count(*) from public.mzs_estate_audit where property_id=current_setting('mzs.test_property')::uuid)<>3 then raise exception 'Admin audit denied'; end if;
 begin
  update public.mzs_estate_units set monthly_rent=1 where property_id=current_setting('mzs.test_property')::uuid;
  raise exception 'Unaudited browser write allowed';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.mzs_estate_audit where property_id=current_setting('mzs.test_property')::uuid;
  raise exception 'Audit deletion allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('mzs.test_client'),true);
do $$ begin
 if exists(select 1 from public.mzs_estate_properties) or exists(select 1 from public.mzs_estate_units) or exists(select 1 from public.mzs_estate_audit) then raise exception 'Client can see private register'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform 1 from public.mzs_estate_properties;
  raise exception 'Anonymous property access allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: admin-only reads, client/anonymous denial, duplicate/negative guards, append-only browser audit, insert/update audit; fixtures rolled back' as result;
