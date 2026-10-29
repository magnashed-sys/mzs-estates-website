const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
 const db=new PGlite(),uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const admin=uuid(1),client=uuid(2),issuer=uuid(3),draft=uuid(5),year=uuid(6),payment=uuid(7);
 await db.exec([
  'create role anon;create role authenticated;create role service_role;',
  'create schema auth;create schema mzs_private;',
  "create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
  'grant usage on schema auth to authenticated;',
  'create table public.profiles(id uuid primary key,role text,is_active boolean);',
  "insert into public.profiles values('"+admin+"','admin',true),('"+client+"','client',true);",
  "create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active)$$;",
  'create table public.mzs_lease_issuers(id uuid primary key);',
  'create table public.mzs_ops_expense_drafts(id uuid primary key,legal_entity_id uuid,status text,currency text,gross_cents bigint,invoice_date date);',
  'create table public.mzs_accountancy_years(id uuid primary key,issuer_id uuid,fiscal_year integer);',
  'create table public.mzs_accountancy_cost_reviews(draft_id uuid primary key,year_id uuid,review_status text);',
  "insert into public.mzs_lease_issuers values('"+issuer+"');",
  "insert into public.mzs_ops_expense_drafts values('"+draft+"','"+issuer+"','draft','EUR',10000,date '2026-10-05');",
  "insert into public.mzs_accountancy_years values('"+year+"','"+issuer+"',2026);",
  "insert into public.mzs_accountancy_cost_reviews values('"+draft+"','"+year+"','pending');",
  'alter table public.mzs_ops_expense_drafts enable row level security;',
  'alter table public.mzs_accountancy_cost_reviews enable row level security;',
  'alter table public.mzs_accountancy_years enable row level security;',
  'grant select on public.mzs_ops_expense_drafts,public.mzs_accountancy_cost_reviews,public.mzs_accountancy_years to authenticated;',
  'create policy admin_drafts on public.mzs_ops_expense_drafts for select to authenticated using(public.is_admin());',
  'create policy admin_years on public.mzs_accountancy_years for select to authenticated using(public.is_admin());',
  'create policy admin_reviews on public.mzs_accountancy_cost_reviews for select to authenticated using(public.is_admin());'
 ].join('\n'));
 await db.exec(fs.readFileSync('supabase/migrations/20261029211000_supplier_payment_ledger_staging.sql','utf8'));
 const actor=async id=>db.exec("reset role;set role authenticated;select set_config('request.jwt.claim.sub','"+id+"',false);");
 const record=(id,amount,reference='BANK-REFERENCE-1')=>db.query(
  'select public.mzs_record_supplier_payment($1,$2,$3,$4,$5) v',[id,draft,amount,'2026-10-20',reference]);
 const reverse=(id,reason='Duplicate supplier payment registration')=>db.query(
  'select public.mzs_reverse_supplier_payment($1,$2,$3) v',[id,draft,reason]);
 await actor(admin);
 await assert.rejects(record(payment,4000),/reviewed first/);
 await db.exec("reset role;update public.mzs_accountancy_cost_reviews set review_status='reviewed';");
 await actor(admin);
 await record(payment,4000);await record(payment,4000);
 assert.equal((await db.query('select count(*)::int n from public.mzs_accountancy_supplier_payments')).rows[0].n,1);
 await assert.rejects(record(payment,4500),/different payment details/);
 await assert.rejects(record(uuid(8),1000,'bank-reference-1'),/active payment/);
 await assert.rejects(record(uuid(8),6001,'BANK-REFERENCE-2'),/exceeds remaining/);
 await record(uuid(8),6000,'BANK-REFERENCE-2');
 await assert.rejects(record(uuid(9),1,'BANK-REFERENCE-3'),/exceeds remaining/);
 const before=await db.query('select public.mzs_supplier_payment_source(array[$1::uuid]) as source',[draft]);
 assert.equal(before.rows[0].source.count,2);
 assert.equal(before.rows[0].source.rows.filter(x=>!x.reversed_at).reduce((sum,x)=>sum+x.amount_cents,0),10000);
 await reverse(payment);await reverse(payment);
 await assert.rejects(reverse(payment,'Another incorrect reversal reason'),/Already reversed/);
 await assert.rejects(record(payment,4000),/was reversed/);
 await record(uuid(9),4000,'BANK-REFERENCE-1');
 const after=await db.query('select public.mzs_supplier_payment_source(array[$1::uuid]) as source',[draft]);
 assert.equal(after.rows[0].source.count,3);
 assert.equal(after.rows[0].source.rows.filter(x=>!x.reversed_at).reduce((sum,x)=>sum+x.amount_cents,0),10000);
 assert.equal(after.rows[0].source.rows.filter(x=>x.reversed_at).length,1);
 await assert.rejects(db.query('delete from public.mzs_accountancy_supplier_payments'),/permission denied/);
 await assert.rejects(db.query('update public.mzs_accountancy_supplier_payments set amount_cents=1'),/permission denied/);
 await actor(client);
 assert.equal((await db.query('select count(*)::int n from public.mzs_accountancy_supplier_payments')).rows[0].n,0);
 await assert.rejects(record(uuid(10),1000,'BANK-C'),/administrator/);
 await assert.rejects(reverse(uuid(8)),/administrator/);
 await db.exec('reset role;set role anon');
 await assert.rejects(record(uuid(10),1000,'BANK-D'),/permission denied/);
 await db.exec('reset role');
 await assert.rejects(db.query('delete from public.mzs_accountancy_supplier_payments'),/immutable/);
 await assert.rejects(db.query('delete from public.mzs_accountancy_supplier_payment_reversals'),/immutable/);
 await db.close();
 console.log('Supplier payment ledger: RLS, admin, review gate, idempotency, cents cap, partial payments, correction and immutable audit passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
