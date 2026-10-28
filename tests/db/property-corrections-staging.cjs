const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require(process.env.MZS_PGLITE_MODULE||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 const admin='11111111-1111-4111-8111-111111111111',client='11111111-1111-4111-8111-111111111112';
 const prop='22222222-2222-4222-8222-222222222222',issuer='33333333-3333-4333-8333-333333333333';
 const supplier='44444444-4444-4444-8444-444444444444';
 await db.exec([
  'create role anon;create role authenticated;create role service_role;',
  'create schema auth;create schema mzs_private;create schema storage;',
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
  "insert into public.mzs_lease_issuers values('"+issuer+"');",
  "insert into public.mzs_lease_relationships values('"+supplier+"');",
  'create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);',
  'create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));',
  'alter table storage.objects enable row level security;',
  'grant usage on schema storage to authenticated;',
  'grant select,insert,delete on storage.objects to authenticated;'
 ].join('\n'));
 const sql=fs.readFileSync('supabase/migrations/20261028134000_mzs_ops_evidence_review_staging.sql','utf8');
 await db.exec(fs.readFileSync('supabase/migrations/20261028115000_mzs_ops_entity_links_staging.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261028123000_mzs_ops_expense_drafts_staging.sql','utf8'));
 await db.exec(sql);
 await db.exec(fs.readFileSync('supabase/migrations/20261028143000_mzs_ops_correction_requests_staging.sql','utf8'));
 const query=q=>db.query(q);
 const secureTables=(await query("select relname,relrowsecurity from pg_class where relname in ('mzs_ops_expense_documents','mzs_ops_expense_review_events')")).rows;
 assert.equal(secureTables.length,2);
 assert.ok(secureTables.every(x=>x.relrowsecurity));
 assert.equal((await query("select public from storage.buckets where id='mzs-ops-expense-evidence'")).rows[0].public,false);
 await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','"+admin+"',false);");
 await query("insert into mzs_ops_property_entity_links(property_id,legal_entity_id,relationship_type,effective_from,evidence_reference) values('"+prop+"','"+issuer+"','payer','2026-01-01','Verifiable synthetic landlord record')");
 const draft=(await query("insert into mzs_ops_expense_drafts(property_id,legal_entity_id,supplier_relationship_id,supplier_invoice_number,invoice_date,category,description,net_cents,vat_cents,allocations) values('"+prop+"','"+issuer+"','"+supplier+"','TEST-COST-44','2026-10-28','cleaning','Test supplier service',10000,2100,'[{\"unit_id\":null,\"net_cents\":10000,\"vat_cents\":2100}]'::jsonb) returning id")).rows[0].id;
 const uploadName=draft+'/99999999-9999-4999-8999-999999999999.pdf';
 const docSql=(path)=>"insert into mzs_ops_expense_documents(draft_id,storage_path,sha256,mime_type,file_size) values('"+draft+"','"+path+"','"+ 'a'.repeat(64)+"','application/pdf',123) returning id";
 await assert.rejects(query(docSql(uploadName)),/has not been uploaded/);
 await assert.rejects(query("insert into mzs_ops_expense_review_events(draft_id,action,expected_state) values('"+draft+"','submitted','draft')"),/Original supplier document required/);
 // Simulate the Storage API object event in an isolated test DB only.
 await db.exec('reset role');
 await query("insert into storage.objects(bucket_id,name) values('mzs-ops-expense-evidence','"+uploadName+"')");
 await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','"+admin+"',false);");
 await assert.rejects(query(docSql('99999999-9999-4999-8999-999999999999/99999999-9999-4999-8999-999999999999.pdf')),/path does not match/);
 const doc=(await query(docSql(uploadName))).rows[0].id;
 assert.ok(doc);
 await assert.rejects(query(docSql(uploadName)),/duplicate key|Reviewed drafts cannot receive|path/);
 await assert.rejects(query("update mzs_ops_expense_documents set file_size=1 where id='"+doc+"'"),/permission denied/);
 await assert.rejects(query("delete from mzs_ops_expense_documents where id='"+doc+"'"),/permission denied/);
 await assert.rejects(query("insert into mzs_ops_expense_review_events(draft_id,action,expected_state) values('"+draft+"','approved','draft')"),/Invalid review transition/);
 await query("insert into mzs_ops_expense_review_events(draft_id,action,expected_state) values('"+draft+"','submitted','draft')");
 await assert.rejects(query("insert into mzs_ops_expense_review_events(draft_id,action,expected_state) values('"+draft+"','approved','draft')"),/Stale expense review/);
 await assert.rejects(query("insert into mzs_ops_expense_review_events(draft_id,action,expected_state,reason) values('"+draft+"','rejected','submitted','short')"),/Rejection requires a reason/);
 await query("insert into mzs_ops_expense_review_events(draft_id,action,expected_state) values('"+draft+"','approved','submitted')");
 const rows=(await query("select sequence_no,action from mzs_ops_expense_review_events where draft_id='"+draft+"' order by sequence_no")).rows;
 assert.deepEqual(rows.map(x=>x.action),['submitted','approved']);
 assert.deepEqual(rows.map(x=>x.sequence_no),[1,2]);
 await assert.rejects(query("insert into mzs_ops_expense_review_events(draft_id,action,expected_state) values('"+draft+"','submitted','draft')"),/Stale expense review/);
 await assert.rejects(query("delete from mzs_ops_expense_review_events where draft_id='"+draft+"'"),/permission denied/);
 await db.exec("select set_config('request.jwt.claim.sub','"+client+"',false);");
 assert.equal((await query('select count(*)::int as n from mzs_ops_expense_documents')).rows[0].n,0);
 assert.equal((await query('select count(*)::int as n from mzs_ops_expense_review_events')).rows[0].n,0);
 await assert.rejects(query("insert into mzs_ops_expense_review_events(draft_id,action,expected_state) values('"+draft+"','submitted','draft')"),/row-level security|Administrator review required|permission denied/);

 // Correction requests only apply after a completed review, never mutate the original.
 await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','"+admin+"',false);");
 const correctionSql=(n,v)=>"insert into mzs_ops_expense_correction_requests("+
   "draft_id,reason,proposed_description,proposed_net_cents,proposed_vat_cents,proposed_allocations)"+
   " values('"+draft+"','Amount verified against supplier original','Revised maintenance amount',"+n+","+v+","+
   "'[{\"unit_id\":null,\"net_cents\":"+n+",\"vat_cents\":"+v+"}]'::jsonb) returning id";
 const correction=(await query(correctionSql(12500,2625))).rows[0].id;
 assert.ok(correction);
 assert.equal((await query("select count(*)::int as n from public.mzs_ops_expense_correction_requests where draft_id='"+draft+"'")).rows[0].n,1);
 assert.equal((await query("select net_cents from public.mzs_ops_expense_drafts where id='"+draft+"'")).rows[0].net_cents,'10000');
 await assert.rejects(query(correctionSql(20000,4200)),/duplicate key/);
 await assert.rejects(query("update public.mzs_ops_expense_correction_requests set proposed_net_cents=0 where id='"+correction+"'"),/permission denied/);
 await assert.rejects(query("delete from public.mzs_ops_expense_correction_requests where id='"+correction+"'"),/permission denied/);
 await db.exec("select set_config('request.jwt.claim.sub','"+client+"',false);");
 assert.equal((await query("select count(*)::int as n from public.mzs_ops_expense_correction_requests")).rows[0].n,0);
 await assert.rejects(query(correctionSql(12500,2625)),/row-level security|Active administrator required|permission denied/);

 await db.exec('reset role');
 console.log('Private evidence and immutable correction requests tested');
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
