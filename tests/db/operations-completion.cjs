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
 const denied=/permission denied|row-level security|Admin|administrator|access denied/i;
 await actor(admin);await assigned();await actor(worker);const t=(await ticket()).rows[0].id;
 const order=()=>q(`insert into mzs_ops_maintenance_work_orders(ticket_id,legal_entity_id,supplier_relationship_id,scope_of_work,quotation_reference,approved_budget_net_cents,approved_budget_vat_cents) values('${t}','${issuer}','${supplier}','Repair the synthetic leaking pipe','TEST-QUOTE-1',10000,2100) returning id`);
 await assert.rejects(order(),denied);await actor(admin);await assert.rejects(order(),/triaged/);
 await q(`insert into mzs_ops_maintenance_events(ticket_id,action,note) values('${t}','triaged','Synthetic issue assessed')`);
 await assert.rejects(order(),/paying entity/);
 await db.exec(`reset role;insert into mzs_ops_property_entity_links(property_id,legal_entity_id,relationship_type,effective_from) values('${property}','${issuer}','payer',current_date);`);await actor(admin);
 const o=(await order()).rows[0].id;
 const decide=(decision,expected=null)=>q(`insert into mzs_ops_maintenance_work_order_decisions(work_order_id,decision,reason,expected_decision_id) values('${o}','${decision}','Synthetic budget decision',${expected?`'${expected}'`:'null'}) returning id`);
 await assert.rejects(decide('cancelled'),/already decided/);
 const d=(await decide('authorized_internally')).rows[0].id;
 await assert.rejects(decide('authorized_internally'),/Stale/);
 await actor(worker);assert.equal((await q('select * from mzs_ops_current_work_orders')).rows.length,0);await assert.rejects(decide('cancelled',d),denied);
 await actor(admin);await decide('cancelled',d);
 assert.equal((await q(`select decision from mzs_ops_current_work_orders where id='${o}'`)).rows[0].decision,'cancelled');
 await assert.rejects(q(`update mzs_ops_maintenance_work_orders set approved_budget_net_cents=1 where id='${o}'`),denied);
 // Registered photos enforce owner, ticket, bytes, max count, current assignment, and hold.
 const object=async(n,owner=worker)=>{const path=`${t}/99999999-9999-4999-8999-${String(n).padStart(12,'0')}.jpg`;await q(`insert into storage.objects(bucket_id,name,owner_id,metadata) values('mzs-ops-ticket-photos','${path}','${owner}','{"size":100,"mimetype":"image/jpeg"}')`);return path;};
 const register=async(path,size=100)=>(await q(`insert into mzs_ops_maintenance_photos(ticket_id,storage_path,mime_type,sha256,byte_size) values('${t}','${path}','image/jpeg','${'a'.repeat(64)}',${size}) returning id`)).rows[0].id;
 await actor(other);await assert.rejects(object(9,other),denied);
 await actor(worker);const p1=await object(1);await assert.rejects(register(p1,99),/metadata mismatch/);const photo=await register(p1);
 await assert.rejects(q(`delete from mzs_ops_maintenance_photos where id='${photo}'`),denied);
 assert.equal((await q(`select * from storage.objects where name='${p1}'`)).rows.length,1);
 await q(`delete from storage.objects where name='${p1}'`);assert.equal((await q(`select * from storage.objects where name='${p1}'`)).rows.length,1);
 const p2=await object(2);await register(p2);const p3=await object(3);await register(p3);await assert.rejects(object(4),denied);
 await actor(admin);await q(`insert into mzs_ops_maintenance_photo_holds(photo_id,reason) values('${photo}','Synthetic sensitive content hold')`);assert.equal((await q(`select * from storage.objects where name='${p1}'`)).rows.length,0);
 await actor(worker);assert.equal((await q(`select * from mzs_ops_maintenance_photos where id='${photo}'`)).rows.length,0);
 await q(`delete from storage.objects where name='${p1}'`);await db.exec('reset role');assert.equal((await q(`select * from storage.objects where name='${p1}'`)).rows.length,1);
 await actor(admin);await assigned(property,'revoke');await actor(worker);assert.equal((await q('select * from storage.objects')).rows.length,0);await assert.rejects(q(`select mzs_ops_accountant_source('${issuer}')`),denied);
 await actor(admin);const exported=(await q(`select mzs_ops_accountant_source('${issuer}') as x`)).rows[0].x;assert.equal(exported.issuer.id,issuer);assert.deepEqual(exported.leases,[]);
 await db.exec('reset role;set role anon');await assert.rejects(q(`select mzs_ops_accountant_source('${issuer}')`),denied);await assert.rejects(q('select * from mzs_ops_maintenance_photos'),denied);
 console.log('PASS work order authorization/cancellation/staleness, photo upload cap, metadata ownership, holds, cleanup, revocation, admin-only export snapshot');await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
