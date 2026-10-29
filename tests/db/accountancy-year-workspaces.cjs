const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require(process.env.MZS_PGLITE_MODULE||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 const admin='11111111-1111-4111-8111-111111111111',client='11111111-1111-4111-8111-111111111112';
 const prop='22222222-2222-4222-8222-222222222222';
 const issuer='33333333-3333-4333-8333-333333333333';
 const supplier='44444444-4444-4444-8444-444444444444';
 const unit='55555555-5555-4555-8555-555555555555';
 const wrongUnit='66666666-6666-4666-8666-666666666666';
 await db.exec([
  'create role anon;create role authenticated;create role service_role;',
  'create schema auth;create schema mzs_private;',
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  'grant usage on schema auth to authenticated;',
  'create table public.profiles(id uuid primary key,role text,is_active boolean);',
  "insert into public.profiles values('"+admin+"','admin',true),('"+client+"','client',true);",
  "create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) $$;",
  'create table public.mzs_estate_properties(id uuid primary key);',
  'create table public.mzs_estate_units(id uuid primary key,property_id uuid);',
  'create table public.mzs_lease_issuers(id uuid primary key);',
  'create table public.mzs_lease_relationships(id uuid primary key);',
  "insert into public.mzs_estate_properties values('"+prop+"');",
  "insert into public.mzs_estate_units values('"+unit+"','"+prop+"'),('"+wrongUnit+"','11111111-1111-4111-8111-111111111111');",
  "insert into public.mzs_lease_issuers values('"+issuer+"');",
  "insert into public.mzs_lease_relationships values('"+supplier+"');"
 ].join('\n'));
 await db.exec(fs.readFileSync('supabase/migrations/20261028175000_mzs_ops_entity_links_production.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261028183500_mzs_ops_expense_drafts_production.sql','utf8'));

 await db.exec(`alter table mzs_lease_issuers add column name text default 'Fixture';alter table mzs_lease_issuers add column tax_id text;
 alter table mzs_estate_properties add column name text default 'Fixture property';alter table mzs_lease_relationships add column name text default 'Fixture supplier';
 create table mzs_accountancy_documents(id uuid,issuer_id uuid,fiscal_year integer,title text,original_name text,category text,review_status text,sha256 text,notes text,created_at timestamptz,updated_at timestamptz);
 create table mzs_capital_deals(id uuid,entity_id uuid,title text);
 grant select on mzs_lease_issuers,mzs_estate_properties,mzs_lease_relationships,mzs_accountancy_documents,mzs_capital_deals to authenticated;
 create function mzs_ops_accountant_source(e uuid) returns jsonb language sql stable as $$select jsonb_build_object('issuer',jsonb_build_object('id',e,'name','Fixture'),'leases','[]'::jsonb,'bookings','[]'::jsonb,'rent_receipts','[]'::jsonb,'guest_receipts','[]'::jsonb,'external','[]'::jsonb,'external_receipts','[]'::jsonb,'imported','[]'::jsonb,'imported_receipts','[]'::jsonb,'services','[]'::jsonb,'service_receipts','[]'::jsonb,'credit_notes','[]'::jsonb)$$;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261029112336_accountancy_year_workspaces.sql','utf8'));
 const q=(sql,params=[])=>db.query(sql,params),actor=async(id)=>db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);
 await actor(admin);
 const year=(await q(`insert into mzs_accountancy_years(issuer_id,fiscal_year,purpose) values($1,2026,'current') returning *`,[issuer])).rows[0];
 const older=(await q(`insert into mzs_accountancy_years(issuer_id,fiscal_year,purpose) values($1,2023,'reference') returning *`,[issuer])).rows[0];
 assert.equal(year.revision,1);assert.equal(year.updated_by,admin);
 await assert.rejects(q('insert into mzs_accountancy_years(issuer_id,fiscal_year) values($1,2026)',[issuer]),/duplicate/);
 await assert.rejects(q("update mzs_accountancy_years set vat_treatment='no_recovery' where id=$1",[year.id]),/check constraint/);
 await assert.rejects(q("update mzs_accountancy_years set checks='{}' where id=$1",[year.id]),/Invalid year checklist/);
 await q("update mzs_accountancy_years set vat_treatment='no_recovery',vat_effective_from='2026-01-01',vat_evidence='Synthetic confirmed evidence' where id=$1 and revision=1",[year.id]);
 assert.equal((await q('update mzs_accountancy_years set notes=$1 where id=$2 and revision=1 returning id',['stale',year.id])).rows.length,0);
 const add=async(number,property=null,scope='entity')=>(await q(`insert into mzs_ops_expense_drafts(cost_scope,property_id,legal_entity_id,supplier_relationship_id,supplier_invoice_number,invoice_date,category,description,net_cents,vat_cents,allocations) values($1,$2,$3,$4,$5,'2026-06-01','advice','Synthetic advisory invoice',10000,2100,'[{"unit_id":null,"net_cents":10000,"vat_cents":2100}]') returning id`,[scope,property,issuer,supplier,number])).rows[0].id;
 const cost=await add('ADVICE-1');await assert.rejects(add('advice-1'),/duplicate/);
 await assert.rejects(add('BAD-PROPERTY',prop,'property'),/Verified property paying entity/);
 await assert.rejects(add('BAD-SCOPE',prop,'entity'),/check constraint/);
 await assert.rejects(add('NULL-PROPERTY',null,'property'),/Verified property|check constraint/);
 await q("insert into mzs_ops_property_entity_links(property_id,legal_entity_id,relationship_type,effective_from,evidence_reference) values($1,$2,'payer','2026-01-01','Synthetic payer evidence')",[prop,issuer]);
 const propertyCost=await add('PROPERTY-1',prop,'property');
 const project=(await q("insert into mzs_accountancy_projects(year_id,property_id,name,kind,source_reference) values($1,$2,'Synthetic renovation','renovation','Fixture') returning id",[year.id,prop])).rows[0].id;
 await assert.rejects(q("insert into mzs_accountancy_cost_reviews(draft_id,year_id,category) values($1,$2,'advice')",[cost,older.id]),/does not belong/);
 await assert.rejects(q("insert into mzs_accountancy_cost_reviews(draft_id,year_id,category,project_id) values($1,$2,'advice',$3)",[cost,year.id,project]),/scope/);
 await assert.rejects(q("insert into mzs_accountancy_cost_reviews(draft_id,year_id,category,review_status) values($1,$2,'advice','reviewed')",[cost,year.id]),/check constraint/);
 await q("insert into mzs_accountancy_cost_reviews(draft_id,year_id,category,review_status,evidence_reference) values($1,$2,'advice','reviewed','Fixture original invoice')",[cost,year.id]);
 await q("insert into mzs_accountancy_cost_reviews(draft_id,year_id,category,project_id,review_status,note) values($1,$2,'renovation',$3,'excluded','Duplicate evidence under review')",[propertyCost,year.id,project]);
 await assert.rejects(q("update mzs_ops_expense_drafts set net_cents=0 where id=$1",[cost]),/permission denied/);
 await assert.rejects(q("update mzs_accountancy_cost_reviews set year_id=$1 where draft_id=$2",[older.id,cost]),/permission denied/);
 await assert.rejects(q("delete from mzs_accountancy_years where id=$1",[year.id]),/permission denied/);
 await assert.rejects(q("delete from mzs_accountancy_year_audit"),/permission denied/);
 let source=(await q('select mzs_accountancy_year_source($1) s',[year.id])).rows[0].s;
 assert.equal(source.costs.length,2);assert.equal(source.reviews.length,2);assert.equal(source.projects.length,1);assert.equal(source.administration.vat_treatment,'no_recovery');
 assert.equal((await q('select mzs_accountancy_year_source($1) s',[older.id])).rows[0].s.costs.length,0);
 assert.equal((await q('select count(*)::integer n from mzs_accountancy_year_audit')).rows[0].n,6);
 const audit=(await q("select after_snapshot from mzs_accountancy_year_audit where source_table='mzs_accountancy_cost_reviews' order by id limit 1")).rows[0].after_snapshot;assert.equal(audit.draft_id,cost);assert.equal(audit.updated_by,admin);
 await actor(client);for(const table of ['mzs_accountancy_years','mzs_accountancy_projects','mzs_accountancy_cost_reviews','mzs_accountancy_year_audit'])assert.equal((await q('select * from '+table)).rows.length,0);
 await assert.rejects(q('select mzs_accountancy_year_source($1)',[year.id]),/Group Admin/);await assert.rejects(add('CLIENT'),/Group Admin|row-level/);
 await db.exec(`reset role;update profiles set is_active=false where id='${admin}';`);await actor(admin);assert.equal((await q('select * from mzs_accountancy_years')).rows.length,0);await assert.rejects(q('select mzs_accountancy_year_source($1)',[year.id]),/Group Admin/);
 await db.exec('reset role;set role anon');await assert.rejects(q('select * from mzs_accountancy_years'),/permission denied/);await assert.rejects(q('select mzs_accountancy_year_source($1)',[year.id]),/permission denied/);
 console.log('Annual administration SQL passed: RLS, active admin, immutable source amounts, company/property scope, dated payer validation, duplicate prevention, review evidence, project/year isolation, optimistic revisions, snapshot and append-only audit.');
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
