import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness({admin=true,origin='https://app.test',env='production',enabled=true,ready=true,state='review'}={}){
 let moves=0,clients=0;
 const query={select(){return this},eq(){return this},async single(){return {data:{id:'11111111-1111-4111-8111-111111111111',state},error:null}}};
 const exports={},mocks={
 'next/server':{NextResponse:{json:(b,o)=>Response.json(b,o)}},
 '../../../../../../lib/accountancy/pdf/server':{requirePdfAdmin:async()=>{if(!admin)throw Error('denied')},pdfProcessingReady:()=>ready,processingClient:()=>({from:()=>query})},
 '../../../../../../lib/accountancy/administration':{uuid:/^[0-9a-f-]{36}$/},
 '../../../../../../lib/accountancy/mailbox/import.mjs':{mailboxClient:()=>{clients++;return {}}},
 '../../../../../../lib/accountancy/mailbox/move.mjs':{moveReviewedMessage:async()=>{moves++;return {state:'moved'}}}
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/admin/workspaces/accountancy/purchases/mailbox-move/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,process:{env:{VERCEL_ENV:env,NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co',MZS_MASE_MOVE_ENABLED:enabled?'true':'false',MZS_MASE_IMPORT_ENABLED:'true',MZS_MASE_IMAP_PASSWORD:'synthetic',MZS_MASE_ISSUER_ID:'22222222-2222-4222-8222-222222222222'}},require:n=>{if(!(n in mocks))throw Error(n);return mocks[n]}});
 return {run:()=>exports.POST(new Request('https://app.test/move?receipt=11111111-1111-4111-8111-111111111111',{method:'POST',headers:{origin}})),get moves(){return moves},get clients(){return clients}};
}
test('move route blocks unauthenticated users, foreign origin, staging and disabled switches',async()=>{
 const denied=harness({admin:false});await assert.rejects(denied.run());assert.equal(denied.clients,0);
 for(const options of [{origin:'https://evil.test'},{env:'preview'},{enabled:false},{ready:false}]){const h=harness(options);assert.ok((await h.run()).status>=400);assert.equal(h.clients,0);}
});
test('move route never repeats a completed or uncertain move',async()=>{
 for(const state of ['moved','moving','uncertain']){const h=harness({state});const r=await h.run();assert.equal(r.status,state==='moved'?200:409);assert.equal(h.moves,0);}
 const h=harness();assert.equal((await h.run()).status,200);assert.equal(h.moves,1);
});
