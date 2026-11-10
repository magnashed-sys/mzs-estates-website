import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
const migration = readFileSync('supabase/migrations/20261110203307_capital_payment_reminders.sql','utf8');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
async function fixture() {
 const db = new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''test.uid'',true),'''')::uuid';
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table profiles(id uuid primary key,full_name text,email text,role text,is_active bool);
 grant select on profiles to authenticated; grant usage on schema auth to authenticated;
 create table mzs_capital_deals(id uuid primary key,title text,direction text,lender text,status text,currency text);
 create table mzs_capital_instalments(id uuid primary key,deal_id uuid,kind text,due_date date,amount numeric);
 create table mzs_capital_payments(instalment_id uuid,amount numeric,is_void bool);
 create table mzs_capital_client_access(deal_id uuid,user_id uuid,party_role text,is_active bool);
 insert into profiles values('${id(1)}','Administrator','admin@example.invalid','admin',true),('${id(2)}','Borrower','borrower@example.invalid','client',true);
 insert into auth.users values('${id(2)}','borrower@example.invalid',now());
 insert into mzs_capital_deals values('${id(10)}','Synthetic agreement','provided','Lender','agreed','EUR');
 insert into mzs_capital_client_access values('${id(10)}','${id(2)}','borrower',true);
 insert into mzs_capital_instalments values
 ('${id(11)}','${id(10)}','interest',(now() at time zone 'Europe/Madrid')::date-55,300),
 ('${id(12)}','${id(10)}','interest',(now() at time zone 'Europe/Madrid')::date-25,100),
 ('${id(13)}','${id(10)}','interest',(now() at time zone 'Europe/Madrid')::date+5,100),
 ('${id(14)}','${id(10)}','interest',(now() at time zone 'Europe/Madrid')::date+35,100),
 ('${id(15)}','${id(10)}','principal',(now() at time zone 'Europe/Madrid')::date+5,1000);
 insert into mzs_capital_payments values('${id(11)}',299.5,false),('${id(12)}',103.25,false),('${id(12)}',100,true);`);
 await db.exec(migration);
 await db.exec(`insert into mzs_capital_reminder_settings(deal_id,recipient_user_id,recipient_email,first_due_date,authorized_by)
 values('${id(10)}','${id(2)}','borrower@example.invalid',(now() at time zone 'Europe/Madrid')::date,'${id(1)}');`);
 return db;
}
const snapshot = async db => (await db.query(`select mzs_capital_reminder_snapshot('${id(13)}') as s`)).rows[0].s;
const enable = db => db.exec('update mzs_capital_reminder_settings set enabled=true');

test('Disabled default; exact five-day remaining interest accounts for earlier shortfall and void receipt', async()=>{
 const db=await fixture();try {
  assert.equal(await snapshot(db),null);
  await enable(db);
  const s=await snapshot(db);assert.equal(s.amount,97.25);assert.equal(s.credit,2.75);
  assert.equal(s.recipient_email,'borrower@example.invalid');
  const due=(await db.query('select mzs_due_capital_reminders() as id')).rows;assert.deepEqual(due.map(r=>r.id),[id(13)]);
  const claim=(await db.query(`select mzs_claim_capital_reminder('${id(13)}') as s`)).rows[0].s;
  assert.equal(claim.amount,97.25);
  assert.equal((await db.query(`select mzs_claim_capital_reminder('${id(13)}') as s`)).rows[0].s,null);
  assert.equal((await db.query('select mzs_due_capital_reminders()')).rows.length,0);
  await db.exec(`insert into mzs_capital_payments values('${id(13)}',97.25,false)`);
  assert.equal(await snapshot(db),null);
  assert.equal((await db.query(`select mzs_finish_capital_reminder('${id(13)}','cancelled') as ok`)).rows[0].ok,true);
  assert.equal((await db.query(`select mzs_finish_capital_reminder('${id(13)}','accepted') as ok`)).rows[0].ok,false);
 } finally {await db.close();}
});

test('No advance mail for paid, same-day, overdue, distant, received or completed loans and no principal/fee mail',async()=>{
 const db=await fixture();try {
  await enable(db);
  for(const offset of [-1,0,6]) {
   await db.exec(`update mzs_capital_instalments set due_date=(now() at time zone 'Europe/Madrid')::date+${offset} where id='${id(13)}'`);
   assert.equal(await snapshot(db),null);
  }
  for(const offset of [1,4,5]){
   await db.exec(`update mzs_capital_instalments set due_date=(now() at time zone 'Europe/Madrid')::date+${offset} where id='${id(13)}'`);
   assert.equal((await snapshot(db)).amount,97.25);
  }
  for(const update of ["direction='received'","status='completed'","status='draft'"]){
   await db.exec('update mzs_capital_deals set '+update);assert.equal(await snapshot(db),null);
   await db.exec("update mzs_capital_deals set direction='provided',status='active'");
  }
  for(const kind of ['principal','fee']){
   await db.exec(`update mzs_capital_instalments set kind='${kind}' where id='${id(13)}'`);assert.equal(await snapshot(db),null);
  }
 }finally{await db.close();}
});

test('Changed recipient, inactive admin/borrower, unconfirmed Auth email and revoked borrower grant all suppress mail',async()=>{
 const db=await fixture();try {
  await enable(db);
  const mutations=[
   "update profiles set email='changed@example.invalid' where role='client'",
   "update auth.users set email='changed@example.invalid'",
   'update auth.users set email_confirmed_at=null',
   'update profiles set is_active=false',
   "update profiles set role='partner' where role='admin'",
   'update mzs_capital_client_access set is_active=false',
   "update mzs_capital_client_access set party_role='lender'",
  ];
  for(const mutation of mutations){await db.exec('begin');await db.exec(mutation);assert.equal(await snapshot(db),null,mutation);await db.exec('rollback');}
 }finally{await db.close();}
});

test('Only service role can dispatch; client cannot read snapshots or opt in; active admin read only',async()=>{
 const db=await fixture();try {
  await enable(db);await db.query(`select mzs_claim_capital_reminder('${id(13)}')`);
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role};set test.uid='${id(2)}'`);
   await assert.rejects(db.query(`select mzs_claim_capital_reminder('${id(13)}')`),/permission denied/);
   await assert.rejects(db.query(`select mzs_capital_reminder_snapshot('${id(13)}')`),/permission denied/);
   await assert.rejects(db.query('select mzs_due_capital_reminders()'),/permission denied/);
   await assert.rejects(db.exec('update mzs_capital_reminder_settings set enabled=true'),/permission denied/);
   if(role==='authenticated')assert.equal((await db.query('select * from mzs_capital_reminder_deliveries')).rows.length,0);
   await db.exec('reset role');
  }
  await db.exec(`set role authenticated;set test.uid='${id(1)}'`);
  assert.equal((await db.query('select * from mzs_capital_reminder_deliveries')).rows.length,1);
  await db.exec('reset role;set role service_role');
  assert.equal((await db.query(`select mzs_finish_capital_reminder('${id(13)}','uncertain') as ok`)).rows[0].ok,true);
  await assert.rejects(db.exec('delete from mzs_capital_reminder_deliveries'),/permission denied/);
 }finally{await db.close();}
});
