import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const issuer='33333333-3333-4333-8333-333333333333',year='77777777-7777-4777-8777-777777777777';
function harness({admin=true,enabled=true,scanner=true,scope=true}={}){
 let imports=0,clients=0;
 const query={select(){return this},eq(){return this},async single(){return {data:scope?{id:year,issuer_id:issuer}:null,error:null}}};
 const mocks={
 'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},
 '../../../../../../lib/accountancy/pdf/server':{requirePdfAdmin:async()=>{if(!admin)throw Error('Denied');return {db:{from:()=>query},user:{id:'admin'}}},pdfProcessingReady:()=>scanner,processingClient:()=>({}),scannerOptions:()=>({})},
 '../../../../../../lib/accountancy/pdf/retain':{retainPurchasePdf:async()=>{}},
 '../../../../../../lib/accountancy/pdf/extract':{extractPurchasePdf:async()=>{}},
 '../../../../../../lib/property-operations/scanner/cloudmersive-advanced':{scanStagingPdfWithCloudmersive:async()=>{}},
 '../../../../../../lib/accountancy/administration':{uuid:/^[0-9a-f-]{36}$/},
 '../../../../../../lib/accountancy/mailbox/import.mjs':{mailboxClient:()=>{clients++;return {}},importMailboxBatch:async()=>{imports++;return []}}
 };
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/admin/workspaces/accountancy/purchases/mailbox-import/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!(n in mocks))throw Error(n);return mocks[n]},URL,Response,process:{env:{MZS_MASE_IMPORT_ENABLED:enabled?'true':'false',MZS_MASE_ISSUER_ID:issuer,MZS_MASE_IMAP_PASSWORD:'synthetic-only'}}});
 return {route:exports,get imports(){return imports},get clients(){return clients}};
}
const request=(origin='https://preview.test',query='year='+year)=>new Request('https://preview.test/admin/workspaces/accountancy/purchases/mailbox-import?'+query,{method:'POST',headers:{origin}});
test('import denies missing admin before connecting',async()=>{const h=harness({admin:false});await assert.rejects(h.route.POST(request()));assert.equal(h.clients,0);});
test('import refuses disabled scanner, disabled import, foreign origin and wrong entity before mailbox access',async()=>{
 for(const opts of [{scanner:false},{enabled:false},{scope:false}]){
  const h=harness(opts);assert.ok((await h.route.POST(request())).status>=400);assert.equal(h.clients,0);
 }
 const h=harness();assert.equal((await h.route.POST(request('https://other.test'))).status,403);assert.equal(h.clients,0);
});
test('import requires a valid cursor and financial year',async()=>{for(const query of ['year=invalid','year='+year+'&after=-1']){const h=harness();assert.equal((await h.route.POST(request(undefined,query))).status,400);assert.equal(h.clients,0)}});
test('configured authorized import never claims messages were moved',async()=>{const h=harness();const r=await h.route.POST(request());assert.equal(r.status,200);assert.equal((await r.json()).moved,0);assert.equal(h.imports,1);assert.equal(r.headers.get('cache-control'),'private, no-store');});
