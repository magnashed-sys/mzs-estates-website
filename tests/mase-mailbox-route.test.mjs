import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness({deny=false,code='ready'}={}){
 let checks=0;
 const exports={};
 const mocks={
  'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init),redirect:(url,status)=>new Response(null,{status,headers:{location:String(url)}})}},
  '../../../../../../lib/accountancy/pdf/server':{requirePdfAdmin:async()=>{if(deny)throw Error('Denied');}},
  '../../../../../../scripts/check-mase-mailbox.mjs':{checkMailbox:async()=>{checks++;return {ok:code==='ready',stage:'processed_folder',code};}}
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/admin/workspaces/accountancy/purchases/mailbox-check/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{if(!(name in mocks))throw Error(name);return mocks[name];},URL,Response});
 return {route:exports,get checks(){return checks;}};
}
const request=origin=>new Request('https://preview.test/admin/workspaces/accountancy/purchases/mailbox-check',{method:'POST',headers:origin?{origin}:{}});
test('mailbox route requires staging admin before connecting',async()=>{
 const h=harness({deny:true});await assert.rejects(h.route.POST(request('https://preview.test')),/Denied/);assert.equal(h.checks,0);
});
test('mailbox route rejects absent and foreign origins without connecting',async()=>{
 for(const origin of [undefined,'https://other.test']){
  const h=harness();assert.equal((await h.route.POST(request(origin))).status,403);assert.equal(h.checks,0);
 }
});
test('mailbox route redirects with only the diagnostic code and no-store',async()=>{
 for(const code of ['ready','missing_password','authentication_failed']){
  const h=harness({code});const response=await h.route.POST(request('https://preview.test'));
  assert.equal(h.checks,1);assert.equal(response.status,303);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(response.headers.get('location'),'https://preview.test/admin/workspaces/accountancy/purchases/mailbox?result='+code);
 }
});
