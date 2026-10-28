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
 const q=(sql)=>db.query(sql);
 const tables=(await q("select relname,relrowsecurity from pg_class where relname like 'mzs_ops_expense_draft%' and relkind='r'")).rows;
 assert.equal(tables.length,2);
 assert.ok(tables.every(x=>x.relrowsecurity));
 await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','"+admin+"',false);");
 const add=(number,alloc)=>q(
  "insert into public.mzs_ops_expense_drafts(property_id,legal_entity_id,supplier_relationship_id,supplier_invoice_number,invoice_date,category,description,net_cents,vat_cents,allocations) "+
  "values('"+prop+"','"+issuer+"','"+supplier+"','"+number+"','2026-10-28','cleaning','Weekly maintenance service',10000,2100,'"+JSON.stringify(alloc)+"'::jsonb) returning id");
 const whole=[{unit_id:null,net_cents:10000,vat_cents:2100}];
 await assert.rejects(add('CLEAN001',whole),/Verified property paying entity required/);
 await q("insert into public.mzs_ops_property_entity_links(property_id,legal_entity_id,relationship_type,effective_from,evidence_reference) "+
 "values('"+prop+"','"+issuer+"','payer','2026-01-01','Verified fictional payer evidence for isolated fixture')");
 const result=await add('CLEAN001',whole);assert.equal(result.rows.length,1);
 const id=result.rows[0].id;
 assert.equal((await q("select count(*)::int as n from public.mzs_ops_expense_draft_audit where draft_id='"+id+"'")).rows[0].n,1);
 await assert.rejects(add('clean001',whole),/duplicate key/);
 await assert.rejects(add('CLEAN002',[{unit_id:null,net_cents:9999,vat_cents:2100}]),/do not reconcile/);
 await assert.rejects(add('CLEAN003',[{unit_id:wrongUnit,net_cents:10000,vat_cents:2100}]),/part of this property/);
 await assert.rejects(add('CLEAN004',[{unit_id:unit,net_cents:5000,vat_cents:1050},{unit_id:unit,net_cents:5000,vat_cents:1050}]),/duplicated/);
 await assert.rejects(add('CLEAN005',[{unit_id:null,net_cents:5000,vat_cents:1050},{unit_id:unit,net_cents:5000,vat_cents:1050}]),/do not reconcile/);
 await assert.rejects(add('CLEAN006',[{unit_id:unit,vat_cents:2100}]),/integer-cent/);
 assert.equal((await add('CLEAN007',[{unit_id:unit,net_cents:10000,vat_cents:2100}])).rows.length,1);
 await assert.rejects(q("update public.mzs_ops_expense_drafts set net_cents=1 where id='"+id+"'"),/permission denied/);
 await assert.rejects(q("delete from public.mzs_ops_expense_drafts where id='"+id+"'"),/permission denied/);
 await db.exec("select set_config('request.jwt.claim.sub','"+client+"',false);");
 assert.equal((await q("select count(*)::int as n from public.mzs_ops_expense_drafts")).rows[0].n,0);
 await assert.rejects(add('CLIENT1',whole),/row-level security|permission denied|Group Admin/);
 await db.exec('reset role;');
 assert.equal((await q("select count(*)::int as n from public.mzs_ops_expense_drafts")).rows[0].n,2);
 console.log('Staging-only expense drafts: verified payer, cents, audit, duplicate, RLS checks passed');
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
