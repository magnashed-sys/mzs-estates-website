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
 await db.exec(fs.readFileSync('supabase/migrations/20261028205823_gripp_invoice_archive.sql','utf8'));
 const batch='99999999-9999-4999-8999-999999999991';
 const source=(number,net,gross,paid,open,year='2026')=>({Status:'Verzonden',Verkoopfactuur:'Synthetic client',Nummer:number,Datum:year+'-01-15',Rapportagedatum:year+'-01-14',Conceptdatum:year+'-01-13',Vervaldatum:year+'-01-28',Identiteit:'Synthetic entity',Onderwerp:number==='C-1'?'Creditfactuur van 1001':'Synthetic rent',Omschrijving:'Source only', 'Referentie klant':'Ref', 'Totaal excl. BTW':String(net),'Totaal incl. BTW':String(gross),'Totaal reeds betaald':String(paid),'Totaal openstaand':String(open),isopenstaand:open?'Ja':'Nee'});
 const records=[source('A-1',100,121,21,100),source('C-1',-10,-12.1,-12.1,0),source('ZERO',0,0,0,0,'2025')];
 const esc=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
 const batchSql=(id=batch,hash='a',count=3,gross=10890)=>`insert into mzs_invoice_archive_batches(id,issuer_id,source_system,source_name,source_file_id,source_sha256,source_columns,currency,currency_basis,expected_rows,expected_net_cents,expected_gross_cents,expected_paid_cents,expected_open_cents,authorization_reference) values('${id}','${issuer}','Gripp','Synthetic.csv','libfile_synthetic','${hash.repeat(64)}',array[${Object.keys(records[0]).map(x=>"'"+x+"'").join(',')}],'EUR','import_currency_not_in_source',${count},9000,${gross},890,10000,'Synthetic test import authorized');`;
 const rowSql=(r,n=2,id=batch)=>`insert into mzs_invoice_archive(batch_id,source_row,raw_source) values('${id}',${n},${esc(r)});`;
 const transact=async sql=>{try{await db.exec('begin;'+sql+'set constraints all immediate;commit;');}catch(e){await db.exec('rollback;');throw e;}};
 await assert.rejects(transact(batchSql()),/Incomplete/);
 await assert.rejects(transact(batchSql()+rowSql({...records[0],'Totaal excl. BTW':'100.001'})),/decimal/);
 await assert.rejects(transact(batchSql()+rowSql({...records[0],Identiteit:'Wrong entity'})),/issuer/);
 await assert.rejects(transact(batchSql()+records.map((r,n)=>rowSql(r,n+2)).join('')+rowSql(records[0],8)),/already complete/);
 await assert.rejects(transact(batchSql().replace(',9000,',',9001,')+records.map((r,n)=>rowSql(r,n+2)).join('')),/control totals/);
 await transact(batchSql()+records.map((r,n)=>rowSql(r,n+2)).join(''));
 assert.equal((await q('select count(*)::int n from mzs_invoice_archive')).rows[0].n,3);
 for(const table of ['mzs_invoice_archive','mzs_invoice_archive_batches']){await assert.rejects(q('update '+table+' set id=gen_random_uuid()'),/immutable/);await assert.rejects(q('delete from '+table),/immutable/);}
 for(const table of ['mzs_lease_invoices','mzs_booking_invoices']){
  await assert.rejects(q(`insert into ${table}(id,issuer_id,number) values(gen_random_uuid(),'${issuer}','a-1')`),e=>e.code==='23505');
  await q(`insert into ${table}(id,issuer_id,number) values(gen_random_uuid(),'${issuer}','${table}-new')`);
 }
 await assert.rejects(q(`insert into mzs_ops_external_sales_invoices(id,issuer_id,number) values(gen_random_uuid(),'${issuer}','A-1')`),e=>e.code==='23505');
 await assert.rejects(transact(batchSql('99999999-9999-4999-8999-999999999992','b')+rowSql(records[0],2,'99999999-9999-4999-8999-999999999992')),e=>e.code==='23505');
 await actor(worker);assert.equal((await q('select * from mzs_invoice_archive')).rows.length,0);await assert.rejects(q('select mzs_invoice_archive_source()'),/administrator/);
 await actor(admin);
 const report=(await q("select mzs_invoice_archive_source(2026,'','all',999,1) s")).rows[0].s;
 assert.equal(report.totals.count,2);assert.equal(report.totals.gross_cents,10890);assert.equal(report.offset,1);assert.equal(report.rows.length,1);assert.deepEqual(report.years,[2026,2025]);
 const credit=(await q("select mzs_invoice_archive_source(null,'','credit') s")).rows[0].s;assert.equal(credit.rows.length,1);assert.equal(credit.rows[0].source_credit_reference,'1001');
 assert.equal((await q("select mzs_invoice_archive_source(2026,'Synthetic client','open') s")).rows[0].s.totals.open_cents,10000);
 assert.equal((await q("select mzs_invoice_archive_source(null,'%','all') s")).rows[0].s.totals.count,0);
 for(const table of ['mzs_invoice_archive','mzs_invoice_archive_batches'])await assert.rejects(q('insert into '+table+' default values'),/permission denied/);
 await db.exec('reset role;set role anon;');await assert.rejects(q('select mzs_invoice_archive_source()'),/permission denied/);
 await db.exec(`reset role;update profiles set is_active=false where id='${admin}'`);await actor(admin);await assert.rejects(q('select mzs_invoice_archive_source()'),/administrator/);
 await db.exec(`reset role;update profiles set is_active=true where id='${admin}'`);
 await db.exec(fs.readFileSync('supabase/migrations/20261028213328_archive_customer_links.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261028214746_archive_customer_confirmations.sql','utf8'));
 const iid=(await q("select id from mzs_invoice_archive where number='A-1'")).rows[0].id;
 await assert.rejects(q(`insert into mzs_invoice_archive_customers(invoice_id,relationship_id,basis,authorization_reference) values('${iid}','${supplier}','unique_exact_name','Synthetic owner instruction')`),/names do not match/);
 await q(`insert into mzs_invoice_archive_customers(invoice_id,relationship_id,basis,authorization_reference) values('${iid}','${supplier}','owner_confirmed_name','Synthetic owner confirmed the name variant')`);
 assert.equal((await q('select relationship_name from mzs_invoice_archive_customers')).rows[0].relationship_name,'Synthetic supplier');
 await q(`insert into mzs_invoice_archive_exclusions(invoice_id,reason,authorization_reference) values('${iid}','Owner requested removing this unpaid record','Synthetic owner instruction to exclude')`);
 await actor(admin);
 const active=(await q("select mzs_invoice_archive_source(2026,'','all') s")).rows[0].s;
 assert.equal(active.totals.count,1);assert.equal(active.totals.gross_cents,-1210);assert.equal(active.totals.open_cents,0);
 const excluded=(await q("select mzs_invoice_archive_source(2026,'','excluded') s")).rows[0].s;
 assert.equal(excluded.totals.count,1);assert.equal(excluded.rows[0].id,iid);assert.equal(excluded.totals.gross_cents,12100);
 assert.equal((await q('select * from mzs_invoice_archive_active')).rows.length,2);
 assert.equal((await q('select * from mzs_invoice_archive')).rows.length,3);
 await assert.rejects(q('insert into mzs_invoice_archive_exclusions default values'),/permission denied/);
 await actor(worker);assert.equal((await q('select * from mzs_invoice_archive_active')).rows.length,0);assert.equal((await q('select * from mzs_invoice_archive_exclusions')).rows.length,0);
 await db.exec('reset role;set role anon');await assert.rejects(q('select * from mzs_invoice_archive_active'),/permission denied/);
 await db.close();console.log('Invoice archive PostgreSQL lifecycle, totals, search, pagination and RLS passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
