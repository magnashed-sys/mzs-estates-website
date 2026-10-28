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
  'create schema auth; create schema mzs_private; create schema storage;',
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  'grant usage on schema auth to authenticated;',
  'create table public.profiles(id uuid primary key,role text,is_active boolean);',
  'create table public.mzs_lease_issuers(id uuid primary key);',
  'create table public.mzs_lease_relationships(id uuid primary key);',
  'create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);',
  'create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));',
  'alter table storage.objects enable row level security;',
  'grant usage on schema storage to authenticated;',
  'grant select,insert,delete on storage.objects to authenticated;',
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
 await db.exec("insert into public.mzs_lease_issuers values('77777777-7777-4777-8777-777777777777');");
 await db.exec("insert into public.mzs_lease_relationships values('88888888-8888-4888-8888-888888888888');");
 await db.exec(fs.readFileSync('supabase/migrations/20261028115000_mzs_ops_entity_links_staging.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261028171000_mzs_ops_staff_maintenance_staging.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261028173000_mzs_ops_secure_staff_directory_staging.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261028181000_mzs_ops_visit_reviews_maintenance_events_staging.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261028190000_mzs_ops_staff_corrections_internal_orders_staging.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261028191500_mzs_ops_ticket_photo_evidence_staging.sql','utf8'));
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
 await actor(worker);
 assert.equal((await q('select count(*)::int as n from mzs_ops_staff_property_directory')).rows[0].n,0);
 await assert.rejects(visit(),/row-level security|not granted|permission denied/i);
 await assert.rejects(ticket(),/row-level security|not assigned|permission denied/i);
 await assert.rejects(assigned(),/permission denied|Administrator required|row-level security/i);
 await actor(admin);
 const scope=(await assigned()).rows[0].id;assert.ok(scope);
 await assert.rejects(assigned(),/already has this state/);
 await actor(worker);
 const directory=(await q('select id,name,address from mzs_ops_staff_property_directory')).rows;
 assert.equal(directory.length,1);
 assert.equal(directory[0].id,property);
 assert.equal((await q('select count(*)::int as n from mzs_ops_staff_unit_directory')).rows[0].n,1);
 assert.equal((await q('select count(*)::int as n from mzs_estate_properties')).rows[0].n,0);
 assert.equal((await q('select count(*)::int as n from mzs_estate_units')).rows[0].n,0);
 const v=(await visit()).rows[0].id;
 const t=(await ticket()).rows[0].id;
 assert.ok(v&&t);
 const v2=(await visit()).rows[0].id;
 const corr=(await q("insert into mzs_ops_visit_correction_requests(visit_id,proposed_minutes,reason) values('"+
  v2+"',30,'Original 45 minutes was incorrect; revised to thirty') returning id")).rows[0].id;
 const path=t+"/99999999-9999-4999-8999-999999999999.jpg";
 await db.exec('reset role');
 await q("insert into storage.objects(bucket_id,name) values('mzs-ops-ticket-photos','"+path+"')");
 await actor(worker);
 const photo=(await q("insert into mzs_ops_maintenance_photos(ticket_id,storage_path,mime_type,sha256,byte_size) values('"+
  t+"','"+path+"','image/jpeg','"+ 'a'.repeat(64)+"',200) returning id")).rows[0].id;
 assert.ok(photo);
 await assert.rejects(q("update mzs_ops_maintenance_photos set byte_size=3 where id='"+photo+"'"),/permission denied/);
 await actor(other);
 assert.equal((await q('select count(*)::int as n from mzs_ops_maintenance_photos')).rows[0].n,0);
 await actor(admin);
 await assert.rejects(q("insert into mzs_ops_visit_reviews(visit_id,decision,reason,recharge_class) values('"+
  v2+"','approved','Requires correction review','not_billable')"),/Pending staff correction/);
 await q("insert into mzs_ops_visit_correction_decisions(correction_id,decision,reason) values('"+
  corr+"','approved','Source record corrected after staff confirmation')");
 const corrected=(await q("insert into mzs_ops_visit_reviews(visit_id,decision,reason,recharge_class,minimum_minutes,increment_minutes) values('"+
  v2+"','approved','Approved corrected snapshot','review_candidate',0,15) returning billable_minutes")).rows[0];
 assert.equal(corrected.billable_minutes,30);
 assert.equal((await q("select actual_minutes from mzs_ops_staff_visits where id='"+v2+"'")).rows[0].actual_minutes,45);
 await actor(worker);

 await assert.rejects(visit(otherProperty,null),/not granted|row-level security|permission denied/i);
 await assert.rejects(ticket(otherProperty,null),/not assigned|row-level security|permission denied/i);
 await assert.rejects(visit(otherProperty,unit),/not granted|row-level security|permission denied/i);
 await assert.rejects(visit(property,'77777777-7777-4777-8777-777777777777'),/Unit is not part/);
 await assert.rejects(q("update mzs_ops_staff_visits set actual_minutes=300 where id='"+v+"'"),/permission denied/);
 await assert.rejects(q("delete from mzs_ops_maintenance_tickets where id='"+t+"'"),/permission denied/);

 // Group Admin review is exclusive; the original 45 actual minutes are immutable.
 await actor(worker);
 await assert.rejects(q("insert into public.mzs_ops_visit_reviews(visit_id,decision,reason,recharge_class) values('"+v+"','approved','Worker may not self approve','not_billable')"),/permission denied|row-level security|Only active Group Administrator/i);
 await assert.rejects(q("insert into public.mzs_ops_maintenance_events(ticket_id,action,note) values('"+t+"','triaged','Worker cannot triage')"),/permission denied|row-level security|Only Group Administrator/i);
 await actor(admin);
 const review=(await q("insert into public.mzs_ops_visit_reviews(visit_id,decision,reason,recharge_class,minimum_minutes,increment_minutes) values('"+v+"','approved','Verified original visit and client rounding instruction','review_candidate',60,60) returning id,billable_minutes")).rows[0];
 assert.equal(review.billable_minutes,60);
 assert.equal((await q("select actual_minutes from mzs_ops_staff_visits where id='"+v+"'")).rows[0].actual_minutes,45);
 await assert.rejects(q("insert into public.mzs_ops_visit_reviews(visit_id,decision,reason,recharge_class) values('"+v+"','rejected','Attempt second review','not_billable')"),/already reviewed|duplicate key/i);
 await assert.rejects(q("update public.mzs_ops_visit_reviews set billable_minutes=45 where id='"+review.id+"'"),/permission denied/);
 await assert.rejects(q("insert into public.mzs_ops_maintenance_events(ticket_id,action,note) values('"+t+"','resolved','Skipping mandatory initial triage')"),/Invalid maintenance state transition/);
 const event=(action,note)=>q("insert into public.mzs_ops_maintenance_events(ticket_id,action,note) values('"+t+"','"+action+"','"+note+"') returning id,sequence_no");
 await event("triaged","Administrator reviewed reported issue");
 await q("insert into mzs_ops_property_entity_links(property_id,legal_entity_id,relationship_type,effective_from,evidence_reference) values('"+
  property+"','77777777-7777-4777-8777-777777777777','payer','2026-01-01','Verified synthetic funding source for test')");
 const wo=(await q("insert into mzs_ops_maintenance_work_orders(ticket_id,legal_entity_id,supplier_relationship_id,scope_of_work,quotation_reference,approved_budget_net_cents,approved_budget_vat_cents) values('"+
  t+"','77777777-7777-4777-8777-777777777777','88888888-8888-4888-8888-888888888888','Repair damaged kitchen tap','SYN-Q1',10000,2100) returning id")).rows[0].id;
 await q("insert into mzs_ops_maintenance_work_order_decisions(work_order_id,decision,reason) values('"+
  wo+"','authorized_internally','Budget approved internally, no external order')");
 await assert.rejects(q("delete from mzs_ops_maintenance_work_orders where id='"+wo+"'"),/permission denied/);

 await event("scheduled","Maintenance is planned, no supplier commitment");
 await event("in_progress","Internal progress verified by property manager");
 await event("resolved","Reported issue resolved after inspection");
 await assert.rejects(event("scheduled","Cannot schedule after resolved"),/Invalid maintenance state transition/);
 await event("reopened","Follow-up inspection found the issue recurring");
 await event("resolved","Second inspection confirmed resolution");
 await event("closed","Ticket closed after verified confirmation");
 await assert.rejects(event("reopened","Cannot reopen after final close"),/Invalid maintenance state transition/);
 await actor(worker);
 assert.equal((await q("select count(*)::int as n from public.mzs_ops_maintenance_events")).rows[0].n,7);
 assert.equal((await q("select count(*)::int as n from public.mzs_ops_visit_reviews")).rows[0].n,0);

 await actor(other);
 assert.equal((await q('select count(*)::int as n from mzs_ops_staff_visits')).rows[0].n,0);
 assert.equal((await q('select count(*)::int as n from mzs_ops_maintenance_tickets')).rows[0].n,0);
 assert.equal((await q('select count(*)::int as n from mzs_ops_staff_property_directory')).rows[0].n,0);
 await actor(admin);
 assert.equal((await q('select count(*)::int as n from mzs_ops_staff_visits')).rows[0].n,2);
 assert.equal((await q('select count(*)::int as n from mzs_ops_maintenance_tickets')).rows[0].n,1);
 await assigned(property,'revoke');
 await assert.rejects(assigned(property,'revoke'),/already has this state/);
 await actor(worker);
 assert.equal((await q('select count(*)::int as n from mzs_ops_staff_property_directory')).rows[0].n,0);
 assert.equal((await q('select count(*)::int as n from mzs_ops_staff_visits')).rows[0].n,0);
 await assert.rejects(visit(),/not granted|row-level security|permission denied/i);
 await db.exec('reset role');
 const result=(await q("select relname,relrowsecurity from pg_class where relname like 'mzs_ops_staff_%' or relname='mzs_ops_maintenance_tickets'")).rows;
 assert.ok(result.filter(x=>['mzs_ops_staff_visits','mzs_ops_staff_scope_events','mzs_ops_maintenance_tickets'].includes(x.relname)).every(x=>x.relrowsecurity));
 console.log('Staff visit approval, candidate billing, maintenance lifecycle and scope isolation passed');
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
