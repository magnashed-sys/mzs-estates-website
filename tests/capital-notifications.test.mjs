import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/mzs/notifications.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function harness({grant=true,preview=false,accepted=true,intro=false,admin=true}={}) {
 const sent=[],updates=[];
 const event={id:'event',user_id:'user',event_type:intro?'intro_call_requested':'capital_access_granted',payload:{grant_id:'grant',revision:2,amount:'SECRET_AMOUNT',project:'SECRET_NAME'},attempts:1};
 const db={rpc:async()=>({data:[event]}),from(table){
  const q={select(){return q},eq(){return q},update(value){updates.push({table,value});return q},
   single:async()=>({data:{full_name:'Client',email:'client@example.invalid',is_active:true,role:intro&&admin?'admin':'client'}}),
   maybeSingle:async()=>({data:grant?{id:'grant'}:null}),then(resolve){resolve({error:null})}};return q;
 }};
 const exports={};
 vm.runInNewContext(js,{exports,console:{error(){}},process:{env:{VERCEL_ENV:preview?'preview':'production',NEXT_PUBLIC_SUPABASE_URL:preview?'https://senonkpxdtlhyhrubicg.supabase.co':'https://ptrnjzmcehrhbsfxntgw.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'mock',MZS_SMTP_HOST:'mock',MZS_SMTP_USER:'mock',MZS_SMTP_PASSWORD:'mock',MZS_SMTP_FROM:'mock@example.invalid'}},require(name){
  if(name==='@supabase/supabase-js')return {createClient:()=>db};
  if(name==='nodemailer')return {default:{createTransport:()=>({sendMail:async(message)=>{sent.push(message);return {accepted:accepted?['client@example.invalid']:[]}},close(){}})}};
  throw new Error(name);
 }});
 return {exports,sent,updates};
}
test('Capital notification verifies current grant and sends only a secure generic link',async()=>{
 const h=harness();assert.equal((await h.exports.deliverOnce()).status,'sent');assert.equal(h.sent.length,1);
 assert.equal(h.sent[0].to,'client@example.invalid');assert.match(h.sent[0].text,/https:\/\/www.mzsgroup.com\/private\/capital/);
 assert.doesNotMatch(JSON.stringify(h.sent),/SECRET_AMOUNT|SECRET_NAME/);
});
test('Revoked or superseded access does not send',async()=>{
 const h=harness({grant:false});assert.equal((await h.exports.deliverOnce()).status,'failed');assert.equal(h.sent.length,0);
 assert.equal(h.updates.at(-1).value.last_error,'Access no longer current');
});
test('Preview cannot send Capital mail even with SMTP configured',async()=>{
 const h=harness({preview:true});assert.equal((await h.exports.deliverOnce()).status,'failed');assert.equal(h.sent.length,0);
});
test('SMTP rejection leaves mail pending without reporting sent',async()=>{
 const h=harness({accepted:false});assert.equal((await h.exports.deliverOnce()).status,'failed');assert.equal(h.updates.at(-1).value.status,'pending');
});

test('Introductory calls notify administrators using a protected link',async()=>{const h=harness({intro:true});assert.equal((await h.exports.deliverOnce()).status,'sent');assert.match(h.sent[0].text,/https:\/\/www.mzsgroup.com\/admin\/intro-calls/);assert.doesNotMatch(JSON.stringify(h.sent),/SECRET_AMOUNT|SECRET_NAME/)});
test('Introductory call mail is blocked in preview and for non-admin recipients',async()=>{for(const options of [{intro:true,preview:true},{intro:true,admin:false}]){const h=harness(options);assert.equal((await h.exports.deliverOnce()).status,'failed');assert.equal(h.sent.length,0)}});
