import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const compile=file=>ts.transpileModule(readFileSync(file,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const helper={};
vm.runInNewContext(compile('lib/accountancy/assistant-bridge.ts'),{
 exports:helper,process:{env:{}},TextDecoder,Uint8Array,Error,Number,URL
});
const preview={VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co',MZS_ASSISTANT_PDF_BRIDGE_ENABLED:'true'};
const token='a'.repeat(40)+'.'+'b'.repeat(40)+'.'+'c'.repeat(40);
const draft='00000000-0000-4000-8000-000000000008';
const issuer='00000000-0000-4000-8000-000000000003';
const actor='00000000-0000-4000-8000-000000000001';
const original=Buffer.from('%PDF-1.7\n'+'synthetic untrusted invoice content; no real vendor or customer. '.repeat(3)+'\n%%EOF');
const sha=createHash('sha256').update(original).digest('hex');
const url='https://preview.mzs-group.vercel.app/api/admin/assistant-originals';
function request(extra={},bytes=original){
 return new Request(url,{method:'POST',headers:{
  'content-type':'application/pdf','authorization':'Bearer '+token,
  'x-mzs-cost-draft-id':draft,'x-mzs-file-name':'synthetic-invoice.pdf',
  'x-mzs-file-sha256':sha,...extra
 },body:bytes});
}
test('assistant bridge is disabled by default, in Production and for wrong Supabase project',()=>{
 assert.equal(helper.isAssistantBridgeStaging({}),false);
 assert.equal(helper.isAssistantBridgeStaging(preview),true);
 assert.equal(helper.isAssistantBridgeStaging({...preview,VERCEL_ENV:'production'}),false);
 assert.equal(helper.isAssistantBridgeStaging({...preview,NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co'}),false);
 assert.equal(helper.isAssistantBridgeStaging({...preview,MZS_ASSISTANT_PDF_BRIDGE_ENABLED:'false'}),false);
});
test('machine upload contract rejects API keys, missing checksum, path traversal, malformed names',()=>{
 assert.equal(helper.bridgeHeaders(request().headers).draftId,draft);
 for(const bad of [
  {authorization:'Bearer sb_publishable_test'},
  {'x-mzs-file-sha256':'z'.repeat(64)},
  {'x-mzs-file-name':'../bad.pdf'},
  {'x-mzs-file-name':'ftp%2Fsecret.pdf'},
  {'x-mzs-cost-draft-id':'somebody-else'}
 ])assert.throws(()=>helper.bridgeHeaders(request(bad).headers),/unauthenticated|invalid_headers/);
});
test('PDF bytes are bounded even without trusted content-length and checked for real PDF signature',async()=>{
 assert.deepEqual(Buffer.from(await helper.boundedPdf(request())),original);
 await assert.rejects(()=>helper.boundedPdf(request({'content-type':'text/html'})),/pdf_required/);
 await assert.rejects(()=>helper.boundedPdf(request({'content-length':'4194305'})),/too_large/);
 await assert.rejects(()=>helper.boundedPdf(request({},Buffer.alloc(200))),/invalid_pdf/);
 await assert.rejects(()=>helper.boundedPdf(request({},Buffer.from('%PDF-1.7'))),/invalid_pdf/);
});
function fixture({disabled=false,admin=true,active=true,verified=true,scan='clean',scannerEnabled=true,linkFail=false,duplicate=false,brokenStorage=false,missingDraft=false}={}){
 const events=[],documents=[],links=[],storage=new Map();
 const previous={id:'00000000-0000-4000-8000-000000000009',issuer_id:issuer,fiscal_year:2026,file_path:issuer+'/2026/00000000-0000-4000-8000-000000000009.pdf',
  sha256:sha,file_size_bytes:original.length,review_status:'pending_review'};
 if(duplicate){documents.push(previous);storage.set(previous.file_path,Buffer.from(original));links.push({document_id:previous.id,draft_id:draft,id:'previous-link',is_active:true});}
 function from(table){
  const filter=[],query={mode:'select',payload:null};
  const builder={
   select(){return builder;},
   eq(k,v){filter.push([k,v]);return builder;},
   insert(x){query.mode='insert';query.payload=x;return builder;},
   async single(){return perform();},async maybeSingle(){return perform();},
   then(resolve,reject){return Promise.resolve(perform()).then(resolve,reject);}
  };
  async function perform(){
   const match=x=>filter.every(([key,val])=>x[key]===val);
   if(query.mode==='insert'){
    events.push(['insert',table,query.payload]);
    if(table==='mzs_accountancy_documents'){
     documents.push(query.payload);
     return {data:query.payload,error:null};
    }
    if(table==='mzs_accountancy_document_links'){
     if(linkFail)return {data:null,error:{code:'42501'}};
     if(links.some(x=>x.document_id===query.payload.document_id&&x.draft_id===query.payload.draft_id&&x.is_active))
      return {data:null,error:{code:'23505'}};
     links.push({...query.payload,id:'new-link',is_active:true});
     return {data:null,error:null};
    }
    throw Error('Unexpected insert '+table);
   }
   let data;
   if(table==='profiles')data=[{id:actor,role:admin?'admin':'client',is_active:active}];
   else if(table==='mzs_ops_expense_drafts')data=missingDraft?[]:[{id:draft,legal_entity_id:issuer,
    invoice_date:'2026-02-04',supplier_invoice_number:'SYNTH-01',status:'draft'}];
   else if(table==='mzs_accountancy_documents')data=documents;
   else if(table==='mzs_accountancy_document_links')data=links;
   else throw Error('Unexpected table '+table);
   return {data:data.find(match)??null,error:null};
  }
  return builder;
 }
 const db={
  auth:{async getUser(){events.push(['getUser']);return verified?{data:{user:{id:actor}},error:null}:{data:{user:null},error:{message:'invalid'}};}},
  from,
  storage:{from(bucket){assert.equal(bucket,'mzs-private-accountancy-documents');return {
   async upload(path,bytes){events.push(['upload',path]);storage.set(path,Buffer.from(bytes));return {error:null};},
   async download(path){events.push(['download',path]);if(!storage.has(path))return {data:null,error:{message:'missing'}};
    const bytes=brokenStorage?Buffer.from('BAD FILE'):storage.get(path);return {data:new Blob([bytes]),error:null};},
   async remove(){events.push(['remove']);return {error:null};}
  };}}
 };
 const route={};
 const env=disabled?{...preview,MZS_ASSISTANT_PDF_BRIDGE_ENABLED:'false'}:{...preview,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic'};
 vm.runInNewContext(compile('app/api/admin/assistant-originals/route.ts'),{
  exports:route,Buffer,Request,Response,Blob,TextDecoder,TextEncoder,Uint8Array,FormData,URL,Error,process:{env},
  require(name){
   if(name==='node:crypto')return require(name);
   if(name.endsWith('lib/supabase/server'))return {createClient:async()=>{events.push(['session-client']);return db;}};
   if(name==='@supabase/supabase-js')return {createClient:(_url,_key,options)=>{
    assert.equal(_url,preview.NEXT_PUBLIC_SUPABASE_URL);
    assert.equal(options.auth.persistSession,false);
    assert.equal(typeof options.accessToken,'function');
    events.push(['client']);
    return db;
   }};
   if(name==='next/cache')return {revalidatePath:path=>events.push(['revalidate',path])};
   if(name.endsWith('accountancy/archive'))return {ARCHIVE_BUCKET:'mzs-private-accountancy-documents',
    documentPath:(e,y,id)=>e+'/'+y+'/'+id+'.pdf'};
   if(name.endsWith('accountancy/assistant-bridge'))return {...helper,isAssistantBridgeStaging:()=>helper.isAssistantBridgeStaging(env)};
   if(name.endsWith('accountancy/pdf/server'))return {scannerOptions:()=>({environment:env.VERCEL_ENV,supabaseUrl:env.NEXT_PUBLIC_SUPABASE_URL,enabled:'true',processorApproved:'true',apiKey:'synthetic-fake-key-1234567890'})};
   if(name.endsWith('cloudmersive-advanced'))return {
    scannerIsExplicitlyEnabled:()=>scannerEnabled,
    scanStagingPdfWithCloudmersive:async()=>{events.push(['scan']);return {verdict:scan,reason:scan==='malicious'?'threat':'clean'};}
   };
   throw Error('Unexpected import '+name);
  }
 });
 return {route,events,documents,links,storage};
}
test('disabled assistant endpoint never reads the token, file body or database',async()=>{
 const f=fixture({disabled:true}),r=await f.route.POST(request());
 assert.equal(r.status,404);assert.equal(f.events.length,0);
});
test('unverified JWT or inactive/unprivileged user cannot upload or call scanner',async()=>{
 for(const opt of [{verified:false},{admin:false}]){
  const f=fixture(opt),r=await f.route.POST(request());
  assert.equal(r.status,opt.verified===false?401:403);
  assert.equal(f.events.some(e=>e[0]==='scan'||e[0]==='upload'),false);
 }
});
test('client PDF checksum mismatch and browser origin are rejected before any scan or mutation',async()=>{
 for(const [extra,status] of [[{'x-mzs-file-sha256':'0'.repeat(64)},422],[{origin:'https://chatgpt.com'},403]]){
  const f=fixture(),r=await f.route.POST(request(extra));
  assert.equal(r.status,status);
  assert.equal(f.events.some(e=>e[0]==='scan'||e[0]==='upload'),false);
 }
});
test('malicious PDF verdict fails closed before Storage and DB writes',async()=>{
 const f=fixture({scan:'malicious'}),r=await f.route.POST(request());
 assert.equal(r.status,422);assert.equal(f.events.some(e=>e[0]==='upload'),false);
});
test('clean original is uploaded, re-downloaded, registered and linked with audit-compatible columns',async()=>{
 const f=fixture(),r=await f.route.POST(request()),body=await r.json();
 assert.equal(r.status,201);assert.equal(body.status,'archived_and_linked');
 assert.equal(body.archive_verified,true);assert.equal(body.linked,true);assert.equal(body.payment_recorded,false);
 assert.equal(f.documents.length,1);assert.equal(f.links.length,1);
 assert.equal(f.documents[0].sha256,sha);assert.equal(f.documents[0].review_status,'pending_review');
 assert.equal(f.documents[0].issuer_id,issuer);assert.equal(f.documents[0].category,'supplier_invoice');
 assert.deepEqual(f.events.map(e=>e[0]),['client','getUser','scan','upload','download','insert','download','insert','revalidate']);
});
test('existing immutable PDF is reused without uploading twice or rewriting review',async()=>{
 const f=fixture({duplicate:true}),r=await f.route.POST(request()),body=await r.json();
 assert.equal(r.status,200);assert.equal(body.status,'archived_and_linked');
 assert.equal(body.document_id,'00000000-0000-4000-8000-000000000009');
 assert.equal(f.events.filter(e=>e[0]==='upload').length,0);
 assert.equal(f.documents.length,1);assert.equal(f.links.length,1);
});
test('ambiguous link failure is reported without claiming a success or deleting the retained PDF',async()=>{
 const f=fixture({linkFail:true}),r=await f.route.POST(request()),body=await r.json();
 assert.equal(r.status,202);assert.equal(body.status,'archived_link_unconfirmed');
 assert.equal(body.linked,false);assert.equal(f.documents.length,1);
 assert.equal(f.events.some(e=>e[0]==='remove'),false);
});
test('corrupt storage readback cannot create a false verified archive entry',async()=>{
 const f=fixture({brokenStorage:true}),r=await f.route.POST(request()),body=await r.json();
 assert.equal(r.status,503);assert.equal(body.error,'original_not_verified');
 assert.equal(f.documents.length,0);assert.equal(f.links.length,0);
});

function browserRequest(extra={}){
 const req=request({origin:new URL(url).origin,'sec-fetch-site':'same-origin',...extra});
 req.headers.delete('authorization');return req;
}
test('same-origin browser sender uses verified server session and retains exact bytes with existing draft link',async()=>{
 const f=fixture(),r=await f.route.POST(browserRequest());
 assert.equal(r.status,201);const result=await r.json();
 assert.equal(result.archive_verified,true);assert.equal(result.linked,true);
 assert.equal(result.draft_id,draft);assert.equal(result.payment_recorded,false);
 assert.ok(f.events.some(x=>x[0]==='session-client'));
 assert.ok(!f.events.some(x=>x[0]==='client'));
 assert.equal(f.documents[0].issuer_id,issuer);assert.equal(f.documents[0].fiscal_year,2026);
 assert.deepEqual(f.storage.get(f.documents[0].file_path),original);
 assert.deepEqual([...new Set(f.events.filter(x=>x[0]==='insert').map(x=>x[1]))].sort(),
 ['mzs_accountancy_document_links','mzs_accountancy_documents']);
 const again=await f.route.POST(browserRequest());assert.equal(again.status,200);
 assert.equal((await again.json()).document_id,result.document_id);
 assert.equal(f.documents.length,1);assert.equal(f.storage.size,1);
});
test('browser CSRF, mixed credentials and absent session fail before scanning or storage',async()=>{
 for(const extra of [{origin:'https://attacker.example'},{origin:'null'},{'sec-fetch-site':'same-site'}, {'sec-fetch-site':'cross-site'}]){
  const f=fixture(),r=await f.route.POST(browserRequest(extra));
  assert.equal(r.status,403);assert.equal(f.events.length,0);
 }
 const mixed=fixture(),r=await mixed.route.POST(request({origin:new URL(url).origin,'sec-fetch-site':'same-origin'}));
 assert.equal(r.status,403);assert.equal(mixed.events.length,0);
 for(const options of [{verified:false},{admin:false},{active:false}]){
  const f=fixture(options),r=await f.route.POST(browserRequest());
  assert.ok([401,403].includes(r.status));
  assert.ok(!f.events.some(x=>['scan','upload','insert'].includes(x[0])));
 }
 const noOrigin=fixture(),anon=request();anon.headers.delete('authorization');
 assert.equal((await noOrigin.route.POST(anon)).status,401);assert.equal(noOrigin.events.length,0);
});
test('browser sender fails closed without scanner approval, wrong draft, bad SHA or malware',async()=>{
 const unavailable=fixture({scannerEnabled:false});
 assert.equal((await unavailable.route.POST(browserRequest())).status,503);
 assert.equal(unavailable.events.length,0);
 const missing=fixture({missingDraft:true});assert.equal((await missing.route.POST(browserRequest())).status,404);
 assert.ok(!missing.events.some(x=>x[0]==='scan'));
 const checksum=fixture();assert.equal((await checksum.route.POST(browserRequest({'x-mzs-file-sha256':'0'.repeat(64)}))).status,422);
 assert.ok(!checksum.events.some(x=>x[0]==='scan'));
 for(const scan of ['malicious','unscannable']){
  const f=fixture({scan}),r=await f.route.POST(browserRequest());
  assert.ok([422,503].includes(r.status));assert.equal(f.storage.size,0);assert.equal(f.documents.length,0);
 }
});
test('same-origin requests cannot open the production receiver',async()=>{
 const f=fixture({disabled:true});assert.equal((await f.route.POST(browserRequest())).status,404);
 assert.equal(f.events.length,0);
});
