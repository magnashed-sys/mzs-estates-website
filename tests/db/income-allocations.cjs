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
 const project=(await q("insert into mzs_accountancy_projects(year_id,name,kind) values($1,'Synthetic at-risk renovation','renovation') returning id",[year.id])).rows[0].id;
 await db.exec('reset role');
 await db.exec(fs.readFileSync('supabase/migrations/20261105234919_administration_project_income_allocations.sql','utf8'));
 const invoice='77777777-7777-4777-8777-777777777777';
 await db.exec(`create or replace function mzs_ops_accountant_source(e uuid) returns jsonb language sql stable as $$select jsonb_build_object('issuer',jsonb_build_object('id',e,'name','Fixture'),'leases',jsonb_build_array(jsonb_build_object('id','${invoice}','issuer_id',e,'issued_on','2026-04-01','total',1000,'number','SYNTHETIC-1')),'bookings','[]'::jsonb,'external','[]'::jsonb,'services','[]'::jsonb)$$;`);
 await actor(admin);
 await q("insert into mzs_accountancy_income_allocations(year_id,source,invoice_id,project_id,evidence_reference) values($1,'leases',$2,$3,'Synthetic invoice evidence')",[year.id,invoice,project]);
 let source=(await q('select mzs_accountancy_year_source($1) s',[year.id])).rows[0].s;
 assert.equal(source.income_allocations.length,1);assert.equal(source.income_allocations[0].project_id,project);
 await assert.rejects(q("insert into mzs_accountancy_income_allocations(year_id,source,invoice_id,evidence_reference) values($1,'leases',$2,'Duplicate evidence')",[year.id,invoice]),/duplicate/);
 await assert.rejects(q("insert into mzs_accountancy_income_allocations(year_id,source,invoice_id,evidence_reference) values($1,'bookings',$2,'Wrong source evidence')",[year.id,invoice]),/does not belong/);
 await assert.rejects(q("update mzs_accountancy_income_allocations set property_id=$1 where invoice_id=$2",[prop,invoice]),/dated association/);
 await q("insert into mzs_ops_property_entity_links(property_id,legal_entity_id,relationship_type,effective_from,evidence_reference) values($1,$2,'owner','2026-01-01','Synthetic ownership evidence')",[prop,issuer]);
 await assert.rejects(q("update mzs_accountancy_income_allocations set property_id=$1 where invoice_id=$2",[prop,invoice]),/scope/);
 await q("update mzs_accountancy_income_allocations set property_id=$1,project_id=null where invoice_id=$2 and revision=1",[prop,invoice]);
 assert.equal((await q("update mzs_accountancy_income_allocations set property_id=null where invoice_id=$1 and revision=1 returning invoice_id",[invoice])).rows.length,0);
 const audit=(await q("select after_snapshot from mzs_accountancy_year_audit where source_table='mzs_accountancy_income_allocations' order by id desc limit 1")).rows[0].after_snapshot;assert.equal(audit.property_id,prop);assert.equal(audit.revision,2);
 await assert.rejects(q('delete from mzs_accountancy_income_allocations'),/permission denied/);
 await actor(client);assert.equal((await q('select * from mzs_accountancy_income_allocations')).rows.length,0);await assert.rejects(q("insert into mzs_accountancy_income_allocations(year_id,source,invoice_id,evidence_reference) values($1,'leases',$2,'Forbidden evidence')",[year.id,invoice]),/Group Admin|row-level/);
 await db.exec('reset role;set role anon');await assert.rejects(q('select * from mzs_accountancy_income_allocations'),/permission denied/);
 console.log('PASS income allocation: entity/year/source scope, dated property association, project scope, revisions, audit, no amount mutations and authorization.');
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
