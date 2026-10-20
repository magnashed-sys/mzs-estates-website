-- Synthetic fixtures only. Every mutation is rolled back by the handled exception.
do $test$
declare
 a uuid; c uuid; scoped uuid:=gen_random_uuid(); inactive uuid:=gen_random_uuid();
 d uuid:=gen_random_uuid(); i uuid:=gen_random_uuid(); p uuid:=gen_random_uuid();
 doc uuid:=gen_random_uuid(); path text; denied boolean; n integer;
begin
 select id into a from public.profiles where role='admin' and is_active limit 1;
 select id into c from public.profiles where role='client' and is_active limit 1;
 if a is null or c is null then raise exception 'Staging fixtures required';end if;
 begin
  insert into auth.users(id,aud,role,email,raw_user_meta_data) values
   (scoped,'authenticated','authenticated','loan-scope-'||scoped||'@example.invalid','{"full_name":"Synthetic scope"}'),
   (inactive,'authenticated','authenticated','loan-inactive-'||inactive||'@example.invalid','{"full_name":"Synthetic inactive"}');
  update public.profiles set is_active=true where id=scoped;
  update public.profiles set role='admin',is_active=false where id=inactive;
  perform set_config('request.jwt.claim.sub',a::text,true);
  execute 'set local role authenticated';
  perform public.mzs_set_admin_department_scope(scoped,'capital',true);
  insert into public.mzs_capital_deals(id,title,direction,lender,borrower,principal,annual_rate)
   values(d,'Synthetic loan','provided','Synthetic lender','Synthetic borrower',1000,10);
  insert into public.mzs_capital_instalments(id,deal_id,kind,due_date,amount) values(i,d,'interest',current_date,100);
  insert into public.mzs_capital_payments(id,instalment_id,amount,paid_on,reference) values(p,i,40,current_date,'Synthetic receipt');
  if (select recorded_by from public.mzs_capital_payments where id=p)<>a then raise exception 'Actor not recorded';end if;
  denied:=false;begin insert into public.mzs_capital_payments(instalment_id,amount,paid_on,reference) values(i,61,current_date,'Overpayment');exception when sqlstate '22023' then denied:=true;end;
  if not denied then raise exception 'Overpayment accepted';end if;
  denied:=false;begin insert into public.mzs_capital_payments(instalment_id,amount,paid_on,reference) values(i,1,current_date+1,'Future payment');exception when sqlstate '22023' then denied:=true;end;
  if not denied then raise exception 'Future payment accepted';end if;
  denied:=false;begin insert into public.mzs_capital_payments(id,instalment_id,amount,paid_on,reference) values(p,i,40,current_date,'Duplicate');exception when unique_violation then denied:=true;end;
  if not denied then raise exception 'Duplicate accepted';end if;
  denied:=false;begin update public.mzs_capital_payments set amount=20 where id=p;exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Payment overwritten';end if;
  update public.mzs_capital_payments set is_void=true,void_reason='Synthetic correction' where id=p;
  insert into public.mzs_capital_payments(instalment_id,amount,paid_on,reference) values(i,100,current_date,'Replacement receipt');
  if (select sum(amount) from public.mzs_capital_payments where instalment_id=i and not is_void)<>100 then raise exception 'Void not excluded';end if;
  if (select count(*) from public.mzs_capital_deal_audit where row_id=p)<>2 then raise exception 'Audit incomplete';end if;
  denied:=false;begin delete from public.mzs_capital_deal_audit where row_id=p;exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Audit deletable';end if;
  path:=d::text||'/'||doc::text||'.pdf';
  insert into storage.objects(bucket_id,name) values('mzs-private-capital-documents',path);
  insert into public.mzs_capital_documents(id,deal_id,title,category,version_label,file_path,file_size)
   values(doc,d,'Synthetic document','agreement','1',path,100);
  n:=0;begin
   delete from storage.objects where bucket_id='mzs-private-capital-documents' and name=path;
   get diagnostics n=row_count;
  exception when insufficient_privilege then n:=0;end;
  if n<>0 then raise exception 'Attached document deletable';end if;
  perform set_config('request.jwt.claim.sub',c::text,true);
  if exists(select 1 from public.mzs_capital_deals where id=d) or exists(select 1 from public.mzs_capital_deal_audit where row_id=p)
    or exists(select 1 from storage.objects where bucket_id='mzs-private-capital-documents' and name=path) then raise exception 'Client data exposure';end if;
  denied:=false;begin insert into public.mzs_capital_deals(title,direction,lender,borrower,principal,annual_rate) values('Bad insert','received','Party A','Party B',100,1);exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Client write allowed';end if;
  perform set_config('request.jwt.claim.sub',scoped::text,true);
  if exists(select 1 from public.mzs_capital_deals where id=d) then raise exception 'Scoped admin exposure';end if;
  perform set_config('request.jwt.claim.sub',inactive::text,true);
  if exists(select 1 from public.mzs_capital_deals where id=d) then raise exception 'Inactive admin exposure';end if;
  execute 'set local role anon';perform set_config('request.jwt.claim.sub','',true);
  denied:=false;begin perform 1 from public.mzs_capital_deals;exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Anonymous access allowed';end if;
  raise sqlstate 'PZ999' using message='All assertions passed; rollback fixtures';
 exception when sqlstate 'PZ999' then null;
 end;
end $test$;
select 'PASS: admin workflow, partial/full payments, overpayment, future date, duplicate, immutability, void, audit, private documents, client, scoped admin, inactive admin and anonymous denial; all fixtures rolled back' as result;
