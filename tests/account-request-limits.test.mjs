import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const env={VERCEL_ENV:'preview',MZS_ACCOUNT_REGISTRATION_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic',SUPABASE_SERVICE_ROLE_KEY:'synthetic'};
function load(path,require=()=>{throw Error('Unexpected dependency');}){
 const exports={};
 new Function('exports','require','Response','TextDecoder','process',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,require,Response,TextDecoder,{env});
 return exports;
}
const bounded=load('lib/security/bounded-form-data.ts');
test('bounded text preserves UTF-8 across chunks and the exact limit',async()=>{
 const bytes=new TextEncoder().encode('é中文🙂');let index=0;
 const request=new Request('https://example.invalid',{method:'POST',duplex:'half',body:new ReadableStream({pull(c){if(index===bytes.length)c.close();else c.enqueue(bytes.slice(index,++index));}})});
 assert.equal(await bounded.boundedText(request,bytes.length),'é中文🙂');
});
for(const [route,limit] of [['register',9000],['approve',9000],['access/update',11000]])test(route+' rejects oversized and malformed input before account operations',async()=>{
 let operations=0;
 const api=load('app/api/account/'+route+'/route.ts',name=>{
  if(name.endsWith('/bounded-form-data'))return bounded;
  if(name==='next/server')return {NextResponse:Response};
  if(name.endsWith('/public-routing'))return {isLocale:()=>true};
  if(name==='node:crypto')return {};
  if(name.endsWith('/notifications'))return {};
  if(name==='@supabase/supabase-js'||name.endsWith('/supabase/server'))return {createClient:()=>{operations++;throw Error('Unexpected account operation');}};
  throw Error(name);
 });
 function request(body,headers={}){
  const req=new Request('https://example.invalid/api',{method:'POST',headers:{origin:'https://example.invalid',...headers},body,duplex:'half'});req.nextUrl=new URL(req.url);return req;
 }
 for(const declared of [undefined,'1']){
  let cancelled=false,index=0;const chunks=[new Uint8Array(limit*4),new Uint8Array(1),new Uint8Array(1)];
  const stream=new ReadableStream({pull(c){if(index===chunks.length)c.close();else c.enqueue(chunks[index++]);},cancel(){cancelled=true;}});
  const r=await api.POST(request(stream,declared?{'content-length':declared}:{}));
  assert.equal(r.status,413);assert.equal(cancelled,true);assert.equal(r.headers.get('cache-control'),'no-store');
 }
 assert.equal((await api.POST(request('x'.repeat(limit+1)))).status,413);
 for(const body of ['{','null','[]'])assert.equal((await api.POST(request(body))).status,400);
 assert.equal(operations,0);
});
