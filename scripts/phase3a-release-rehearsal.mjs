// Local PostgreSQL (PGlite) only. No network/database credentials accepted.
// PGLITE_MODULE must point to an installed @electric-sql/pglite module entry.
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const root = resolve(import.meta.dirname, '..');
const read = p => readFile(resolve(root,p),'utf8');
const releaseDir = 'supabase/releases/phase3a';
const releaseName = (await readdir(resolve(root,releaseDir))).find(x=>x.endsWith('_phase3a_core_release.sql'));
const migration = await read(`${releaseDir}/${releaseName}`);
const baseline = await read('tests/fixtures/phase3a-release-baseline.sql');
const capital = await read('supabase/migrations/20261016_mzs_capital_requests.sql');
const db = new PGlite();
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0];
const results=[];
const pass = name => {results.push(name); console.log(`PASS ${name}`);};
try {
 await db.exec(baseline+capital);
 await db.exec('grant all on public.mzs_capital_requests to service_role;');
 const beforePolicy = await scalar("select jsonb_agg(to_jsonb(p)) from pg_policies p where tablename in ('profiles','mzs_capital_requests')");
 await assert.rejects(db.exec(migration), /acknowledgement required/);
 await db.exec('rollback;');
 assert.equal(await scalar("select to_regclass('public.mzs_admin_scope_assignments')"),null);
 pass('missing acknowledgement rejects installation');
 await db.exec("set mzs.phase3a_release_authorized='ptrnjzmcehrhbsfxntgw';");
 // A forced failure at the end must roll back all preceding DDL.
 await assert.rejects(db.exec(migration.replace(/commit;\s*$/i,()=>"DO $$ BEGIN RAISE EXCEPTION 'forced install failure'; END $$; commit;")),/forced install failure/);
 await db.exec('rollback;');
 assert.equal(await scalar("select to_regclass('public.mzs_admin_scope_assignments')"),null);
 assert.equal(await scalar("select to_regprocedure('public.mzs_capital_admin_update_request(uuid,text)')"),null);
 pass('mid-install failure rolls back schema and functions');
 await db.exec(migration);
 pass('atomic core migration installs from empty Phase 3A baseline');
 assert.equal(await scalar("select count(*)::int from pg_proc where proname like 'mzs_phase3a_pilot_%'"),0);
 assert.equal(await scalar('select count(*)::int from public.mzs_admin_scope_assignments'),0);
 assert.deepEqual(await scalar("select jsonb_agg(to_jsonb(p)) from pg_policies p where tablename in ('profiles','mzs_capital_requests')"),beforePolicy);
 pass('no pilot, no initial grants, existing policies unchanged');
 for (const role of ['anon','service_role']) {
   assert.equal(await scalar(`select has_function_privilege('${role}','public.mzs_capital_admin_update_request(uuid,text)','EXECUTE')`),false);
 }
 pass('anonymous and service-role RPC execution denied');
 for (const test of ['phase3a_scoped_roles_staging.sql','phase3a_capital_scopes_staging.sql']) {
  await db.exec(await read(`supabase/tests/${test}`));
  pass(test);
 }
 assert.equal(await scalar('select count(*)::int from auth.users'),0);
 pass('role test fixtures rolled back');
 await assert.rejects(db.exec(migration),/already exist/);
 await db.exec('rollback;');
 pass('repeat installation fails closed');
 // Persist fictitious records only in this local in-memory engine, to verify
 // emergency containment preserves requests, assignments and audit history.
 await db.exec(`insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000001','group@example.invalid'),
 ('00000000-0000-4000-8000-000000000002','capital@example.invalid');
 update public.profiles set is_active=true;
 update public.profiles set role='admin' where id='00000000-0000-4000-8000-000000000001';
 insert into public.mzs_capital_requests(id,user_id,request_type,amount_eur,explanation)
 values('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','capital',100,'Synthetic rollback preservation request');
 set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
 set role authenticated;
 select public.mzs_set_admin_department_scope('00000000-0000-4000-8000-000000000002','capital',true);
 set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
 select public.mzs_capital_admin_update_request('00000000-0000-4000-8000-000000000003','in_review');
 reset role;`);
 const snapshot = async()=>scalar(`select jsonb_build_object(
 'requests',(select jsonb_agg(to_jsonb(t)) from public.mzs_capital_requests t),
 'scopes',(select jsonb_agg(to_jsonb(t)) from public.mzs_admin_scope_assignments t),
 'scope_audit',(select jsonb_agg(to_jsonb(t)) from public.mzs_admin_scope_audit t),
 'request_audit',(select jsonb_agg(to_jsonb(t)) from public.mzs_capital_request_admin_audit t))`);
 const before=await snapshot();
 await db.exec(await read(`${releaseDir}/disable-phase3a.sql`));
 assert.deepEqual(await snapshot(),before);
 for (const role of ['anon','authenticated','service_role']) {
  for (const sig of ['mzs_has_department_scope(text)','mzs_set_admin_department_scope(uuid,text,boolean)','mzs_capital_admin_list_requests()','mzs_capital_admin_update_request(uuid,text)']) {
   assert.equal(await scalar(`select has_function_privilege('${role}','public.${sig}','EXECUTE')`),false);
  }
 }
 await db.exec('set role authenticated;');
 await assert.rejects(db.exec('select public.mzs_capital_admin_list_requests();'),/permission denied/);
 await db.exec('reset role;');
 pass('emergency containment blocks actual RPC calls and preserves all data');
 // The old server API uses service-role writes after its Group Admin check.
 await db.exec("set role service_role; update public.mzs_capital_requests set status='contacted' where id='00000000-0000-4000-8000-000000000003'; reset role;");
 assert.equal(await scalar("select status from public.mzs_capital_requests where id='00000000-0000-4000-8000-000000000003'"),'contacted');
 pass('legacy service-role database update remains available after containment');
 console.log(JSON.stringify({engine:'PGlite',tests:results.length,limitations:'Minimal relevant schema; Auth is a test double. No live HTTP, backup restore, concurrent sessions or Vercel rollback tested.'}));
} finally {await db.close();}
