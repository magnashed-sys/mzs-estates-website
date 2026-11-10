import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function load(file,deps={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:n=>{assert.ok(n in deps,n);return deps[n]},Date,Intl,Buffer,...globals});return exports;}
const message=load('lib/capital/payment-reminder.ts');
const sample={instalment_id:'synthetic',deal_id:'loan',due_date:'2026-11-15',recipient_email:'borrower@example.invalid',recipient_name:'Borrower',lender:'Lender',title:'Synthetic agreement',amount:97.25,credit:2.75,locale:'en'};
function harness(options={}){
 const sent=[];let claimed=false;let outcome;let claims=0;
 const db={rpc:async(name,args)=>{
  if(name==='mzs_due_capital_reminders')return {data:['synthetic']};
  if(name==='mzs_claim_capital_reminder'){claims++;if(claimed)return {data:null};claimed=true;return {data:sample};}
  if(name==='mzs_capital_reminder_snapshot')return {data:options.cancel?null:options.changed?{...sample,amount:47.25}:sample,error:options.readError?{}:null};
  if(name==='mzs_finish_capital_reminder'){outcome=args.p_status;return {data:!options.saveError,error:options.saveError?{}:null};}
  throw Error(name);
 }};
 const nodemailer={createTransport:()=>({sendMail:async m=>{sent.push(m);if(options.smtp==='unknown')throw Error('socket');return {accepted:options.smtp==='rejected'?[]:[sample.recipient_email]};},close(){}})};
 const env={VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co',MZS_CAPITAL_REMINDERS_ENABLED:'true',MZS_CAPITAL_DEALS_ENABLED:'true',SUPABASE_SERVICE_ROLE_KEY:'synthetic',SMTP_HOST:'example.invalid',SMTP_USER:'smtp@example.invalid',SMTP_PASSWORD:'synthetic',...options.env};
 const worker=load('lib/capital/payment-reminder-delivery.ts',{'@supabase/supabase-js':{createClient:()=>db},nodemailer,'./payment-reminder':message},{process:{env}});
 return {run:worker.deliverCapitalReminders,sent,get outcome(){return outcome},get claims(){return claims}};
}
test('Friendly copy contains net balance, credit and no arrears claim; HTML escapes user fields',()=>{
 const copy=message.capitalReminderMessage(sample);assert.match(copy.text,/€97.25/);assert.match(copy.text,/€2.75/);assert.match(copy.text,/15 November 2026/);assert.match(copy.text,/already made the payment/);assert.doesNotMatch(copy.text,/overdue|penalty/i);
 const nl=message.capitalReminderMessage({...sample,locale:'nl'});assert.match(nl.text,/97,25/);
 const html=message.capitalReminderMessage({...sample,title:'<script>oops</script>'}).html;assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
 assert.throws(()=>message.capitalReminderMessage({...sample,amount:0}));
 assert.throws(()=>message.capitalReminderMessage({...sample,recipient_email:'a@example.invalid,b@example.invalid'}));
});
test('One dispatch per instalment, with durable outcome and one verified recipient',async()=>{
 const h=harness();assert.equal((await h.run()).accepted,1);assert.equal(h.sent[0].to,sample.recipient_email);assert.equal(h.outcome,'accepted');await h.run();assert.equal(h.sent.length,1);
});
test('Preparation defaults off; preview, local, wrong DB and disabled Capital never send or claim',async()=>{
 for(const env of [{MZS_CAPITAL_REMINDERS_ENABLED:undefined},{VERCEL_ENV:'preview'},{VERCEL_ENV:'development'},{NEXT_PUBLIC_SUPABASE_URL:'https://staging.invalid'},{MZS_CAPITAL_DEALS_ENABLED:'false'}]){
  const h=harness({env});assert.equal((await h.run()).status,'disabled');assert.equal(h.sent.length,0);assert.equal(h.claims,0);
 }
});
test('Payment, opt-out or recipient changes cancel before SMTP; failed snapshot read fails closed',async()=>{
 for(const options of [{cancel:true},{changed:true},{readError:true}]){const h=harness(options);await h.run();assert.equal(h.sent.length,0);assert.equal(h.outcome,options.readError?'uncertain':'cancelled');}
});
test('Uncertain SMTP or DB acknowledgement never auto-retries; rejection never reported accepted',async()=>{
 for(const options of [{smtp:'unknown'},{smtp:'rejected'},{saveError:true}]){const h=harness(options);assert.equal((await h.run()).status,'requires_review');await h.run();assert.equal(h.sent.length,1);}
});
test('Cron authenticates before dispatch and uses no-store responses',async()=>{
 let calls=0;const route=load('app/api/capital/reminders/route.ts',{'node:crypto':await import('node:crypto'),'next/server':{NextResponse:{json:(body,opts)=>({body,...opts})}},'../../../../lib/capital/payment-reminder-delivery':{deliverCapitalReminders:async()=>{calls++;return {status:'complete'}}}},{process:{env:{CRON_SECRET:'synthetic-secret'}}});
 for(const auth of ['','Bearer wrong'])assert.equal((await route.GET({headers:new Headers({authorization:auth})})).status,401);
 assert.equal(calls,0);const response=await route.GET({headers:new Headers({authorization:'Bearer synthetic-secret'})});assert.equal(response.status,200);assert.equal(response.headers['Cache-Control'],'no-store');assert.equal(calls,1);
});
