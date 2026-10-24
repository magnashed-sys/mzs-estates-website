import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const exports={};
vm.runInNewContext(ts.transpileModule(read('lib/mzs/visitor-report.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Intl,Date});
const {reportWindow,visitorPath,visitorReport}=exports;
test('Midnight Madrid reports a complete day across summer, winter and DST transitions',()=>{
 for(const [now,start,end,hours] of [
 ['2026-10-24T22:00:00Z','2026-10-23T22:00:00.000Z','2026-10-24T22:00:00.000Z',24],
 ['2026-10-25T23:00:00Z','2026-10-24T22:00:00.000Z','2026-10-25T23:00:00.000Z',25],
 ['2026-03-29T22:00:00Z','2026-03-28T23:00:00.000Z','2026-03-29T22:00:00.000Z',23],
 ['2026-12-31T23:00:00Z','2026-12-30T23:00:00.000Z','2026-12-31T23:00:00.000Z',24]]) {
 const w=reportWindow(new Date(now));assert.equal(w.start,start);assert.equal(w.end,end);assert.equal((Date.parse(end)-Date.parse(start))/3600000,hours);
 }
 assert.equal(reportWindow(new Date('2026-10-24T21:59:59Z')),null);
 assert.equal(reportWindow(new Date('2026-10-24T23:00:00Z')),null);
});
test('Only allowlisted pages are recorded, never tokens or arbitrary text',()=>{
 for(const path of ['/reset-password?token=secret','/private?email=x','/private#secret','/admin','//evil.com','/private/projects/a%2Fb','/api/account','/forgot-password','/private/profile/security'])assert.equal(visitorPath(path),null);
 assert.equal(visitorPath('/ar/private'),'/private');assert.equal(visitorPath('/pt-BR/real-estate'),'/real-estate');
 assert.equal(visitorPath('/private/projects/villa-la-nucia'),'/private/projects/villa-la-nucia');
});
test('Report escapes stored names and paths and explicitly states collection limits',()=>{
 const m=visitorReport('2026-10-24',[{name:'<img src=x>',email:'test@example.invalid',role:'client',kind:'page',path:'<script>x</script>',total:2,first:'2026-10-24T10:00:00Z',last:'2026-10-24T10:02:00Z'}],'2026-10-24T09:00Z');
 assert.doesNotMatch(m.html,/<img|<script/);assert.match(m.html,/&lt;img/);assert.match(m.text,/12:00–12:02/);assert.match(m.text,/geen bewijs/);
 assert.match(visitorReport('2026-10-24',[],'today').text,/Geen geregistreerde activiteit/);
});
test('Database enforces private access, disabled default, active accounts, deduplication and report claim uniqueness',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table public.profiles(id uuid primary key,full_name text,email text,role text,is_active boolean);
 grant select on public.profiles to service_role;
 insert into public.profiles values('00000000-0000-0000-0000-000000000001','Test','test@example.invalid','client',true),('00000000-0000-0000-0000-000000000002','Inactive','inactive@example.invalid','client',false);`);
 await db.exec(read('supabase/migrations/20261024210652_visitor_digest.sql'));
 const call=`select public.mzs_record_visitor_activity('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','login','/login')`;
 await db.exec('set role authenticated');await assert.rejects(db.exec(call),/permission denied/);await assert.rejects(db.exec('select * from public.mzs_visitor_activity'),/permission denied/);
 await db.exec('set role anon');await assert.rejects(db.exec('select * from public.mzs_visitor_reports'),/permission denied/);
 await db.exec('set role service_role');await db.exec(call);assert.equal((await db.query('select count(*)::int n from public.mzs_visitor_activity')).rows[0].n,0);
 await db.exec('update public.mzs_visitor_settings set enabled=true');await db.exec(call);await db.exec(call);
 await db.exec(call.replace('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'));
 assert.equal((await db.query('select count(*)::int n from public.mzs_visitor_activity')).rows[0].n,1);
 await assert.rejects(db.exec(call.replace('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')),/Active account/);
 const summary=(await db.query("select public.mzs_visitor_summary(now()-interval '1 day',now()+interval '1 minute') s")).rows[0].s;
 assert.equal(summary.length,1);assert.equal(summary[0].total,1);
 assert.deepEqual((await db.query("select public.mzs_visitor_summary(now()+interval '1 day',now()+interval '2 days') s")).rows[0].s,[]);
 const claim="insert into public.mzs_visitor_reports(report_day,recipient_user_id,status) values('2026-10-24','00000000-0000-0000-0000-000000000001','sending')";
 await db.exec(claim);await assert.rejects(db.exec(claim),/duplicate key/);
 } finally {await db.close();}
});
