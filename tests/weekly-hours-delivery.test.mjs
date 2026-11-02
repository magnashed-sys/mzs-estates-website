import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function load(file,deps={},globals={}) {const exports={};vm.runInNewContext(ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:n=>{assert.ok(n in deps,n);return deps[n];},Date,Intl,Buffer,...globals});return exports;}
const visitor=load('lib/mzs/visitor-report.ts');
const report=load('lib/mzs/weekly-hours-report.ts',{'./visitor-report':visitor});
function harness({environment='production',role='admin',active=true,email='magdy@mzsgroup.eu',claimed=false,smtp='ok',saveError=false}={}) {
 const sent=[];let claims=0;let status;let claimedState=claimed;
 const db={auth:{admin:{getUserById:async()=>({data:{user:{email,email_confirmed_at:'2026-01-01'}}})}},rpc:async()=>({data:[]}),from(table){
 let op='select';const q={select(){return q},eq(){return q},single:async()=>({data:table==='mzs_weekly_hours_settings'?{enabled:true,recipient_user_id:'owner',first_week:'2026-10-26'}:{role,is_active:active,email}}),insert:async()=>{claims++;if(claimedState)return {error:{code:'23505'}};claimedState=true;return{};},update(v){op='update';status=v.status;return q},delete(){return q},lt:async()=>({}),then(resolve){return Promise.resolve({data:[{week_start:'2026-10-26'}],error:op==='update'&&saveError?{}:null}).then(resolve)}};return q;}};
 const nodemailer={createTransport:()=>({sendMail:async message=>{sent.push(message);if(smtp==='unknown')throw Error('socket');return {accepted:smtp==='ok'?[email]:[]}},close(){}})};
 const env={VERCEL_ENV:environment,NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic',SMTP_HOST:'example.invalid',SMTP_USER:'smtp@example.invalid',SMTP_PASSWORD:'synthetic'};
 const {deliverWeeklyHoursReport}=load('lib/mzs/weekly-hours-delivery.ts',{'@supabase/supabase-js':{createClient:()=>db},nodemailer,'./weekly-hours-report':report},{process:{env}});
 return {run:()=>deliverWeeklyHoursReport(new Date('2026-11-02T06:00:00Z')),sent,get status(){return status},get claims(){return claims}};
}
test('Scheduled delivery uses only the verified owner-selected mailbox and cannot send twice',async()=>{
 const h=harness();assert.equal(await h.run(),'accepted');assert.equal(h.sent[0].to,'magdy@mzsgroup.eu');assert.match(h.sent[0].subject,/2026-10-26/);assert.equal(await h.run(),'already_claimed');assert.equal(h.sent.length,1);
});
test('Preview, inactive accounts and other recipients never receive visitor reports',async()=>{
 for(const config of [{environment:'preview'},{active:false},{email:'other@example.invalid'}]){const h=harness(config);await h.run();assert.equal(h.sent.length,0);assert.equal(h.claims,0);}
});
test('Uncertain SMTP or database acknowledgement never triggers a duplicate send',async()=>{
 for(const config of [{smtp:'unknown'},{saveError:true}]){const h=harness(config);assert.equal(await h.run(),'uncertain');assert.equal(await h.run(),'already_claimed');assert.equal(h.sent.length,1);}
});
test('SMTP rejection is not reported as accepted',async()=>{const h=harness({smtp:'rejected'});assert.equal(await h.run(),'failed');assert.equal(h.status,'failed');});
test('Cron endpoint rejects missing/wrong secrets before dispatch',async()=>{
 let calls=0;const {GET}=load('app/api/weekly-hours-report/route.ts',{'node:crypto':await import('node:crypto'),'next/server':{NextResponse:{json:(body,opts)=>({body,...opts})}},'../../../lib/mzs/weekly-hours-delivery':{deliverWeeklyHoursReport:async()=>{calls++;return 'accepted'}}},{process:{env:{CRON_SECRET:'synthetic-secret'}}});
 for(const auth of ['', 'Bearer bad'])assert.equal((await GET({headers:new Headers({authorization:auth})})).status,401);
 assert.equal(calls,0);assert.equal((await GET({headers:new Headers({authorization:'Bearer synthetic-secret'})})).status,200);assert.equal(calls,1);
});
