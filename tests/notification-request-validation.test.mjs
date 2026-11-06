import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const env={NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic',SUPABASE_SERVICE_ROLE_KEY:'synthetic'};
function load(path,require=()=>{throw Error('Unexpected dependency');}){
 const exports={};new Function('exports','require','Response','TextDecoder','process',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,require,Response,TextDecoder,{env});return exports;
}
const bounded=load('lib/security/bounded-form-data.ts');
const id='00000000-0000-4000-8000-000000000001';
function fixture(route,{deliveryFails=false,rpcError=null}={}){
 let writes=0,deliveries=0;
 const db={auth:{getUser:async()=>({data:{user:{id}},error:null})},from(){return {select(){return this;},eq(){return this;},single:async()=>({data:{role:'admin',is_active:true},error:null}),upsert(){writes++;throw Error('Unexpected write');},update(){writes++;throw Error('Unexpected write');}};},rpc:async()=>{writes++;return {data:true,error:rpcError};}};
 const deliver=async()=>{deliveries++;if(deliveryFails)throw Error('private SMTP detail');return {status:'sent'};};
 const json=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 const api=load('app/api/'+route+'/route.ts',name=>{
  if(name.endsWith('/bounded-form-data'))return bounded;
  if(name==='next/server')return {NextResponse:Response};
  if(name==='node:crypto')return {};
  if(name==='@supabase/supabase-js'||name.endsWith('/supabase/server'))return {createClient:()=>db};
  if(name.endsWith('/phase3a-preview-isolation'))return {isPhase3aPreviewIsolated:()=>true};
  if(name.endsWith('/rental-notification-auth'))return {rentalAdministrator:async()=>({db}),rentalJson:json};
  if(name.endsWith('/rental-notifications'))return {deliverRentalChange:deliver};
  if(name.endsWith('/notifications'))return {deliverOnce:deliver,deliverForRecipient:deliver};
  throw Error(name);
 });
 return {send:body=>{const method=api.PATCH?'PATCH':'POST';const req=new Request('https://example.invalid',{method,headers:{origin:'https://example.invalid',authorization:'Bearer synthetic','content-type':'application/json'},body,duplex:'half'});req.nextUrl=new URL(req.url);return api[method](req);},writes:()=>writes,deliveries:()=>deliveries};
}
for(const [route,limit] of [['rental/notifications',8000],['account/notifications/dispatch',4000],['admin/member-contact',16000],['capital-requests/admin',4000]])test(route+' rejects malformed and oversized input without side effects',async()=>{
 const f=fixture(route);
 for(const body of ['null','[]','1','{','{}'])assert.equal((await f.send(body)).status,400);
 let index=0,cancelled=false;const chunks=[new Uint8Array(limit),new Uint8Array(1),new Uint8Array(1)];
 const body=new ReadableStream({pull(c){if(index===chunks.length)c.close();else c.enqueue(chunks[index++]);},cancel(){cancelled=true;}});
 assert.equal((await f.send(body)).status,413);assert.equal(cancelled,true);assert.equal(f.writes(),0);assert.equal(f.deliveries(),0);
});
test('only a valid dispatch that encounters a delivery failure reports queued',async()=>{
 const f=fixture('account/notifications/dispatch',{deliveryFails:true});
 assert.equal((await f.send('{')).status,400);assert.equal(f.deliveries(),0);
 assert.equal((await f.send(JSON.stringify({event_id:'00000000-0000-4000-000000000001'}))).status,400);assert.equal(f.deliveries(),0);
 const result=await f.send(JSON.stringify({event_id:id}));assert.equal(result.status,202);assert.equal((await result.json()).status,'queued');assert.equal(f.deliveries(),1);
 const ok=fixture('account/notifications/dispatch');assert.equal((await ok.send(JSON.stringify({event_id:id}))).status,200);assert.equal(ok.deliveries(),1);
});
test('notification conflict details stay private and contact fields exclude prototype keys',async()=>{
 const f=fixture('rental/notifications',{rpcError:{message:'private SQL constraint'}});
 const r=await f.send(JSON.stringify({action:'resolve',verified:true,id,decision:'retry',reason:'Synthetic review'}));assert.equal(r.status,409);assert.doesNotMatch(await r.text(),/private SQL constraint/);assert.equal(f.deliveries(),0);
 const contact=fixture('admin/member-contact');
 for(const key of ['__proto__','constructor','toString']){
  const payload={user_id:id,full_name:'Synthetic Name',[key]:'not allowed'};
  const result=await contact.send(JSON.stringify(payload));assert.equal(result.status,400);assert.match(await result.text(),/Unsupported field/);
 }
 assert.equal(contact.writes(),0);
});
