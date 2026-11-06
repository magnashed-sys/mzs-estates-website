import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function load(path,require=()=>{throw Error('Unexpected import');}){
 const exports={};
 new Function('exports','require','Response',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,require,Response);
 return exports;
}
const helpers=load('lib/security/bounded-form-data.ts');
function streamed(chunks,declared){
 let cancelled=false,index=0;
 const headers={'content-type':'application/x-www-form-urlencoded',origin:'https://example.invalid'};
 if(declared!==undefined)headers['content-length']=declared;
 const body=new ReadableStream({pull(c){if(index===chunks.length)c.close();else c.enqueue(chunks[index++]);},cancel(){cancelled=true;}});
 return {request:new Request('https://example.invalid/upload',{method:'POST',headers,body,duplex:'half'}),cancelled:()=>cancelled};
}
test('real multipart fields and file survive an exact byte limit',async()=>{
 const form=new FormData();form.set('title','Onderhoud café');form.set('file',new Blob(['photo-fixture']), 'fixture.jpg');
 const original=new Request('https://example.invalid',{method:'POST',body:form});
 const bytes=new Uint8Array(await original.arrayBuffer());
 const request=new Request(original.url,{method:'POST',headers:original.headers,body:bytes});
 const parsed=await helpers.boundedFormData(request,bytes.length);
 assert.equal(parsed.get('title'),'Onderhoud café');assert.equal(parsed.get('file').name,'fixture.jpg');assert.equal(await parsed.get('file').text(),'photo-fixture');
});
test('missing and understated lengths cannot bypass the streaming limit',async()=>{
 for(const declared of [undefined,'1']){
  const f=streamed([new Uint8Array(8),new Uint8Array(8),new Uint8Array(8)],declared);
  await assert.rejects(helpers.boundedFormData(f.request,10),helpers.RequestBodyTooLarge);
  assert.equal(f.cancelled(),true);
 }
});
test('advertised oversize is cancelled; invalid lengths and malformed forms fail closed',async()=>{
 const large=streamed([new Uint8Array(20)],'20');
 await assert.rejects(helpers.boundedFormData(large.request,10),helpers.RequestBodyTooLarge);assert.equal(large.cancelled(),true);
 for(const length of ['-1','NaN','1.5','9007199254740992'])await assert.rejects(helpers.boundedFormData(streamed([],length).request,10),/Invalid content length/);
 await assert.rejects(helpers.boundedFormData(new Request('https://example.invalid',{method:'POST',headers:{'content-type':'multipart/form-data'},body:'broken'}),100));
 const broken=new Request('https://example.invalid',{method:'POST',body:new ReadableStream({start(c){c.error(Error('Interrupted'));}}),duplex:'half'});
 await assert.rejects(helpers.boundedFormData(broken,100),/Interrupted/);
});
for(const route of ['maintenance-photo','report-with-photos'])test(route+' rejects oversized streams before writes or image processing',async()=>{
 let writes=0,processed=0;
 const db={auth:{getUser:async()=>({data:{user:{id:'staff'}},error:null})},from(table){
  return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{role:'client',is_active:true},error:null}),then(resolve){resolve({data:[{id:'property'}],error:null});},insert(){writes++;throw Error('Unexpected write');}};
 }};
 const api=load('app/api/staff/'+route+'/route.ts',name=>{
  if(name==='next/server')return {NextResponse:Response};
  if(name.endsWith('/bounded-form-data'))return helpers;
  if(name.endsWith('/supabase/server'))return {createClient:async()=>db};
  if(name.endsWith('/property-staff'))return {staffEnvironmentAvailable:()=>true};
  if(name.endsWith('/staff-work'))return {uuid:/^[a-f0-9-]{36}$/};
  if(name.endsWith('/maintenance-photo'))return {MAX_PHOTO_BYTES:4*1024*1024,normalizeMaintenancePhoto:()=>{processed++;throw Error('Unexpected processing');}};
  if(name==='node:crypto')return {};
  throw Error(name);
 });
 const limit=route==='maintenance-photo'?4*1024*1024+100000:32000;
 for(const declared of [undefined,'1']){
  const f=streamed([new Uint8Array(limit),new Uint8Array(1),new Uint8Array(1)],declared);
  const response=await api.POST(f.request);
  assert.equal(response.status,413);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(f.cancelled(),true);
 }
 assert.equal(writes,0);assert.equal(processed,0);
});
