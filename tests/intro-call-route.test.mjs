import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHmac} from 'node:crypto';
const compile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const helper=compile('../lib/mzs/intro-calls.ts'), route=compile('../app/api/intro-calls/route.ts');
function harness({preview=false,rate=true,save=true}={}){
 const env={VERCEL_ENV:preview?'preview':'production',NEXT_PUBLIC_SUPABASE_URL:preview?'https://senonkpxdtlhyhrubicg.supabase.co':'https://ptrnjzmcehrhbsfxntgw.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-secret'};
 const helpers={},exports={},calls=[],jobs=[],sent=[];
 vm.runInNewContext(helper,{exports:helpers,process:{env}});
 vm.runInNewContext(route,{exports,process:{env},Buffer,console:{error(){}},require(name){
  if(name==='node:crypto')return {createHmac};
  if(name==='next/server')return {NextResponse:{json:(v,o)=>({body:v,...o})},after:f=>jobs.push(f)};
  if(name==='@supabase/supabase-js')return {createClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return name==='mzs_check_registration_rate'?{data:rate}:{data:save?{id:'request-id',events:['mail-id']}:null,error:save?null:{}}}})};
  if(name.endsWith('/intro-calls'))return helpers;
  if(name.endsWith('/notifications'))return {deliverOnce:async id=>sent.push(id)};
  throw new Error(name);
 }});
 const post=async(body,origin='https://www.mzsgroup.com')=>{const req=new Request('https://www.mzsgroup.com/api/intro-calls',{method:'POST',headers:{origin,'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.1'},body:JSON.stringify(body)});req.nextUrl=new URL(req.url);return exports.POST(req)};
 return {post,calls,jobs,sent};
}
const valid={requestKey:'3895f2ce-6ffd-4426-b551-043663dcdd17',name:'Visitor',email:'visitor@example.invalid'};
test('Production records atomically before scheduling administrative delivery',async()=>{const h=harness();const r=await h.post(valid);assert.equal(r.status,201);assert.equal(r.body.recorded,true);assert.equal(h.calls.length,3);assert.equal(h.jobs.length,1);await h.jobs[0]();assert.deepEqual(h.sent,['mail-id']);assert.doesNotMatch(JSON.stringify(h.calls.slice(0,2)),/visitor@example|192.0.2.1/)});
test('Preview stores but never schedules mail',async()=>{const h=harness({preview:true});assert.equal((await h.post(valid)).status,201);assert.equal(h.jobs.length,0)});
test('Invalid origin, fields and honeypot never reach the database',async()=>{for(const [body,origin,status] of [[valid,'https://other.invalid',403],[{...valid,email:'bad'},undefined,400],[{...valid,website:'spam'},undefined,400]]){const h=harness();assert.equal((await h.post(body,origin)).status,status);assert.equal(h.calls.length,0)}});
test('Rate limit and persistence failure never report success or schedule mail',async()=>{for(const [options,status] of [[{rate:false},429],[{save:false},503]]){const h=harness(options);assert.equal((await h.post(valid)).status,status);assert.equal(h.jobs.length,0)}});
test('Real Estate uses source-aware intake; Capital keeps its compatible endpoint',async()=>{const h=harness();assert.equal((await h.post({...valid,source:'real-estate'})).status,201);assert.equal(h.calls[2].name,'mzs_submit_intro_call_with_source');assert.equal(h.calls[2].args.p_source,'real-estate');const bad=harness();assert.equal((await bad.post({...valid,source:'arbitrary'})).status,400);assert.equal(bad.calls.length,0)});
