import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('closed owner-stay deletion enforces permissions, state and atomic audit',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema auth;
 create function auth.uid() returns uuid language sql as $$
  select nullif(current_setting('test.uid',true),'')::uuid $$;
 create function public.is_admin() returns boolean language sql as $$
  select current_setting('test.admin',true)='true' $$;
 grant usage on schema auth to authenticated;
 create table public.profiles(id uuid primary key);
 create table public.rental_bookings(id uuid primary key);
 create table public.mzs_owner_stay_requests(
  id uuid primary key, status text not null, booking_id uuid references public.rental_bookings,
  check_in date not null,check_out date not null,notes text);
 insert into profiles values('10000000-0000-0000-0000-000000000001');
 insert into rental_bookings values('20000000-0000-0000-0000-000000000001');
 insert into mzs_owner_stay_requests values
 ('30000000-0000-0000-0000-000000000001','declined',null,'2026-11-12','2026-11-15','fixture');
 `);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261027154702_owner_stay_cleanup.sql',import.meta.url),'utf8'));
 const call=(status='declined',reason='Duplicate request',date='2026-11-12')=>db.query(
  "select mzs_admin_delete_closed_owner_stay('30000000-0000-0000-0000-000000000001',$1,$2,$3,'2026-11-15') as ok",
  [reason,status,date]);
 await assert.rejects(call(),/Administrator access required/);
 await db.exec("set test.uid='10000000-0000-0000-0000-000000000001'; set test.admin='false'; set role authenticated");
 await assert.rejects(call(),/Administrator access required/);
 await db.exec("set test.admin='true'");
 await assert.rejects(call('declined','bad'),/Provide a reason/);
 await assert.rejects(call('cancelled'),/Request changed/);
 await assert.rejects(call('declined','Duplicate request','2026-11-13'),/Request changed/);
 await db.exec("reset role; update mzs_owner_stay_requests set status='requested'; set role authenticated");
 await assert.rejects(call('requested'),/Only closed requests/);
 await db.exec("reset role; update mzs_owner_stay_requests set status='confirmed'; set role authenticated");
 await assert.rejects(call('confirmed'),/Only closed requests/);
 await db.exec("reset role; update mzs_owner_stay_requests set status='cancelled',booking_id='20000000-0000-0000-0000-000000000001'; set role authenticated");
 await assert.rejects(call('cancelled'),/Only closed requests/);
 await db.exec("reset role; update mzs_owner_stay_requests set status='declined',booking_id=null; set role authenticated");
 assert.equal((await db.query("select count(*)::int as n from mzs_owner_stay_cleanup_audit")).rows[0].n,0);
 assert.equal((await call()).rows[0].ok,true);
 await assert.rejects(call(),/already removed/);
 const audit=(await db.query("select reason,snapshot->>'notes' as notes from mzs_owner_stay_cleanup_audit")).rows;
 assert.deepEqual(audit,[{reason:'Duplicate request',notes:'fixture'}]);
 await assert.rejects(db.exec("delete from mzs_owner_stay_cleanup_audit"),/permission denied/);
 await db.exec("set test.admin='false'");
 assert.equal((await db.query("select count(*)::int as n from mzs_owner_stay_cleanup_audit")).rows[0].n,0);
 await db.exec("reset role");
 assert.equal((await db.query("select count(*)::int as n from rental_bookings")).rows[0].n,1);
 assert.equal((await db.query("select count(*)::int as n from mzs_owner_stay_requests")).rows[0].n,0);
 assert.equal((await db.query("select has_function_privilege('anon','mzs_admin_delete_closed_owner_stay(uuid,text,text,date,date)','EXECUTE') as ok")).rows[0].ok,false);
 }finally{await db.close();}
});
