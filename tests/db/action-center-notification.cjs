const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 const admin='11111111-1111-4111-8111-111111111111',client='11111111-1111-4111-8111-111111111112',inactive='11111111-1111-4111-8111-111111111113';
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema mzs_private;
 grant usage on schema auth,mzs_private to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table profiles(id uuid primary key,role text,is_active boolean);
 insert into profiles values('${admin}','admin',true),('${client}','client',true),('${inactive}','admin',false);
 create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active)$$;
 create table public.mzs_mail_outbox(id bigint generated always as identity,status text,payload jsonb);
 alter table public.mzs_mail_outbox enable row level security;
 insert into mzs_mail_outbox(status,payload) select 'failed','{"recipient":"private@example.invalid"}'::jsonb from generate_series(1,1201);
 insert into mzs_mail_outbox(status,payload) values('sent','{}'),('pending','{}'),('sending','{}');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261112091913_action_center_notification_count.sql','utf8'));
 const original=(await db.query('select * from mzs_mail_outbox order by id')).rows;
 for(const role of ['anon','service_role']){
  await db.exec(`set role ${role}`);
  await assert.rejects(db.query('select public.mzs_failed_notification_count()'),/permission denied/);
  await db.exec('reset role');
 }
 await db.exec('set role authenticated');
 for(const id of ['',client,inactive]){
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  for(const fn of ['public.mzs_failed_notification_count','mzs_private.failed_notification_count'])await assert.rejects(db.query(`select ${fn}()`),/Active administrator required/);
 }
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
 const result=await db.query('select public.mzs_failed_notification_count() as count');
 assert.deepEqual(result.rows,[{count:1201}]);
 for(const sql of ['select id from mzs_mail_outbox','select payload from mzs_mail_outbox',"update mzs_mail_outbox set status='sent'",'delete from mzs_mail_outbox'])await assert.rejects(db.query(sql),/permission denied/);
 await db.exec('reset role');
 assert.deepEqual((await db.query('select * from mzs_mail_outbox order by id')).rows,original);
 await db.exec("update profiles set is_active=false where id='"+admin+"';set role authenticated");
 await assert.rejects(db.query('select public.mzs_failed_notification_count()'),/Active administrator required/);
 await db.exec('reset role');
 await db.exec("update profiles set is_active=true where id='"+admin+"';delete from mzs_mail_outbox where status='failed';set role authenticated");
 assert.equal((await db.query('select public.mzs_failed_notification_count() as count')).rows[0].count,0);
 await db.close();
 console.log('Notification aggregate permissions, full counts, revocation and unchanged outbox verified');
})().catch(e=>{console.error(e);process.exit(1)});
