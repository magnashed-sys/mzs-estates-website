import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(path,require=()=>{throw Error('Unexpected dependency');}){
 const exports={};new Function('exports','require','Response','TextDecoder','process',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,require,Response,TextDecoder,{env:{VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic'}});return exports;
}
const bounded=load('lib/security/bounded-form-data.ts');
function fixture(){
 let authChecks=0,writes=0;
 const api=load('app/api/visitor-activity/route.ts',name=>{
  if(name.endsWith('/bounded-form-data'))return bounded;
  if(name==='next/server')return {NextResponse:Response};
  if(name.endsWith('/visitor-report'))return {visitorPath:path=>path==='/private'?path:null};
  if(name.endsWith('/supabase/server'))return {createClient:async()=>({auth:{getUser:async()=>{authChecks++;return {data:{user:null},error:null};}}})};
  if(name==='@supabase/supabase-js')return {createClient:()=>{writes++;throw Error('Unexpected service access');}};
  throw Error(name);
 });
 return {send:body=>{const req=new Request('https://example.invalid',{method:'POST',headers:{origin:'https://example.invalid'},body,duplex:'half'});req.nextUrl=new URL(req.url);return api.POST(req);},authChecks:()=>authChecks,writes:()=>writes};
}
test('visitor activity stops oversized streams before authentication or writes',async()=>{
 const f=fixture();let cancelled=false,index=0;
 const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(++index===1?4000:1));},cancel(){cancelled=true;}});
 assert.equal((await f.send(body)).status,413);assert.equal(cancelled,true);assert.equal(f.authChecks(),0);assert.equal(f.writes(),0);
 assert.equal((await f.send(' '.repeat(1001))).status,413);
});
test('visitor activity rejects malformed identifiers and retains valid anonymous denial',async()=>{
 const f=fixture();
 for(const body of ['null','[]','{',JSON.stringify({kind:'login',event_id:'-'.repeat(36)}),JSON.stringify({kind:'login',event_id:['00000000-0000-4000-8000-000000000001']})])assert.equal((await f.send(body)).status,400);
 assert.equal(f.authChecks(),0);
 assert.equal((await f.send(JSON.stringify({kind:'login',event_id:'00000000-0000-4000-8000-000000000001'}))).status,401);
 assert.equal(f.authChecks(),1);assert.equal(f.writes(),0);
});
