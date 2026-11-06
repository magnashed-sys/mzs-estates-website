import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(path,require=()=>{throw Error('Unexpected import');}){
 const exports={};new Function('exports','require','Response','TextDecoder',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,require,Response,TextDecoder);return exports;
}
const bounded=load('lib/security/bounded-form-data.ts');
const id='00000000-0000-4000-8000-000000000001';
function fixture(route,rpcError=null){
 let writes=0,notifications=0;
 const db={auth:{getUser:async()=>({data:{user:{id}},error:null})},from(){return {select(){return this;},eq(){return this;},single:async()=>({data:{role:'client',is_active:true},error:null})};},rpc:async()=>{writes++;return {data:{emailQueued:true},error:rpcError};}};
 const json=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 const api=load('app/api/'+route+'/route.ts',name=>{
  if(name.endsWith('/bounded-form-data'))return bounded;
  if(name==='next/server')return {NextResponse:Response,after:()=>{notifications++;}};
  if(name.endsWith('/supabase/server'))return {createClient:async()=>db};
  if(name.endsWith('/rental-notification-auth'))return {rentalAdministrator:async()=>({db}),rentalJson:json};
  if(name.endsWith('/rental-notifications'))return {deliverRentalChange:async()=>{notifications++;return 'sent';}};
  if(name==='@supabase/supabase-js')return {createClient:()=>{writes++;throw Error('Unexpected privileged operation');}};
  if(name==='nodemailer'||name.endsWith('/localized-rental-mail'))return {};
  throw Error(name);
 });
 return {post:body=>{const request=new Request('https://example.invalid',{method:'POST',headers:{origin:'https://example.invalid','content-type':'application/json'},body,duplex:'half'});request.nextUrl=new URL(request.url);return api.POST(request);},writes:()=>writes,notifications:()=>notifications};
}
for(const [route,limit] of [['rental/booking-request',16000],['rental/booking-confirmation',4000],['rental/admin-booking',64000],['capital-requests',32000]])test(route+' bounds input and rejects non-object JSON without side effects',async()=>{
 const f=fixture(route);
 for(const body of ['null','[]','1','"text"','{','{}'])assert.equal((await f.post(body)).status,400);
 let index=0,cancelled=false;const chunks=[new Uint8Array(limit),new Uint8Array(1),new Uint8Array(1)];
 const stream=new ReadableStream({pull(c){if(index===chunks.length)c.close();else c.enqueue(chunks[index++]);},cancel(){cancelled=true;}});
 const result=await f.post(stream);assert.equal(result.status,413);assert.equal(cancelled,true);assert.equal(result.headers.get('cache-control'),'no-store');
 assert.equal(f.writes(),0);assert.equal(f.notifications(),0);
});
test('booking RPC errors stay private while successful changes retain notification behavior',async()=>{
 const payload=JSON.stringify({functionName:'admin_cancel_live_rental_booking',args:{p_booking_id:id,p_reason:'Synthetic cancellation'}});
 const failed=fixture('rental/admin-booking',{message:'internal_schema secret_constraint SQL details'});
 const result=await failed.post(payload);assert.equal(result.status,409);assert.doesNotMatch(await result.text(),/internal_schema|secret_constraint|SQL details/);assert.equal(failed.notifications(),0);
 const success=fixture('rental/admin-booking');const ok=await success.post(payload);assert.equal(ok.status,200);assert.equal((await ok.json()).delivery,'sent');assert.equal(success.writes(),1);assert.equal(success.notifications(),1);
});
