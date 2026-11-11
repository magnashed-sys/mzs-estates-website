import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
function load(path,deps={},env={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,URL,Date,Buffer,process:{env},require:n=>deps[n]});return exports;}
const renderer=load('lib/mzs/owner-report.ts');
test('owner report escapes research content, keeps subject and supplies automated footer',()=>{
 const m=renderer.ownerReportMessage('Branding M Nashed','Research <script>alert(1)</script>\nhttps://example.com/a?q=1&b=2\njavascript:alert(1)');
 assert.equal(m.subject,'Branding M Nashed');assert.doesNotMatch(m.html,/<script>/);assert.match(m.html,/&lt;script/);
 assert.match(m.html,/href="https:\/\/example.com\/a\?q=1&amp;b=2"/);assert.doesNotMatch(m.html,/href="javascript/);
 assert.match(m.text,/geautomatiseerd bericht/);assert.match(m.html,/relatiemanager/);
 assert.throws(()=>renderer.ownerReportMessage('subject\r\nBcc: other@example.com','x'));
 assert.throws(()=>renderer.ownerReportMessage('x',' '.repeat(3)));
 assert.throws(()=>renderer.ownerReportMessage('x','x'.repeat(60001)));
});
const prodEnv={VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic',MZS_SMTP_HOST:'smtp.example.invalid',MZS_SMTP_PORT:'587',MZS_SMTP_USER:'info@mzsgroup.eu',MZS_SMTP_PASSWORD:'synthetic',MZS_SMTP_FROM:'MZS Group <info@mzsgroup.eu>'};
function fixture({env={},email='magdy@mzsgroup.eu',reject=false,saveFails=false}={}){
 let status='pending',sends=0,claims=0,lastMessage;
 const query=table=>{let update;const q={select:()=>q,eq:()=>q,update:v=>{update=v;return q;},single:async()=>({data:table==='profiles'?{is_active:true,email}:{recipient_user_id:'owner'}}),then:resolve=>{if(update&&!saveFails)status=update.status;resolve({data:saveFails?null:[{id:'report'}],error:saveFails?{}:null});}};return q;};
 const db={from:query,auth:{admin:{getUserById:async()=>({data:{user:{email,email_confirmed_at:'2026-01-01'}}})}},rpc:async()=>{claims++;if(status!=='pending')return {data:[]};status='sending';return {data:[{id:'report',subject:'Branding M Nashed',body_text:'Synthetic report',recipient:'magdy@mzsgroup.eu'}]};}};
 const mail={createTransport:()=>({sendMail:async m=>{sends++;lastMessage=m;if(reject)throw Error('ambiguous timeout');return {accepted:['magdy@mzsgroup.eu']};},close(){}})};
 const delivery=load('lib/mzs/owner-report-delivery.ts',{'@supabase/supabase-js':{createClient:()=>db},nodemailer:mail,'./owner-report':renderer},{...prodEnv,...env});
 return {run:delivery.deliverOwnerReport,state:()=>({status,sends,claims,lastMessage})};
}
test('platform sends once to fixed owner using info sender and records acceptance',async()=>{
 const f=fixture();assert.equal(await f.run(),'accepted');assert.equal(await f.run(),'none');
 const s=f.state();assert.equal(s.sends,1);assert.equal(s.lastMessage.from,'MZS Group <info@mzsgroup.eu>');assert.equal(s.lastMessage.to,'magdy@mzsgroup.eu');
});
test('SMTP ambiguity and lost recording never cause an automatic duplicate',async()=>{
 for(const opts of [{reject:true},{saveFails:true}]){const f=fixture(opts);assert.equal(await f.run(),'uncertain');assert.equal(await f.run(),'none');assert.equal(f.state().sends,1);}
});
test('preview, wrong database, changed sender and wrong recipient fail before claiming',async()=>{
 for(const [opts,result] of [[{env:{VERCEL_ENV:'preview'}},'disabled'],[{env:{NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co'}},'disabled'],[{env:{MZS_SMTP_FROM:'invitations@mzsgroup.eu'}},'sender_requires_review'],[{email:'other@example.com'},'recipient_requires_review']]){
 const f=fixture(opts);assert.equal(await f.run(),result);assert.equal(f.state().sends,0);assert.equal(f.state().claims,0);}
});
test('database report queue prevents public access, duplicates, content changes and repeat claims',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 await db.exec(readFileSync('supabase/migrations/20261111094512_owner_report_mail.sql','utf8'));
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const [a]=await q("select mzs_enqueue_owner_report('branding-m-nashed:2026-11-18','Branding M Nashed','Synthetic report') id");
 const [b]=await q("select mzs_enqueue_owner_report('branding-m-nashed:2026-11-18','Branding M Nashed','Synthetic report') id");assert.equal(a.id,b.id);
 await assert.rejects(q("select mzs_enqueue_owner_report('branding-m-nashed:2026-11-18','Branding M Nashed','Different report')"),/different content/);
 for(const role of ['anon','authenticated']){
 await db.exec(`set role ${role}`);
 await assert.rejects(q('select * from mzs_owner_report_outbox'),/permission denied/);
 await assert.rejects(q("select mzs_enqueue_owner_report('x','x','x')"),/permission denied/);
 await assert.rejects(q('select * from mzs_claim_owner_report()'),/permission denied/);await db.exec('reset role');}
 await db.exec('set role service_role');
 await assert.rejects(q("select mzs_enqueue_owner_report('x','x','x')"),/permission denied/);
 const rows=await q('select * from mzs_claim_owner_report()');assert.equal(rows.length,1);assert.equal(rows[0].status,'sending');
 assert.equal((await q('select * from mzs_claim_owner_report()')).length,0);
 await assert.rejects(q("update mzs_owner_report_outbox set body_text='changed'"),/permission denied/);
 await q("update mzs_owner_report_outbox set status='accepted',completed_at=now() where id=$1",[a.id]);
 assert.equal((await q('select * from mzs_claim_owner_report()')).length,0);
 }finally{await db.close();}
});
