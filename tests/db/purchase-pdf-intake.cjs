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

 await db.exec(`alter role service_role bypassrls;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 alter table storage.objects enable row level security;grant usage on schema storage to authenticated,service_role;
 grant select,insert,update,delete on storage.objects to authenticated,service_role;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261029155105_purchase_pdf_intake_staging.sql','utf8'));
 const q=(sql,params=[])=>db.query(sql,params),actor=async(id)=>db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);
 await actor(admin);
 const year=(await q(`insert into mzs_accountancy_years(issuer_id,fiscal_year,purpose) values($1,2026,'current') returning *`,[issuer])).rows[0];
 const fields={supplier,property:'',project:'',category:'advice',currency:'EUR',number:'PDF-TEST-1',date:'2026-06-01',description:'Synthetic PDF only',net:10000,vat:2100,gross:12100,original_checked:true,entity_checked:true};
 const reason='Checked synthetic original';let seq=0;
 async function intake(verdict='clean',withFile=true){
  await db.exec('reset role;set role service_role');
  const id=require('node:crypto').randomUUID(),sha=(++seq).toString(16).padStart(64,'0'),path=issuer+'/'+id+'.pdf';
  await q('insert into mzs_purchase_pdf_intakes(id,year_id,issuer_id,original_name,file_path,sha256,file_size,uploaded_by) values($1,$2,$3,$4,$5,$6,200,$7)',[id,year.id,issuer,'synthetic.pdf',path,sha,admin]);
  if(withFile)await q("insert into storage.objects(bucket_id,name,metadata) values('mzs-purchase-pdf-quarantine',$1,'{\"size\":200}')",[path]);
  return {id,sha,path,verdict};
 }
 async function scanned(i){await db.exec('reset role;set role service_role');return (await q("insert into mzs_purchase_pdf_results(intake_id,sha256,verdict,scanner,extraction) values($1,$2,$3,'Cloudmersive Advanced Virus Scan v1',$4) returning id",[i.id,i.sha,i.verdict,i.verdict==='clean'?'manual':'blocked'])).rows[0].id;}
 const confirm=(i,r,f=fields,accept=true,note=reason)=>q('select mzs_confirm_purchase_pdf($1,$2,$3,$4,$5) id',[i.id,r,JSON.stringify(f),note,accept]);
 const missing=await intake('clean',false);await assert.rejects(scanned(missing),/Original file missing/);
 const pending=await intake();await actor(admin);assert.equal((await q('select * from storage.objects')).rows.length,0);
 await assert.rejects(q("insert into mzs_purchase_pdf_results(intake_id,sha256,verdict,scanner,extraction) values($1,$2,'clean','Cloudmersive Advanced Virus Scan v1','manual')",[pending.id,pending.sha]),/permission denied/);
 await assert.rejects(q('delete from mzs_purchase_pdf_intakes where id=$1',[pending.id]),/permission denied/);
 const clean=await intake();
 await assert.rejects(q("insert into mzs_purchase_pdf_results(intake_id,sha256,verdict,scanner,extraction) values($1,$2,'clean','Cloudmersive Advanced Virus Scan v1','manual')",[clean.id,'f'.repeat(64)]),/checksum/);
 const result=await scanned(clean);await actor(admin);assert.equal((await q('select * from storage.objects')).rows.length,1);
 await assert.rejects(q("insert into storage.objects(bucket_id,name,metadata) values('mzs-purchase-pdf-quarantine','fake','{}')"),/row-level/);
 assert.equal((await q("delete from storage.objects returning *")).rows.length,0);
 for(const bad of [{...fields,gross:12000},{...fields,original_checked:false},{...fields,entity_checked:false},{...fields,currency:'USD'},{...fields,date:'2025-01-01'},{...fields,date:'2026-02-30'},{...fields,property:prop},{...fields,category:'__proto__'},{...fields,supplier:null}])await assert.rejects(confirm(clean,result,bad));
 const project=(await q("insert into mzs_accountancy_projects(year_id,property_id,name,kind) values($1,$2,'Synthetic project','renovation') returning id",[year.id,prop])).rows[0].id;
 await assert.rejects(confirm(clean,result,{...fields,project}),/Project scope/);
 const draft=(await confirm(clean,result)).rows[0].id;assert.ok(draft);
 assert.equal((await confirm(clean,result)).rows[0].id,draft);
 await assert.rejects(confirm(clean,result,{...fields,number:'CHANGED'}),/already decided/);
 const cost=(await q('select * from mzs_ops_expense_drafts where id=$1',[draft])).rows[0];assert.equal(Number(cost.net_cents),10000);assert.equal(Number(cost.vat_cents),2100);assert.equal(cost.status,'draft');
 const review=(await q('select * from mzs_accountancy_cost_reviews where draft_id=$1',[draft])).rows[0];assert.equal(review.review_status,'pending');assert.ok(review.evidence_reference.includes(clean.sha));
 const duplicate=await intake(),dupResult=await scanned(duplicate);await actor(admin);await assert.rejects(confirm(duplicate,dupResult,{...fields,number:' pdf-test-1 '}),/duplicate/);assert.equal((await q('select * from mzs_purchase_pdf_decisions where intake_id=$1',[duplicate.id])).rows.length,0);
 await confirm(duplicate,dupResult,{},false,'Duplicate of known invoice');assert.equal((await q('select * from mzs_ops_expense_drafts')).rows.length,1);
 const blocked=await intake('malicious'),blockedResult=await scanned(blocked);await actor(admin);await assert.rejects(confirm(blocked,blockedResult),/Clean source/);assert.equal((await q('select * from storage.objects where name=$1',[blocked.path])).rows.length,0);await confirm(blocked,blockedResult,{},false,'Blocked source rejected');
 await db.exec('reset role');for(const table of ['mzs_purchase_pdf_intakes','mzs_purchase_pdf_results','mzs_purchase_pdf_decisions'])await assert.rejects(q('delete from '+table),/immutable/);
 await actor(client);for(const table of ['mzs_purchase_pdf_intakes','mzs_purchase_pdf_results','mzs_purchase_pdf_decisions','storage.objects'])assert.equal((await q('select * from '+table)).rows.length,0);await assert.rejects(confirm(clean,result),/Group Admin/);
 await db.exec(`reset role;update profiles set is_active=false where id='${admin}'`);await actor(admin);assert.equal((await q('select * from mzs_purchase_pdf_intakes')).rows.length,0);await assert.rejects(confirm(clean,result),/Group Admin/);
 await db.exec('reset role;set role anon');await assert.rejects(q('select * from mzs_purchase_pdf_intakes'),/permission denied/);await assert.rejects(confirm(clean,result),/permission denied/);
 await db.exec('reset role;set role service_role');await assert.rejects(confirm(clean,result),/permission denied/);
 console.log('Purchase PDF SQL passed: private quarantine, trusted scan only, immutable originals/results/decisions, active admin, balanced amounts, scoped projects/year/payer, duplicate rollback, idempotency, original VAT and pending draft.');await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
