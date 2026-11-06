import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('application writes require the registration trigger or trusted service while admin review remains available',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create table access_requests(id int primary key,status text default 'pending');
   alter table access_requests enable row level security;
   grant select,insert,update,delete on access_requests to anon,authenticated,service_role;
   create policy access_requests_public_insert on access_requests for insert to anon,authenticated with check(status='pending');
   create policy admin_read on access_requests for select to authenticated using(current_setting('app.admin',true)='yes');
   create policy admin_update on access_requests for update to authenticated using(current_setting('app.admin',true)='yes') with check(current_setting('app.admin',true)='yes');
   create table auth_users(id int primary key);
   create function register_application() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.access_requests(id) values(new.id);return new;end$$;
   create trigger register_application after insert on auth_users for each row execute function register_application();`);
  await db.exec(readFileSync('supabase/migrations/20261106152607_restrict_access_request_writes.sql','utf8'));
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`);
   await assert.rejects(db.query('insert into access_requests(id) values(1)'),/permission denied/);
   await db.exec('reset role');
  }
  await db.exec('insert into auth_users values(2);set role service_role;insert into access_requests(id) values(3);reset role;set role authenticated');
  assert.equal((await db.query('select * from access_requests')).rows.length,0);
  await db.exec("select set_config('app.admin','yes',false)");
  assert.equal((await db.query('select * from access_requests')).rows.length,2);
  assert.equal((await db.query("update access_requests set status='approved' where id=2 returning status")).rows[0].status,'approved');
 }finally{await db.close();}
});
