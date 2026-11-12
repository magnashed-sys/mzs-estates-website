import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('database receipts enforce scope, acceptance, transitions and access',{timeout:60000},async()=>{
 const db=new PGlite();
 try{
 await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema mzs_private;
 create table profiles(id uuid primary key,role text,is_active boolean);
 create table mzs_lease_issuers(id uuid primary key);
 create table mzs_accountancy_years(id uuid primary key);
 create table mzs_purchase_pdf_intakes(id uuid primary key,issuer_id uuid,year_id uuid,sha256 text);
 create table mzs_purchase_pdf_results(intake_id uuid,sha256 text,verdict text);
 create table mzs_purchase_pdf_decisions(intake_id uuid,action text,draft_id uuid);
 create function public.is_admin() returns boolean language sql as $$select false$$;
 grant usage on schema public,mzs_private to service_role,authenticated;
 grant select on all tables in schema public to service_role;
 `);
 await db.exec(fs.readFileSync('supabase/migrations/20261112200134_mase_mailbox_receipts.sql','utf8'));
 const issuer='11111111-1111-4111-8111-111111111111',year='22222222-2222-4222-8222-222222222222',actor='33333333-3333-4333-8333-333333333333',id='44444444-4444-4444-8444-444444444444',hash='a'.repeat(64);
 await db.exec(`insert into profiles values('${actor}','admin',true);insert into mzs_lease_issuers values('${issuer}');insert into mzs_accountancy_years values('${year}');
 insert into mzs_purchase_pdf_intakes values('${id}','${issuer}','${year}','${hash}');
 insert into mzs_purchase_pdf_results values('${id}','${hash}','clean');`);
 await db.exec('set role service_role');
 const receipt=(await db.query(`insert into mzs_mailbox_receipts(mailbox,folder,uid_validity,uid,issuer_id,year_id,source_sha256,attachments,created_by)
 values('mase@mzsgroup.eu','INBOX',11,42,$1,$2,$3,$4,$5) returning id`,[issuer,year,hash,JSON.stringify([{id,sha256:hash}]),actor])).rows[0].id;
 await assert.rejects(db.query("update mzs_mailbox_receipts set source_sha256=$1 where id=$2",['b'.repeat(64),receipt]));
 await assert.rejects(db.query("update mzs_mailbox_receipts set state='moving',move_token=gen_random_uuid() where id=$1",[receipt]));
 await db.exec('reset role');
 await db.exec(`insert into mzs_purchase_pdf_decisions values('${id}','accepted','${id}');set role service_role;`);
 const claimed=await db.query("update mzs_mailbox_receipts set state='moving',move_token=gen_random_uuid() where id=$1 and state='review' returning move_token",[receipt]);
 assert.equal(claimed.rows.length,1);
 assert.equal((await db.query("update mzs_mailbox_receipts set state='moving',move_token=gen_random_uuid() where id=$1 and state='review' returning id",[receipt])).rows.length,0);
 await db.query("update mzs_mailbox_receipts set state='uncertain' where id=$1",[receipt]);
 await assert.rejects(db.query("update mzs_mailbox_receipts set state='review',move_token=null where id=$1",[receipt]));
 await db.exec('reset role;set role authenticated;');
 assert.equal((await db.query('select * from mzs_mailbox_receipts')).rows.length,0);
 await assert.rejects(db.query("update mzs_mailbox_receipts set state='moved'"));
 await db.exec('reset role;set role anon;');
 await assert.rejects(db.query('select * from mzs_mailbox_receipts'));
 }finally{await db.close();}
});
