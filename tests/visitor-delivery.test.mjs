import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function load(file,deps={},globals={}) {const exports={};vm.runInNewContext(ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:n=>{assert.ok(n in deps,n);return deps[n];},Date,Intl,Buffer,...globals});return exports;}
const report=load('lib/mzs/visitor-report.ts');
function harness({environment='production',role='admin',active=true,email='owner@example.invalid',claimed=false,smtp='ok',saveError=false}={}) {
 const sent=[];let claims=0;let status;let claimedState=claimed;
 const db={auth:{admin:{getUserById:async()=>({data:{user:{email,email_confirmed_at:'2026-01-01'}}})}},rpc:async()=>({data:[]}),from(table){
 let op='select';const q={select(){return q},eq(){return q},single:async()=>({data:table==='mzs_visitor_settings'?{enabled:true,recipient_user_id:'owner',started_at:'2026-10-24'}:{role,is_active:active,email}}),insert:async()=>{claims++;if(claimedState)return {error:{code:'23505'}};claimedState=true;return{};},update(v){op='update';status=v.status;return q},delete(){return q},lt:async()=>({}),then(resolve){return Promise.resolve({data:[{report_day:'2026-10-24'}],error:op==='update'&&saveError?{}:null}).then(resolve)}};return q;}};
 const nodemailer={createTransport:()=>({sendMail:async message=>{sent.push(message);if(smtp==='unknown')throw Error('socket');return {accepted:smtp==='ok'?[email]:[]}},close(){}})};
 const env={VERCEL_ENV:environment,NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic',SMTP_HOST:'example.invalid',SMTP_USER:'smtp@example.invalid',SMTP_PASSWORD:'synthetic'};
 const {deliverVisitorReport}=load('lib/mzs/visitor-delivery.ts',{'@supabase/supabase-js':{createClient:()=>db},nodemailer,'./visitor-report':report},{process:{env}});
 return {run:()=>deliverVisitorReport(new Date('2026-10-24T22:00:00Z')),sent,get status(){return status},get claims(){return claims}};
}
test('Scheduled delivery uses only the verified active admin and cannot send twice',async()=>{
 const h=harness();assert.equal(await h.run(),'accepted');assert.equal(h.sent[0].to,'owner@example.invalid');assert.match(h.sent[0].subject,/2026-10-24/);assert.equal(await h.run(),'already_claimed');assert.equal(h.sent.length,1);
});
test('Preview, inactive accounts and non-admin recipients never receive visitor reports',async()=>{
 for(const config of [{environment:'preview'},{active:false},{role:'client'}]){const h=harness(config);await h.run();assert.equal(h.sent.length,0);assert.equal(h.claims,0);}
});
test('Uncertain SMTP or database acknowledgement never triggers a duplicate send',async()=>{
 for(const config of [{smtp:'unknown'},{saveError:true}]){const h=harness(config);assert.equal(await h.run(),'uncertain');assert.equal(await h.run(),'already_claimed');assert.equal(h.sent.length,1);}
});
test('SMTP rejection is not reported as accepted',async()=>{const h=harness({smtp:'rejected'});assert.equal(await h.run(),'failed');assert.equal(h.status,'failed');});
test('Cron endpoint rejects missing/wrong secrets before dispatch',async()=>{
 let calls=0;const {GET}=load('app/api/visitor-report/route.ts',{'node:crypto':await import('node:crypto'),'next/server':{NextResponse:{json:(body,opts)=>({body,...opts})}},'../../../lib/mzs/visitor-delivery':{deliverVisitorReport:async()=>{calls++;return 'accepted'}}},{process:{env:{CRON_SECRET:'synthetic-secret'}}});
 for(const auth of ['', 'Bearer bad'])assert.equal((await GET({headers:new Headers({authorization:auth})})).status,401);
 assert.equal(calls,0);assert.equal((await GET({headers:new Headers({authorization:'Bearer synthetic-secret'})})).status,200);assert.equal(calls,1);
});
function activityHarness({signedIn=true,active=true,role='client',grant=true,offers=true}={}) {
 let recorded;
 const db={auth:{getUser:async()=>({data:{user:signedIn?{id:'actual-user'}:null}}),getClaims:async()=>({data:{claims:{session_id:'actual-session'}}})},from(table){const q={select(){return q},eq(){return q},single:async()=>({data:{role,is_active:active}}),maybeSingle:async()=>({data:table==='projects'?{id:'project'}:grant?{project_id:'project'}:null}),in:async()=>({data:offers?[{id:'offer'}]:[]}),then(resolve){return Promise.resolve({data:[{offering_id:'offer'}]}).then(resolve)}};return q;}};
 class Response {constructor(body,options){Object.assign(this,options)}}
 const {POST}=load('app/api/visitor-activity/route.ts',{'next/server':{NextResponse:Response},'@supabase/supabase-js':{createClient:()=>({rpc:async(name,args)=>{recorded=args;return{}}})},'../../../lib/supabase/server':{createClient:async()=>db},'../../../lib/mzs/visitor-report':report},{process:{env:{VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic'}}});
 return {post:(body,origin='https://www.mzsgroup.com')=>POST({headers:new Headers({origin}),nextUrl:{origin:'https://www.mzsgroup.com'},text:async()=>JSON.stringify({event_id:'22222222-2222-4222-8222-222222222222',kind:'page',path:'/private',...body})}),get recorded(){return recorded}};
}
test('Activity API rejects anonymous, inactive, cross-origin and denied project views',async()=>{
 for(const config of [{signedIn:false},{active:false},{grant:false},{offers:false}]){const h=activityHarness(config);assert.ok([401,403].includes((await h.post({path:'/private/projects/villa-la-nucia'})).status));assert.equal(h.recorded,undefined);}
 const h=activityHarness();assert.equal((await h.post({},'https://evil.invalid')).status,403);assert.equal((await h.post({path:'/private?token=secret'})).status,400);assert.equal(h.recorded,undefined);
});
test('Activity identity and session always come from verified authentication, not submitted IDs',async()=>{
 const h=activityHarness();assert.equal((await h.post({user_id:'victim',session_id:'forged'})).status,204);assert.equal(h.recorded.p_user,'actual-user');assert.equal(h.recorded.p_session,'actual-session');
 const a=activityHarness({role:'admin'});assert.equal((await a.post({})).status,204);assert.equal(a.recorded,undefined);assert.equal((await a.post({kind:'login'})).status,204);assert.equal(a.recorded.p_kind,'login');
});
