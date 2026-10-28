const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require(process.env.MZS_PGLITE_MODULE||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 const admin='11111111-1111-4111-8111-111111111111',client='11111111-1111-4111-8111-111111111112',
 inactive='11111111-1111-4111-8111-111111111113',property='22222222-2222-4222-8222-222222222222',
 issuer='33333333-3333-4333-8333-333333333333';
 await db.exec([
  'create role anon;create role authenticated;create role service_role;',
  'create schema auth;create schema mzs_private;',
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  'grant usage on schema auth to authenticated;',
  'create table public.profiles(id uuid primary key,role text,is_active boolean);',
  "insert into public.profiles values ('"+admin+"','admin',true),('"+client+"','client',true),('"+inactive+"','admin',false);",
  "create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) $$;",
  'create table public.mzs_estate_properties(id uuid primary key);',
  'create table public.mzs_lease_issuers(id uuid primary key);',
  "insert into public.mzs_estate_properties values('"+property+"');",
  "insert into public.mzs_lease_issuers values('"+issuer+"');"
 ].join('\n'));
 const source=fs.readFileSync('supabase/migrations/20261028115000_mzs_ops_entity_links_staging.sql','utf8');
 await db.exec(source);
 const q=(s)=>db.query(s);
 const tables=(await q("select relname,relrowsecurity from pg_class where relname like 'mzs_ops_property_entity_link%' and relkind='r'")).rows;
 assert.equal(tables.length,2);
 assert.ok(tables.every(t=>t.relrowsecurity===true));
 await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','"+admin+"',false);");
 const insert=(date,evidence)=>{
   return q("insert into public.mzs_ops_property_entity_links "+
     "(property_id,legal_entity_id,relationship_type,effective_from,evidence_reference) "+
     "values('"+property+"','"+issuer+"','payer','"+date+"','"+evidence+"') returning id");
 };
 const result=await insert('2026-10-28','Verified by administrator on source paperwork');
 assert.equal(result.rows.length,1);
 const id=result.rows[0].id;
 assert.equal((await q("select count(*)::integer as n from public.mzs_ops_property_entity_link_audit where link_id='"+id+"'")).rows[0].n,1);
 await assert.rejects(insert('2026-10-28','Same attribution'),/duplicate key/);
 await assert.rejects(insert('2026-10-29',''),/violates check constraint/);
 await assert.rejects(q("update public.mzs_ops_property_entity_links set effective_from='2026-10-30' where id='"+id+"'"),/permission denied/);
 await assert.rejects(q("delete from public.mzs_ops_property_entity_links where id='"+id+"'"),/permission denied/);
 await assert.rejects(q("insert into public.mzs_ops_property_entity_link_audit (link_id,actor_id,action,new_record) values('"+id+"','"+admin+"','INSERT','{}')"),/permission denied/);
 await db.exec("select set_config('request.jwt.claim.sub','"+client+"',false);");
 assert.equal((await q('select count(*)::integer as n from public.mzs_ops_property_entity_links')).rows[0].n,0);
 await assert.rejects(insert('2026-11-01','Client fake evidence'),/row-level security|permission denied|Invalid verified/i);
 await db.exec("select set_config('request.jwt.claim.sub','"+inactive+"',false);");
 assert.equal((await q('select count(*)::integer as n from public.mzs_ops_property_entity_links')).rows[0].n,0);
 await assert.rejects(insert('2026-11-01','Inactive admin fake evidence'),/row-level security|permission denied|Invalid verified/i);
 await db.exec('reset role;');
 assert.equal((await q('select count(*)::integer as n from public.mzs_ops_property_entity_links')).rows[0].n,1);
 console.log('MZS operations legal attribution migration: read/write/audit role checks passed');
 await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
