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
 await db.exec("alter table public.profiles add full_name text; update public.profiles set full_name='Synthetic person';");
 await db.exec(fs.readFileSync('supabase/migrations/20261028193507_staff_time_report.sql','utf8'));
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

 const denied=/permission denied|Active administrator required/i;
 const rpc=(args='current_date,current_date')=>q(`select mzs_ops_staff_time_report(${args}) report`);
 await actor(admin);await assigned();await assigned(otherProperty);
 await q(`insert into mzs_ops_staff_scope_events(profile_id,property_id,action,reason) values('${other}','${otherProperty}','grant','Synthetic scope for other worker')`);
 await actor(worker);
 const ids=[];for(let i=0;i<4;i++)ids.push((await visit()).rows[0].id);
 await visit(otherProperty,null);
 await actor(other);await visit(otherProperty,null);
 const review=(id,decision='approved',correction=null)=>q(`insert into mzs_ops_visit_reviews(visit_id,correction_id,decision,reason,recharge_class) values('${id}',${correction?`'${correction}'`:'null'},'${decision}','Synthetic supervisor review','not_billable')`);
 await actor(admin);await review(ids[1]);await review(ids[3],'rejected');
 await actor(worker);
 await q(`insert into mzs_ops_visit_correction_requests(visit_id,proposed_minutes,reason) values('${ids[1]}',60,'Synthetic pending time correction')`);
 const c=(await q(`insert into mzs_ops_visit_correction_requests(visit_id,proposed_minutes,reason) values('${ids[2]}',71,'Synthetic accepted time correction') returning id`)).rows[0].id;
 await actor(admin);await q(`insert into mzs_ops_visit_correction_decisions(correction_id,decision,reason) values('${c}','approved','Verified synthetic minutes')`);await review(ids[2],'approved',c);
 const report=(await rpc()).rows[0].report;
 assert.equal(report.record_count,6);assert.equal(report.visits.reduce((n,v)=>n+v.actual_minutes,0),270);assert.equal(report.visits.reduce((n,v)=>n+v.effective_minutes,0),296);
 const pending=report.visits.find(v=>v.id===ids[1]);assert.equal(pending.correction_pending,true);assert.equal(pending.review_decision,'approved');assert.equal(pending.effective_minutes,45);
 const corrected=report.visits.find(v=>v.id===ids[2]);assert.equal(corrected.actual_minutes,45);assert.equal(corrected.effective_minutes,71);assert.equal(corrected.review_decision,'approved');
 for(const p of report.properties)assert.deepEqual(Object.keys(p).sort(),['id','name']);for(const p of report.people)assert.deepEqual(Object.keys(p).sort(),['full_name','id']);
 assert.equal((await rpc(`current_date,current_date,'${property}','${worker}'`)).rows[0].report.record_count,4);
 assert.equal((await rpc(`current_date,current_date,'${otherProperty}','${other}'`)).rows[0].report.record_count,1);
 assert.equal((await rpc(`current_date,current_date,'${property}','${other}'`)).rows[0].report.record_count,0);
 assert.equal((await rpc(`date '2024-01-01',date '2024-12-31'`)).rows[0].report.record_count,0);
 for(const args of ["null,current_date","current_date,current_date-1","date '2024-01-01',date '2025-01-01'","date '1999-01-01',date '1999-01-02'","date '2099-12-31',date '2100-01-01'",`current_date,current_date,'99999999-9999-4999-8999-999999999999'`,`current_date,current_date,null,'99999999-9999-4999-8999-999999999999'`])await assert.rejects(rpc(args),e=>e.code==='22023');
 for(const who of [worker,other,'']){await actor(who);await assert.rejects(rpc(),denied);}
 await db.exec(`reset role;update profiles set is_active=false where id='${admin}'`);await actor(admin);await assert.rejects(rpc(),denied);
 await db.exec(`reset role;update profiles set is_active=true where id='${admin}'`);
 const rights=(await q("select prosecdef,provolatile,has_function_privilege('anon',oid,'EXECUTE') anonymous,has_function_privilege('service_role',oid,'EXECUTE') service from pg_proc where proname='mzs_ops_staff_time_report'")).rows[0];
 assert.deepEqual(rights,{prosecdef:false,provolatile:'s',anonymous:false,service:false});
 await db.exec('set role anon');await assert.rejects(rpc(),denied);
 // Synthetic capacity fixture only in this disposable PGlite database.
 await db.exec(`reset role;alter table mzs_ops_staff_visits disable trigger user;insert into mzs_ops_staff_visits(profile_id,property_id,worked_on,actual_minutes,task_category,description) select '${worker}','${property}',current_date,45,'cleaning','Synthetic volume fixture' from generate_series(1,10001);alter table mzs_ops_staff_visits enable trigger user;`);
 await actor(admin);await assert.rejects(rpc(),e=>e.code==='54000');assert.equal((await rpc(`current_date,current_date,'${otherProperty}'`)).rows[0].report.record_count,2);
 console.log('PASS: exact snapshots, original/corrected minutes, filters, bounded periods/capacity, minimal directories and active-admin-only invoker RPC');
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
