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
 const denied=/permission denied|row-level security|Admin required|not granted|not assigned|access denied/i;
 await actor(worker);
 await assert.rejects(visit(),denied);
 assert.equal((await q('select * from mzs_ops_staff_property_directory')).rows.length,0);
 await actor(admin);await assigned();
 await actor(worker);
 assert.equal((await q('select * from mzs_ops_staff_property_directory')).rows.length,1);
 assert.equal((await q('select * from mzs_estate_properties')).rows.length,0);
 assert.equal((await q('select * from mzs_estate_units')).rows.length,0);
 await assert.rejects(visit(otherProperty,null),denied);
 await assert.rejects(visit(property,otherProperty),/Unit is not part/);
 const v=(await visit()).rows[0].id,t=(await ticket()).rows[0].id;
 const current=async()=>(await q(`select * from mzs_ops_current_visits where id='${v}'`)).rows[0];
 const review=(revision=null,decision='approved')=>q(`insert into mzs_ops_visit_reviews(visit_id,correction_id,decision,reason,recharge_class,minimum_minutes,increment_minutes) values('${v}',${revision?`'${revision}'`:'null'},'${decision}','Reviewed by supervisor','${decision==='approved'?'review_candidate':'not_billable'}',${decision==='approved'?'60,30':'null,null'}) returning *`);
 const correction=async n=>(await q(`insert into mzs_ops_visit_correction_requests(visit_id,proposed_minutes,reason) values('${v}',${n},'Correct actual time in this synthetic visit') returning id`)).rows[0].id;
 const decide=(id,decision='approved')=>q(`insert into mzs_ops_visit_correction_decisions(correction_id,decision,reason) values('${id}','${decision}','Verified time correction')`);
 await assert.rejects(review(),denied);
 await assert.rejects(q(`update mzs_ops_staff_visits set actual_minutes=99 where id='${v}'`),denied);
 await actor(admin);
 let reviewed=(await review()).rows[0];assert.equal(reviewed.reviewed_minutes,45);assert.equal(reviewed.billable_minutes,60);
 await assert.rejects(review(),/already reviewed/);
 await actor(worker);
 assert.equal((await current()).review_decision,'approved');
 assert.equal((await q('select * from mzs_ops_visit_reviews')).rows.length,0);
 const safe=(await q('select * from mzs_ops_staff_review_status')).rows[0];assert.equal(safe.reviewed_minutes,45);assert.ok(!('billable_minutes' in safe));
 const c=await correction(71);
 await assert.rejects(correction(80),/pending correction/);
 await assert.rejects(decide(c),denied);
 await actor(admin);
 await assert.rejects(review(),/Pending correction/);
 assert.equal(Number((await q(`select approved_minutes from mzs_ops_property_work_summary where property_id='${property}'`)).rows[0].approved_minutes),0);
 await decide(c);
 assert.equal((await current()).review_decision,null);
 await assert.rejects(review(),/Stale review/);
 reviewed=(await review(c)).rows[0];assert.equal(reviewed.reviewed_minutes,71);assert.equal(reviewed.billable_minutes,90);
 await assert.rejects(decide(c),/already decided/);
 assert.equal((await current()).actual_minutes,45);
 assert.equal(Number((await q(`select approved_minutes from mzs_ops_property_work_summary where property_id='${property}'`)).rows[0].approved_minutes),71);
 await actor(worker);const rejected=await correction(100);
 await actor(admin);await decide(rejected,'rejected');assert.equal((await current()).effective_minutes,71);assert.equal((await current()).review_decision,'approved');
 await actor(worker);const third=await correction(80);
 await actor(admin);await decide(third);await review(third,'rejected');
 await actor(worker);assert.equal((await current()).review_decision,'rejected');const fourth=await correction(81);
 await actor(admin);await decide(fourth);await review(fourth);
 const progress=(action,person=null,date=null)=>q(`insert into mzs_ops_maintenance_events(ticket_id,action,note,responsible_profile_id,scheduled_for,expected_event_id) values('${t}','${action}','Synthetic maintenance update',${person?`'${person}'`:'null'},${date?`'${date}'`:'null'},(select latest_event_id from mzs_ops_current_tickets where id='${t}'))`);
 await assert.rejects(progress('closed'),/Invalid maintenance transition/);
 await progress('triaged');
 await assert.rejects(q(`insert into mzs_ops_maintenance_events(ticket_id,action,note) values('${t}','triaged','Stale maintenance form')`),/Stale maintenance/);
 await assert.rejects(progress('scheduled'),/Responsible person/);
 await assert.rejects(progress('scheduled',worker),/Planned date/);
 const date=new Date().toISOString().slice(0,10);
 await assert.rejects(progress('scheduled',other,date),/active property scope/);
 await progress('scheduled',worker,date);
 await progress('scheduled',worker,date);
 await progress('in_progress',worker,date);
 await progress('resolved',worker,date);
 await progress('closed',worker,date);
 await progress('reopened',worker,date);
 assert.equal((await q(`select status from mzs_ops_current_tickets where id='${t}'`)).rows[0].status,'reopened');
 await actor(other);
 for(const table of ['mzs_ops_staff_property_directory','mzs_ops_current_visits','mzs_ops_staff_review_status','mzs_ops_current_tickets','mzs_ops_maintenance_events','mzs_ops_visit_correction_requests','mzs_ops_visit_correction_decisions','mzs_ops_property_work_summary'])assert.equal((await q('select * from '+table)).rows.length,0,table);
 await actor(worker);assert.ok((await q('select * from mzs_ops_maintenance_events')).rows.length>0);await assert.rejects(progress('triaged'),denied);
 await actor(admin);await assigned(property,'revoke');
 await actor(worker);assert.equal((await current()),undefined);assert.equal((await q('select * from mzs_ops_staff_review_status')).rows.length,0);assert.equal((await q('select * from mzs_ops_current_tickets')).rows.length,0);await assert.rejects(correction(99),denied);
 await db.exec('reset role');
 const rights=(await q("select relname,relrowsecurity,has_table_privilege('anon',oid,'SELECT') anon_read,has_table_privilege('authenticated',oid,'UPDATE') can_update,has_table_privilege('authenticated',oid,'DELETE') can_delete from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'mzs_ops_%' and relname<>'mzs_ops_expense_drafts'")).rows;
 assert.equal(rights.length,7);assert.ok(rights.every(r=>r.relrowsecurity&&!r.anon_read&&!r.can_update&&!r.can_delete));
 await db.exec('set role anon');await assert.rejects(q('select * from mzs_ops_current_visits'),denied);
 console.log('PASS: scope isolation, original immutability, post-review corrections, stale and duplicate reviews, safe staff outcomes, separate rounding, summary invalidation, scheduling transitions, revocation and anonymous denial');
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
