const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require(process.env.MZS_PGLITE_MODULE||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 const admin='11111111-1111-4111-8111-111111111111';
 const worker='22222222-2222-4222-8222-222222222222';
 const other='33333333-3333-4333-8333-333333333333';
 const property='44444444-4444-4444-8444-444444444444';
 const otherProperty='55555555-5555-4555-8555-555555555555';
 const unit='66666666-6666-4666-8666-666666666666';
 await db.exec([
  'create role anon;create role authenticated;create role service_role;',
  'create schema auth; create schema mzs_private;',
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  'grant usage on schema auth to authenticated;',
  'create table public.profiles(id uuid primary key,role text,is_active boolean);',
  "insert into public.profiles values('"+admin+"','admin',true),('"+worker+"','client',true),('"+other+"','client',true);",
  "create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) $$;",
  "create table public.mzs_estate_properties(id uuid primary key,name text,address text,owner_name text,notes text);",
  "create table public.mzs_estate_units(id uuid primary key,property_id uuid,address text,tenant_name text);",
  "insert into public.mzs_estate_properties values('"+property+"','Sample IJmuiden','Street A','PRIVATE OWNER','PRIVATE OWNER NOTES'),('"+otherProperty+"','Other building','Street B','OTHER PRIVATE OWNER','OTHER PRIVATE NOTES');",
  "insert into public.mzs_estate_units values('"+unit+"','"+property+"','Office A','PRIVATE TENANT');",
  'alter table public.mzs_estate_properties enable row level security;',
  'alter table public.mzs_estate_units enable row level security;',
  'grant select on public.mzs_estate_properties to authenticated;',
  'grant select on public.mzs_estate_units to authenticated;',
  'create policy properties_admin_read on public.mzs_estate_properties for select to authenticated using((select public.is_admin()));',
  'create policy units_admin_read on public.mzs_estate_units for select to authenticated using((select public.is_admin()));',
  'grant select on public.profiles to authenticated;',
  'alter table public.profiles enable row level security;',
  'create policy profiles_admin_read on public.profiles for select to authenticated using((select public.is_admin()));',
  'create policy profiles_self_read on public.profiles for select to authenticated using(id=auth.uid());'
 ].join('\n'));
 await db.exec("create table public.mzs_ops_expense_drafts(id uuid primary key,property_id uuid,gross_cents bigint);alter table public.mzs_ops_expense_drafts enable row level security;grant select on public.mzs_ops_expense_drafts to authenticated;create policy expenses_admin on public.mzs_ops_expense_drafts for select to authenticated using(public.is_admin());");
 await db.exec(fs.readFileSync('supabase/migrations/20261028181502_staff_maintenance_core.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261028181508_staff_maintenance_daily_work.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261028182737_staff_maintenance_stale_planning.sql','utf8'));
 const q=(s)=>db.query(s);
 const actor=async id=>{await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");};
 const assigned=(p=property,action='grant')=>q(
  "insert into mzs_ops_staff_scope_events(profile_id,property_id,action,reason) values('"+
  worker+"','"+p+"','"+action+"','Confirmed contractor scope in synthetic staging test') returning id");
 const visit=(p=property,u=unit,date='current_date')=>q(
  "insert into mzs_ops_staff_visits(property_id,unit_id,worked_on,actual_minutes,task_category,description) values('"+
  p+"',"+(u?"'"+u+"'":"null")+","+date+",45,'cleaning','Synthetic 45 minute cleaning visit') returning id");
 const ticket=(p=property,u=unit)=>q(
  "insert into mzs_ops_maintenance_tickets(property_id,unit_id,priority,title,description) values('"+
  p+"',"+(u?"'"+u+"'":"null")+",'urgent','Water leak','Water found near door of maintenance closet') returning id");
 const issuer='77777777-7777-4777-8777-777777777777',supplier='88888888-8888-4888-8888-888888888888';
 await db.exec(`
 create schema storage;grant usage on schema storage to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,unique(bucket_id,name));
 alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;
 create table public.mzs_lease_issuers(id uuid primary key,name text);
 create table public.mzs_lease_relationships(id uuid primary key,name text);
 create table public.mzs_ops_property_entity_links(id uuid primary key default gen_random_uuid(),property_id uuid,legal_entity_id uuid,relationship_type text,effective_from date,effective_until date);
 insert into public.mzs_lease_issuers values('${issuer}','Synthetic entity');insert into public.mzs_lease_relationships values('${supplier}','Synthetic supplier');
 create table public.mzs_lease_invoices(id uuid primary key,issuer_id uuid,contract_id uuid,number text,issued_on date,total numeric);
 create table public.mzs_booking_invoices(id uuid primary key,issuer_id uuid,booking_id uuid,number text,issued_on date,total numeric,net_total numeric,vat_total numeric);
 create table public.mzs_lease_payments(id uuid primary key,invoice_id uuid,amount numeric,received_on date,reference text,reversed_at timestamptz);
 create table public.mzs_booking_receipts(id uuid primary key,booking_id uuid,amount numeric,received_on date,reference text,receipt_type text,reversed_at timestamptz);
 grant select on public.mzs_lease_issuers,public.mzs_lease_relationships,public.mzs_ops_property_entity_links,public.mzs_lease_invoices,public.mzs_booking_invoices,public.mzs_lease_payments,public.mzs_booking_receipts to authenticated;
 `);
 await db.exec(fs.readFileSync('supabase/migrations/20261028184233_operations_orders_photos.sql','utf8'));

 await db.exec("alter table profiles add full_name text;update profiles set full_name='Synthetic person';");
 await db.exec(fs.readFileSync('supabase/migrations/20261028200320_historical_cost_register.sql','utf8'));
 const batch='99999999-9999-4999-8999-999999999991',invoice='99999999-9999-4999-8999-999999999992';
 const batchSql=(bid=batch,key='fixture-one',count=3,cost=18750)=>`insert into mzs_ops_historical_batches(id,profile_id,reporting_year,source_key,source_name,source_file_id,source_sha256,hash_basis,expected_rows,expected_cost_cents,authorization_reference) values('${bid}','${worker}',2026,'${key}','Synthetic cost source.csv','libfile_fixture','${'a'.repeat(64)}','extracted_csv_utf8_lf',${count},${cost},'Synthetic owner authorization for database test');`;
 const invoiceSql=(iid=invoice,num='EXT-TEST-1',bid=batch)=>`insert into mzs_ops_external_sales_invoices(id,batch_id,issuer_id,customer_id,property_id,number,issued_on,due_on,period_from,period_until,customer_reference,net_cents,vat_cents,gross_cents,vat_basis_points,billed_hours,hourly_rate_cents,source_file_id,source_name,source_snapshot) values('${iid}','${bid}','${issuer}','${supplier}','${property}','${num}','2026-10-28','2026-11-11','2026-02-09','2026-02-15','Synthetic customer reference',7500,1575,9075,2100,3,2500,'libfile_invoice','Synthetic issued invoice.pdf','{"issuer":"Synthetic entity"}');`;
 const rowSql=(ref,cost,billed=null,bid=batch)=>`insert into mzs_ops_historical_cost_rows(batch_id,profile_id,reporting_year,reference,iso_week,period_from,period_until,original_location,category,description,cost_cents,recharge,source_reference,source_check,source_billing_reference,invoice_id,billed_hours,recharge_cents) values('${bid}','${worker}',2026,'${ref}',7,'2026-02-09','2026-02-15','Synthetic location','Cleaning','Synthetic weekly statement',${cost},'${billed?'Ja':'Te beoordelen'}','#123','Source check','${billed?'Original invoice reference':''}',${billed?`'${invoice}'`:'null'},${billed??'null'},${billed?billed*2500:'null'});`;
 const transact=async sql=>{try{await db.exec('begin;'+sql+'set constraints all immediate;commit;');}catch(e){await db.exec('rollback;');throw e;}};
 await assert.rejects(transact(batchSql()),/Incomplete historical/);
 assert.equal((await q('select count(*)::int n from mzs_ops_historical_batches')).rows[0].n,0);
 await assert.rejects(transact(batchSql(batch,'fixture-one',3,18751)+invoiceSql()+rowSql('ROW-1',5000,2)+rowSql('ROW-2',1250,1)+rowSql('ROW-3',12500)),/source cost mismatch/);
 await assert.rejects(transact(batchSql()+invoiceSql()+rowSql('ROW-1',5000,1)+rowSql('ROW-2',1250,1)+rowSql('ROW-3',12500)),/does not reconcile/);
 await transact(batchSql()+invoiceSql()+rowSql('ROW-1',5000,2)+rowSql('ROW-2',1250,1)+rowSql('ROW-3',12500));
 await assert.rejects(q(rowSql('ROW-4',1000)),/already complete/);
 await assert.rejects(q(`update mzs_ops_historical_cost_rows set cost_cents=1`),/immutable/);
 await assert.rejects(q('delete from mzs_ops_external_sales_invoices'),/immutable/);
 for(const table of ['mzs_lease_invoices','mzs_booking_invoices']){
  await assert.rejects(q(`insert into ${table}(id,issuer_id,number) values(gen_random_uuid(),'${issuer}','ext-test-1')`),e=>e.code==='23505');
  await q(`insert into ${table}(id,issuer_id,number,issued_on,total,${table==='mzs_lease_invoices'?'contract_id':'booking_id'}) values(gen_random_uuid(),'${issuer}','${table}-NEW','2026-10-28',10,gen_random_uuid())`);
 }
 const b2='99999999-9999-4999-8999-999999999993';
 await assert.rejects(transact(batchSql(b2,'fixture-two',1,1000).replaceAll('a'.repeat(64),'b'.repeat(64))+rowSql('ROW-1',1000,null,b2)),e=>e.code==='23505');
 await assert.rejects(transact(batchSql(b2,'fixture-two',1,1000).replaceAll('a'.repeat(64),'b'.repeat(64))+invoiceSql('99999999-9999-4999-8999-999999999994','mzs_lease_invoices-NEW',b2)),e=>e.code==='23505');
 await assert.rejects(transact(batchSql(b2,'fixture-two',1,1000).replaceAll('a'.repeat(64),'b'.repeat(64))+rowSql('ROW-4',1000,null,b2).replace("'Te beoordelen'","'Ja'").replace("'Source check','','null'","'Source check','','null'").replace(',null,null,null)',`,null,1,null)`)),/check constraint/);
 await actor(worker);
 for(const table of ['mzs_ops_historical_batches','mzs_ops_historical_cost_rows','mzs_ops_external_sales_invoices'])assert.equal((await q('select * from '+table)).rows.length,0);
 await assert.rejects(q('select mzs_ops_historical_source(2026)'),/administrator/);
 await actor(admin);
 const source=(await q('select mzs_ops_historical_source(2026) s')).rows[0].s;
 assert.equal(source.rows.length,3);assert.equal(source.batches[0].person_name,'Synthetic person');assert.equal(source.invoices[0].payment_status,'not_recorded');assert.equal(source.invoices[0].delivery_status,'not_recorded');assert.equal(source.rows.reduce((n,r)=>n+r.cost_cents,0),18750);
 assert.equal((await q(`select mzs_ops_historical_source(2026,'${other}') s`)).rows[0].s.rows.length,0);
 await assert.rejects(q('select mzs_ops_historical_source(1999)'),/Invalid/);
 for(const table of ['mzs_ops_historical_batches','mzs_ops_historical_cost_rows','mzs_ops_external_sales_invoices']){
  await assert.rejects(q('delete from '+table),/permission denied/);
  await assert.rejects(q('insert into '+table+' default values'),/permission denied/);
 }
 const sales=(await q(`select mzs_ops_accountant_source('${issuer}') s`)).rows[0].s;
 assert.equal(sales.external.length,1);assert.equal(Number(sales.external[0].total),90.75);assert.equal(Number(sales.external[0].net_total),75);assert.equal(Number(sales.external[0].vat_total),15.75);assert.equal(sales.rent_receipts.length,0);assert.equal(sales.guest_receipts.length,0);
 await db.exec(`reset role;update profiles set is_active=false where id='${admin}'`);await actor(admin);await assert.rejects(q('select mzs_ops_historical_source(2026)'),/administrator/);
 await db.exec('reset role;set role anon');await assert.rejects(q('select * from mzs_ops_historical_batches'),/permission denied/);await assert.rejects(q('select mzs_ops_historical_source(2026)'),/permission denied/);
 console.log('PASS: atomic imports, exact reconciliation, cross-batch and cross-ledger duplicate denial, immutability, active-admin read isolation and external sales without invented receipts');
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
