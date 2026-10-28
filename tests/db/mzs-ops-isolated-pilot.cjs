const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require(process.env.MZS_PGLITE_MODULE||'@electric-sql/pglite');

(async()=>{
 const db=new PGlite();
 const admin='11111111-1111-4111-8111-111111111111';
 const staff='22222222-2222-4222-8222-222222222222';
 const other='33333333-3333-4333-8333-333333333333';
 const inactive='66666666-6666-4666-8666-666666666666';
 const property='44444444-4444-4444-8444-444444444444';
 const otherProperty='55555555-5555-4555-8555-555555555555';
 const sql=fs.readFileSync('supabase/plans/20261028_mzs_ops_isolated_pilot_v1_review_only.sql','utf8');
 await db.exec([
  'create role anon;create role authenticated;create role service_role;',
  'create schema auth;create schema mzs_private;',
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  'grant usage on schema auth to authenticated;',
  'create table public.profiles(id uuid primary key,role text,is_active boolean);',
  "insert into public.profiles values('"+admin+"','admin',true),('"+staff+"','client',true),('"+other+"','partner',true),('"+inactive+"','client',false);",
  "create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) $$;",
  'create table public.mzs_estate_properties(id uuid primary key,name text,address text,owner_name text,private_note text);',
  "insert into public.mzs_estate_properties values('"+property+"','Safe Building','Street A','PRIVATE OWNER','HIDDEN FINANCE'),('"+otherProperty+"','Other Building','Street B','PRIVATE OWNER','OTHER PRIVATE NOTES');",
  'alter table public.profiles enable row level security;',
  'grant select on public.profiles to authenticated;',
  'create policy pilot_profiles_admin_read on public.profiles for select to authenticated using((select public.is_admin()));',
  'create policy pilot_profiles_self_read on public.profiles for select to authenticated using(id=auth.uid());',
  'alter table public.mzs_estate_properties enable row level security;',
  'grant select on public.mzs_estate_properties to authenticated;',
  'create policy pilot_properties_admin_read on public.mzs_estate_properties for select to authenticated using((select public.is_admin()));',
  'create table public.mzs_lease_contracts(id uuid primary key);',
  'create table public.mzs_booking_invoices(id uuid primary key);',
  'create table public.mzs_capital_payments(id uuid primary key);'
 ].join('\n'));
 await db.exec(sql);
 const query=s=>db.query(s);
 const actor=async id=>{
  await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");
 };
 const adminInsertRun=async(p=property)=>(
  await query("insert into public.mzs_ops_pilot_runs(property_id,purpose) values('"+p+"','Synthetic test for one explicitly scoped property') returning id")
 ).rows[0].id;
 const runEvent=async(run,action)=>query("insert into public.mzs_ops_pilot_run_events(run_id,action,reason) values('"+
  run+"','"+action+"','Reviewed synthetic pilot stage decision')");
 const scope=async(run,person,action)=>query("insert into public.mzs_ops_pilot_access_events(run_id,profile_id,action,reason) values('"+
  run+"','"+person+"','"+action+"','Verified synthetic staffing permission')");
 const visit=async(run,p=property)=>query("insert into public.mzs_ops_pilot_visits(run_id,property_id,worked_on,actual_minutes,description) values('"+
  run+"','"+p+"',current_date,45,'Synthetic 45 minute cleaning visit') returning id");
 const ticket=async(run,p=property)=>query("insert into public.mzs_ops_pilot_tickets(run_id,property_id,priority,title,description) values('"+
  run+"','"+p+"','soon','Test light','Synthetic test of stairway lighting') returning id");
 await actor(staff);
 assert.equal((await query('select count(*)::int as n from public.mzs_ops_pilot_my_properties')).rows[0].n,0);
 await assert.rejects(query("insert into public.mzs_ops_pilot_runs(property_id,purpose) values('"+property+"','Unauthorised run creation for test')"),/permission denied|row-level security|Administrator/i);
 await actor(admin);
 const run=await adminInsertRun();
 const second=await adminInsertRun();
 assert.ok(run&&second);
 await assert.rejects(scope(run,staff,'grant'),/Enabled run/i);
 await actor(staff);
 await assert.rejects(visit(run),/row-level security|permission denied|assignment/i);
 await assert.rejects(ticket(run),/row-level security|permission denied|assignment/i);
 assert.equal((await query('select count(*)::int as n from public.mzs_ops_pilot_my_properties')).rows[0].n,0);
 await actor(admin);
 await runEvent(run,'activate');
 await assert.rejects(runEvent(second,'activate'),/Another pilot is active/i);
 await assert.rejects(scope(run,inactive,'grant'),/active client\/partner/i);
 await scope(run,staff,'grant');
 await assert.rejects(scope(run,staff,'grant'),/already has this state/i);
 await actor(staff);
 const labels=(await query('select property_name,property_address from public.mzs_ops_pilot_my_properties')).rows;
 assert.equal(labels.length,1);
 assert.equal(labels[0].property_name,'Safe Building');
 assert.equal((await query('select count(*)::int as n from public.mzs_estate_properties')).rows[0].n,0);
 const vi=(await visit(run)).rows[0].id;
 const ti=(await ticket(run)).rows[0].id;
 assert.ok(vi&&ti);
 await assert.rejects(visit(run,otherProperty),/property mismatch|row-level security|permission denied/i);
 await assert.rejects(ticket(run,otherProperty),/property mismatch|row-level security|permission denied/i);
 await assert.rejects(query("update public.mzs_ops_pilot_visits set actual_minutes=120 where id='"+vi+"'"),/permission denied/i);
 await assert.rejects(query("delete from public.mzs_ops_pilot_tickets where id='"+ti+"'"),/permission denied/i);
 await actor(other);
 assert.equal((await query('select count(*)::int as n from public.mzs_ops_pilot_my_properties')).rows[0].n,0);
 assert.equal((await query('select count(*)::int as n from public.mzs_ops_pilot_visits')).rows[0].n,0);
 assert.equal((await query('select count(*)::int as n from public.mzs_ops_pilot_tickets')).rows[0].n,0);
 await assert.rejects(visit(run),/row-level security|permission denied|assignment/i);
 await actor(admin);
 assert.equal((await query('select count(*)::int as n from public.mzs_ops_pilot_visits')).rows[0].n,1);
 assert.equal((await query('select count(*)::int as n from public.mzs_ops_pilot_tickets')).rows[0].n,1);
 await scope(run,staff,'revoke');
 await actor(staff);
 assert.equal((await query('select count(*)::int as n from public.mzs_ops_pilot_my_properties')).rows[0].n,0);
 assert.equal((await query('select count(*)::int as n from public.mzs_ops_pilot_visits')).rows[0].n,0);
 await assert.rejects(visit(run),/row-level security|permission denied|assignment/i);
 await actor(admin);
 await scope(run,staff,'grant');
 await runEvent(run,'deactivate');
 await assert.rejects(runEvent(run,'activate'),/activate only once/i);
 await actor(staff);
 assert.equal((await query('select count(*)::int as n from public.mzs_ops_pilot_my_properties')).rows[0].n,0);
 assert.equal((await query('select count(*)::int as n from public.mzs_ops_pilot_visits')).rows[0].n,0);
 await assert.rejects(ticket(run),/row-level security|permission denied|assignment/i);
 await actor(admin);
 await scope(run,staff,'revoke');
 assert.equal((await query('select count(*)::int as n from public.mzs_ops_pilot_visits')).rows[0].n,1);
 const tableNames=['mzs_ops_pilot_runs','mzs_ops_pilot_run_events','mzs_ops_pilot_access_events','mzs_ops_pilot_visits','mzs_ops_pilot_tickets'];
 const rights=(await query("select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT') as anonymous_read,has_table_privilege('authenticated',c.oid,'UPDATE') as can_update,has_table_privilege('authenticated',c.oid,'DELETE') as can_delete from pg_class c where c.relname like 'mzs_ops_pilot_%' and c.relkind='r'")).rows;
 assert.equal(rights.length,tableNames.length);
 assert.ok(rights.every(x=>x.relrowsecurity&&!x.anonymous_read&&!x.can_update&&!x.can_delete));
 // Fixture's legacy tables deliberately grant NO authenticated read: inspect as test superuser.
 await db.exec('reset role');
 assert.equal((await query('select count(*)::int as n from public.mzs_lease_contracts')).rows[0].n,0);
 assert.equal((await query('select count(*)::int as n from public.mzs_booking_invoices')).rows[0].n,0);
 assert.equal((await query('select count(*)::int as n from public.mzs_capital_payments')).rows[0].n,0);
 await db.close();
 console.log('Pilot default-off, narrow RLS, property labels, cross-tenant isolation, terminal stop and no financial writes verified');
})().catch(e=>{console.error(e);process.exitCode=1});
