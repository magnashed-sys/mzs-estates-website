import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
test('invoice boundary accepts only approved fresh visits, freezes corrected minutes and prevents repeat billing',async()=>{
 const db=new PGlite();try{
 // Minimal upstream register fixture; the billing migration, RPCs, grants and RLS are executed unchanged.
 const admin='11111111-1111-4111-8111-111111111111',worker='22222222-2222-4222-8222-222222222222';
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;
 create table profiles(id uuid primary key,role text,is_active boolean,email text);insert into profiles values('${admin}','admin',true,'admin@example.invalid'),('${worker}','client',true,'worker@example.invalid');
 create function is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active)$$;
 create table mzs_ops_staff_work_areas(id text primary key check(id in ('maintenance-beverwijk','private-magdy')),name text);
 create table mzs_ops_staff_area_scopes(profile_id uuid,area_id text,action text,recorded_by uuid,reason text);
 create table mzs_lease_issuers(id uuid primary key,name text,kind text);insert into mzs_lease_issuers values(gen_random_uuid(),'Magdy Nashed','person');
 create table mzs_ops_external_sales_invoices(number text);insert into mzs_ops_external_sales_invoices values('7113');
 create table mzs_ops_staff_visits(id uuid primary key default gen_random_uuid(),profile_id uuid,worked_on date default current_date,actual_minutes int,effective_minutes int,description text,review_decision text,correction_pending boolean,work_area_id text);
 create view mzs_ops_current_visits with(security_invoker=true) as select * from mzs_ops_staff_visits;
 grant select on profiles,mzs_lease_issuers,mzs_ops_external_sales_invoices,mzs_ops_staff_visits,mzs_ops_current_visits to authenticated;
 insert into mzs_ops_staff_visits(profile_id,actual_minutes,effective_minutes,description,review_decision,correction_pending,work_area_id) values
 ('${worker}',25,25,'Synthetic first visit','approved',false,'zorgbalans'),
 ('${worker}',60,73,'Synthetic corrected visit','approved',false,'zorgbalans'),
 ('${worker}',30,30,'Pending correction','approved',true,'zorgbalans'),
 ('${worker}',30,30,'Unreviewed visit',null,false,'zorgbalans'),
 ('${worker}',30,30,'Rejected visit','rejected',false,'zorgbalans'),
 ('${worker}',30,30,'Different area','approved',false,'private-magdy');
 insert into mzs_ops_staff_visits(profile_id,worked_on,actual_minutes,effective_minutes,description,review_decision,correction_pending,work_area_id) values('${worker}','2026-10-25',25,25,'Historical source','approved',false,'zorgbalans');`);
 await db.exec(readFileSync('supabase/migrations/20261030104500_zorgbalans_staff_time_private_billing.sql','utf8'));
 const actor=async id=>db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`);
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 await actor(admin);const eligible=await q('select * from mzs_ops_zorgbalans_billable_visits order by effective_minutes');assert.equal(eligible.length,2);assert.equal(eligible[1].invoiced_hours,2);
 const ids=eligible.map(v=>v.id),prepare=(number,chosen)=>q('select mzs_ops_prepare_zorgbalans_invoice($1,$2::uuid[],current_date) id',[number,chosen]);
 const blocked=(await q("select id from mzs_ops_staff_visits where description='Pending correction'"))[0].id;
 await assert.rejects(prepare('9999',[ids[0],blocked]),/fresh, approved/);assert.equal((await q('select * from mzs_ops_zorgbalans_invoices')).length,0);
 await assert.rejects(prepare('7113',ids),/already exists/);await assert.rejects(prepare('9999',[ids[0],ids[0]]),/distinct visits/);
 const invoiceId=(await prepare('9999',ids))[0].id;const invoice=(await q('select * from mzs_ops_zorgbalans_invoices where id=$1',[invoiceId]))[0];assert.equal(invoice.status,'concept');assert.equal(invoice.hours,3);assert.equal(Number(invoice.net_cents),7500);assert.equal(Number(invoice.vat_cents),1575);assert.equal(Number(invoice.gross_cents),9075);
 const lines=await q('select * from mzs_ops_zorgbalans_invoice_lines order by actual_minutes');assert.deepEqual(lines.map(l=>l.actual_minutes),[25,73]);assert.equal((await q('select actual_minutes from mzs_ops_staff_visits where id=$1',[ids[1]]))[0].actual_minutes,60);
 await assert.rejects(prepare('10000',ids),/fresh, approved/);assert.equal((await q('select * from mzs_ops_zorgbalans_billable_visits')).length,0);
 await assert.rejects(q('update mzs_ops_zorgbalans_invoice_lines set actual_minutes=1 where id=$1',[lines[0].id]),/permission denied/);
 await actor(worker);assert.equal((await q('select * from mzs_ops_zorgbalans_invoices')).length,0);assert.equal((await q('select * from mzs_ops_zorgbalans_billable_visits')).length,0);await assert.rejects(prepare('10001',ids),/Administrator required/);await assert.rejects(q('select mzs_ops_confirm_zorgbalans_invoice($1,$2)',[invoiceId,'Synthetic delivery reference']),/Administrator required/);
 await actor(admin);await assert.rejects(q('select mzs_ops_confirm_zorgbalans_invoice($1,$2)',[invoiceId,'short']),/reference/);await q('select mzs_ops_confirm_zorgbalans_invoice($1,$2)',[invoiceId,'Synthetic delivery reference']);await assert.rejects(q('select mzs_ops_confirm_zorgbalans_invoice($1,$2)',[invoiceId,'Synthetic delivery reference']),/already confirmed/);
 await db.exec('reset role;set role anon');await assert.rejects(q('select * from mzs_ops_zorgbalans_invoices'),/permission denied/);
 }finally{await db.close();}
});
