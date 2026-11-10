import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('monthly cleaning: cron, rounding, carry-forward, review, immutable issue and access boundaries',async()=>{
 const db=new PGlite();const admin='11111111-1111-4111-8111-111111111111',worker='22222222-2222-4222-8222-222222222222';
 const migration=n=>readFileSync('supabase/migrations/'+n,'utf8');
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const actor=async id=>db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`);
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;grant usage on schema auth to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table profiles(id uuid primary key,role text,is_active boolean,email text);
 insert into profiles values('${admin}','admin',true,'admin@example.invalid'),('${worker}','client',true,'worker@example.invalid');
 create function is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active)$$;
 create table mzs_estate_properties(id uuid primary key);insert into mzs_estate_properties values(gen_random_uuid());
 create table mzs_estate_units(id uuid primary key,property_id uuid,address text);insert into mzs_estate_units select gen_random_uuid(),id,'Synthetic office' from mzs_estate_properties;
 grant select on mzs_estate_properties,mzs_estate_units,profiles to authenticated;
 create schema storage;create table storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
 for(const file of ['20261024081252_estate_contract_drafts.sql','20261024085449_lease_production_controls.sql','20261024091451_rental_platform_integration.sql','20261024110718_rental_acceptance_snapshot_fix.sql','20261105234353_managed_lease_pricing_and_adjustments.sql'])await db.exec(migration(file));
 await db.exec(`alter table mzs_lease_issuers add column kind text default 'person';
 create table mzs_ops_staff_work_areas(id text primary key check(id in ('maintenance-beverwijk','private-magdy')),name text);
 create table mzs_ops_staff_area_scopes(profile_id uuid,area_id text,action text,recorded_by uuid,reason text);
 create table mzs_ops_external_sales_invoices(number text);
 create table mzs_ops_staff_visits(id uuid primary key default gen_random_uuid(),profile_id uuid,worked_on date default current_date-2,actual_minutes int,description text,work_area_id text default 'zorgbalans');
 create table mzs_ops_visit_reviews(visit_id uuid,correction_id uuid,decision text);
 create table mzs_ops_visit_correction_requests(id uuid primary key default gen_random_uuid(),visit_id uuid,proposed_minutes int,sequence_no bigint generated always as identity);
 create table mzs_ops_visit_correction_decisions(correction_id uuid,decision text);
 create view mzs_ops_current_visits with(security_invoker=true) as select v.*,coalesce(c.proposed_minutes,v.actual_minutes) effective_minutes,r.decision review_decision,
 exists(select 1 from mzs_ops_visit_correction_requests pc where pc.visit_id=v.id and not exists(select 1 from mzs_ops_visit_correction_decisions pd where pd.correction_id=pc.id)) correction_pending
 from mzs_ops_staff_visits v left join lateral(select c.id,c.proposed_minutes from mzs_ops_visit_correction_requests c join mzs_ops_visit_correction_decisions d on d.correction_id=c.id and d.decision='approved' where c.visit_id=v.id order by c.sequence_no desc limit 1)c on true
 left join mzs_ops_visit_reviews r on r.visit_id=v.id and r.correction_id is not distinct from c.id and is_admin();
 grant select on mzs_ops_staff_visits,mzs_ops_current_visits,mzs_ops_visit_reviews,mzs_ops_visit_correction_requests,mzs_ops_visit_correction_decisions,mzs_ops_external_sales_invoices to authenticated;
 grant insert on mzs_ops_visit_correction_requests to authenticated;
 insert into mzs_lease_issuers(name,address,iban,prefix) values('Magdy Nashed','Synthetic issuer address','TEST-IBAN','TEST');`);
 await db.exec(migration('20261030104500_zorgbalans_staff_time_private_billing.sql'));
 const addVisit=async(min,description,offset=-2,approved=true)=>{
  await db.exec('reset role');const [v]=await q('insert into mzs_ops_staff_visits(profile_id,worked_on,actual_minutes,description) values($1,current_date+$2::int,$3,$4) returning id',[worker,offset,min,description]);
  if(approved)await q("insert into mzs_ops_visit_reviews(visit_id,decision) values($1,'approved')",[v.id]);return v.id;
 };
 const old=await addVisit(60,'Already separately billed');await actor(admin);
 await q("select mzs_ops_prepare_zorgbalans_invoice('999999',array[$1]::uuid[],current_date)",[old]);
 const a=await addVisit(45,'Synthetic cleaning');const b=await addVisit(60,'Synthetic corrected cleaning');
 const [correction]=await q('insert into mzs_ops_visit_correction_requests(visit_id,proposed_minutes) values($1,73) returning id',[b]);
 await q("insert into mzs_ops_visit_correction_decisions values($1,'approved')",[correction.id]);
 await q("insert into mzs_ops_visit_reviews values($1,$2,'approved')",[b,correction.id]);
 const late=await addVisit(15,'Awaiting approval',-1,false);
 await addVisit(30,'Future work',1);await addVisit(30,'Historical work',-400);
 await db.exec(migration('20261110120854_zorgbalans_monthly_lease_cleaning.sql'));
 await actor(admin);
 const [c]=await q(`insert into mzs_lease_contracts(title,property_id,unit_ids,tenant_name,tenant_address,issuer_name,issuer_address,issuer_iban,issuer_id,contract_date,lease_start,first_period,first_generation_date,lines,pricing_basis,line_roles)
 select 'Synthetic monthly lease',p.id,array[u.id],'Synthetic Zorgbalans tenant','Test address','Synthetic issuer','Test address','TEST-IBAN',e.id,current_date,current_date,date_trunc('month',current_date)+interval '1 month',date_trunc('month',current_date)+interval '13 days',
 '[{"description":"Rent","amount":"1000","vat":"exempt"},{"description":"Advance","amount":"100","vat":"21"}]','separate','["rent","advance"]'
 from mzs_estate_properties p,mzs_estate_units u,mzs_lease_issuers e returning id`);
 await q("update mzs_lease_contracts set status='active' where id=$1",[c.id]);
 await q("select mzs_configure_lease_cleaning($1,'2026-10-26')",[c.id]);
 await assert.rejects(q("select mzs_ops_prepare_zorgbalans_invoice('999998',array[$1]::uuid[],current_date)",[a]),/monthly rental invoice/);
 // Real scheduler identity: no JWT. Staff-facing review visibility must not suppress approvals.
 await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);select mzs_private.generate_lease_drafts((date_trunc('month',current_date)+interval '13 days')::date)");
 let [draft]=await q('select * from mzs_lease_invoice_drafts where contract_id=$1',[c.id]);
 assert.equal(draft.lines.length,3);assert.equal(draft.lines[0].net,1000);assert.equal(draft.lines[1].net,100);
 assert.equal(draft.snapshot.cleaning.hours,3);assert.equal(Number(draft.total),1211.75);
 assert.deepEqual(draft.snapshot.cleaning.entries.map(e=>[e.actual_minutes,e.approved_minutes,e.hours]).sort(),[[45,45,1],[60,73,2]]);
 assert.equal(draft.lines.filter(l=>l.source==='zorgbalans_cleaning').length,1);assert.equal(draft.lines.at(-1).unit_id,undefined);
 assert.match(draft.lines.at(-1).description,/Grote kantoor 1 x per 2 weken/);assert.match(draft.lines.at(-1).description,/Kleine kantoor 1 x per maand/);
 await actor(admin);assert.equal((await q('select * from mzs_ops_zorgbalans_billable_visits')).length,0);
 await q('select mzs_refresh_lease_cleaning($1)',[draft.id]);
 assert.equal((await q('select * from mzs_ops_lease_cleaning_visits')).length,2,'refresh is idempotent');
 await db.exec('reset role');await q("insert into mzs_ops_visit_reviews(visit_id,decision) values($1,'approved')",[late]);
 await actor(admin);assert.equal((await q('select * from mzs_ops_zorgbalans_billable_visits')).length,1,'late approval remains visible');
 await q('select mzs_refresh_lease_cleaning($1)',[draft.id]);
 [draft]=await q('select * from mzs_lease_invoice_drafts where id=$1',[draft.id]);assert.equal(draft.snapshot.cleaning.hours,4);assert.equal(Number(draft.total),1242);
 await q("update mzs_lease_invoice_drafts set review_status='checked' where id=$1",[draft.id]);
 await assert.rejects(q('select mzs_refresh_lease_cleaning($1)',[draft.id]),/Keep this invoice for review/);
 const [pending]=await q('insert into mzs_ops_visit_correction_requests(visit_id,proposed_minutes) values($1,90) returning id',[a]);
 await assert.rejects(q('select mzs_issue_lease_invoice($1)',[draft.id]),/Cleaning hours changed/);
 assert.equal((await q('select * from mzs_lease_invoices')).length,0,'failed issue leaves no invoice or number');
 await db.exec('reset role');await q("insert into mzs_ops_visit_correction_decisions values($1,'rejected')",[pending.id]);await actor(admin);
 const [issued]=await q('select mzs_issue_lease_invoice($1) id',[draft.id]);
 const [invoice]=await q('select * from mzs_lease_invoices where id=$1',[issued.id]);
 assert.deepEqual(invoice.payload.snapshot.cleaning,draft.snapshot.cleaning,'issued attachment is frozen');
 await assert.rejects(q('select mzs_refresh_lease_cleaning($1)',[draft.id]),/Issued invoice/);
 await assert.rejects(q('insert into mzs_ops_visit_correction_requests(visit_id,proposed_minutes) values($1,100)',[a]),/issued rental invoice/);
 await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);select mzs_private.generate_lease_drafts((date_trunc('month',current_date)+interval '1 month 13 days')::date)");
 const [next]=await q('select * from mzs_lease_invoice_drafts where contract_id=$1 and id<>$2',[c.id,draft.id]);
 assert.equal(next.lines.length,2);assert.equal(next.snapshot.cleaning.entries.length,0,'no empty charge or repeat hours next month');
 await actor(worker);
 for(const t of ['mzs_ops_lease_cleaning_settings','mzs_ops_lease_cleaning_visits'])assert.equal((await q('select * from '+t)).length,0);
 await assert.rejects(q('select mzs_refresh_lease_cleaning($1)',[next.id]),/Administrator required/);
 await assert.rejects(q("select mzs_configure_lease_cleaning($1,'2026-10-26')",[c.id]),/Administrator required/);
 await assert.rejects(q('select mzs_private.refresh_lease_cleaning($1)',[next.id]),/permission denied/);
 await actor(admin);await assert.rejects(q('delete from mzs_ops_lease_cleaning_visits'),/permission denied/);
 await db.exec('reset role;set role anon');await assert.rejects(q('select * from mzs_ops_lease_cleaning_settings'),/permission denied/);
 }finally{await db.close();}
});
