import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import {PDFDocument,StandardFonts} from 'pdf-lib';
function load(file,overrides={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,process,Buffer,Uint8Array,FormData,Blob,Response,Request,URL,AbortController,setTimeout,clearTimeout,fetch,require:n=>n in overrides?overrides[n]:n==='server-only'?{}:n.startsWith('node:')?require(n):load(path.resolve(path.dirname(file),n+'.ts')),...overrides.globals});return exports;}
const model=load('lib/accountancy/pdf/model.ts');
const sample='Invoice number: PDF-TEST-1\nInvoice date: 2026-06-01\nNet amount: 100.00 EUR\nVAT: 21.00 EUR\nTotal: 121.00 EUR';
const suggest=text=>model.suggestPurchase([{page:1,text}]);
function run(command,args,input){return new Promise((resolve,reject)=>{const child=spawn(command,args);let stdout='',stderr='';const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Test subprocess timed out'));},30000);child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('error',reject);child.on('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});child.stdin.end(input);});}
async function pdf(lines=sample,count=1){const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);for(let n=0;n<count;n++){const page=doc.addPage();lines.split('\n').forEach((line,i)=>page.drawText(line,{x:40,y:760-i*25,size:12,font}));}return doc.save();}
test('explicit labels suggest original figures and valid date without inventing supplier or currency',()=>{const p=suggest(sample);assert.equal(p.number,'PDF-TEST-1');assert.equal(p.date,'2026-06-01');assert.equal(p.net,'100.00');assert.equal(p.vat,'21.00');assert.equal(p.gross,'121.00');assert.equal(p.currency,'EUR');assert.equal(p.supplierName,'');assert.equal(suggest('Supplier: Synthetic Co\n'+sample).supplierName,'Synthetic Co');assert.equal(suggest(sample.replace('2026-06-01','01/06/2026')).date,'');assert.equal(suggest(sample.replaceAll(' EUR','')).currency,'');assert.equal(suggest(sample+' USD').currency,'');assert.equal(suggest(sample.replace('2026-06-01','2026-02-30')).date,'');});
test('ambiguous or unsupported amounts are left empty for manual checking',()=>{assert.equal(suggest(sample+'\nTotal: 122.00 EUR').gross,'');for(const amount of ['1,121.00','1.121,00','-121.00','121','121.001'])assert.equal(suggest(sample.replace('121.00',amount)).gross,'');assert.equal(suggest('').number,'');});
test('staging guard rejects production and a preview with production database',()=>{assert.equal(model.pdfIntakeEnvironment({VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co'}),false);assert.equal(model.pdfIntakeEnvironment({VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co'}),false);assert.equal(model.pdfIntakeEnvironment({VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co'}),true);});
test('real PDF extraction preserves the synthetic invoice text and leaves blank scans manual',async()=>{let result=await run(process.execPath,['scripts/extract-purchase-pdf.mjs'],await pdf());assert.equal(result.code,0,result.stderr);let pages=JSON.parse(result.stdout).pages;assert.equal(pages.length,1);assert.equal(model.suggestPurchase(pages).gross,'121.00');assert.equal(model.suggestPurchase(pages).number,'PDF-TEST-1');result=await run(process.execPath,['scripts/extract-purchase-pdf.mjs'],await pdf(''));assert.equal(result.code,0,result.stderr);assert.equal(model.suggestPurchase(JSON.parse(result.stdout).pages).gross,'');});
test('extractor rejects broken PDF and over-limit page counts',async()=>{for(const bytes of [Buffer.from('%PDF-invalid'),await pdf('Synthetic',21)]){const r=await run(process.execPath,['scripts/extract-purchase-pdf.mjs'],bytes);assert.equal(r.code,1,r.stderr);assert.equal(JSON.parse(r.stdout).error,'unreadable');}});
test('scanner fails closed without approved staging configuration and never calls provider',async()=>{const scanner=load('lib/property-operations/scanner/cloudmersive-advanced.ts');let calls=0;const result=await scanner.scanStagingPdfWithCloudmersive(await pdf(),{},()=>{calls++;throw Error('must not send');});assert.equal(result.reason,'disabled');assert.equal(calls,0);const unknown=scanner.interpretCloudmersiveResponse({CleanResult:true,FoundViruses:[],VerifiedFileFormat:'PDF'});assert.equal(unknown.verdict,'unscannable');});
test('database enforces PDF intake, quarantine, source retention and confirmation boundaries',{timeout:60000},async()=>{const result=await run(process.execPath,['tests/db/purchase-pdf-intake.cjs']);assert.equal(result.code,0,result.stderr);});
const yearId='77777777-7777-4777-8777-777777777777',issuerId='33333333-3333-4333-8333-333333333333';
function fakeDatabase(){
 const tables={mzs_accountancy_years:[{id:yearId,issuer_id:issuerId}],mzs_purchase_pdf_intakes:[],mzs_purchase_pdf_results:[]},files=new Map();let writes=0;
 return {tables,files,get writes(){return writes;},from(table){let filters=[],insert=null;const query={select(){return query;},eq(k,v){filters.push([k,v]);return query;},insert(value){insert=value;return query;},async single(){return query.maybeSingle();},async maybeSingle(){const result=await query;return {...result,data:result.data?.[0]??null};},then(resolve,reject){let data=tables[table].filter(r=>filters.every(([k,v])=>r[k]===v));if(insert){writes++;const r={id:'88888888-8888-4888-8888-888888888888',...insert};tables[table].push(r);data=[r];}return Promise.resolve({data,error:null}).then(resolve,reject);}};return query;},storage:{from(){return {async upload(p,b){if(files.has(p))return {error:{code:'duplicate'}};writes++;files.set(p,new Blob([b]));return {error:null};},async download(p){return files.has(p)?{data:files.get(p),error:null}:{data:null,error:{code:'missing'}};}}}}};
}
function uploadHarness({ready=true,verdict='clean',reason='clean',deny=false}={}){
 const db=fakeDatabase();let scans=0,extractions=0,auth=0;
 const route=load('app/admin/workspaces/accountancy/purchases/upload/route.ts',{
  'next/server':{NextResponse:{json:(data,options)=>Response.json(data,options)}},
  '../../../../../../lib/accountancy/pdf/server':{requirePdfAdmin:async()=>{auth++;if(deny)throw Error('Denied');return {db,user:{id:'admin'}};},pdfProcessingReady:()=>ready,processingClient:()=>db,scannerOptions:()=>({})},
  '../../../../../../lib/accountancy/pdf/extract':{extractPurchasePdf:async()=>{extractions++;return [{page:1,text:sample}];}},
  '../../../../../../lib/property-operations/scanner/cloudmersive-advanced':{scanStagingPdfWithCloudmersive:async()=>{scans++;return {verdict,reason};}}
 });
 const request=(body=Buffer.from('%PDF-'+'.'.repeat(200)),origin='https://example.test',year=yearId)=>new Request('https://example.test/admin/workspaces/accountancy/purchases/upload?year='+year,{method:'POST',headers:{origin,'content-type':'application/pdf','x-pdf-name':'synthetic.pdf'},body});
 return {db,route,request,get scans(){return scans;},get extractions(){return extractions;},get auth(){return auth;}};
}
test('upload route authenticates first and rejects disabled processing, foreign origin and oversized bytes before writes',async()=>{
 let h=uploadHarness({deny:true});await assert.rejects(h.route.POST(h.request()),/Denied/);assert.equal(h.auth,1);assert.equal(h.db.writes,0);
 h=uploadHarness({ready:false});assert.equal((await h.route.POST(h.request())).status,503);assert.equal(h.db.writes,0);assert.equal(h.scans,0);
 h=uploadHarness();assert.equal((await h.route.POST(h.request(undefined,'https://other.test'))).status,403);assert.equal((await h.route.POST(h.request(Buffer.alloc(model.MAX_PDF_BYTES+1)))).status,413);assert.equal((await h.route.POST(h.request(Buffer.from('invalid')))).status,400);assert.equal(h.db.writes,0);
});
test('upload retains exact original, scans before extraction and reuses the same SHA without duplicate processing',async()=>{
 const h=uploadHarness(),response=await h.route.POST(h.request());assert.equal(response.status,200);const {id}=await response.json();assert.equal(h.scans,1);assert.equal(h.extractions,1);assert.equal(h.db.tables.mzs_purchase_pdf_intakes.length,1);assert.equal(h.db.tables.mzs_purchase_pdf_results[0].proposal.gross,'121.00');
 const duplicate=await h.route.POST(h.request());assert.equal((await duplicate.json()).id,id);assert.equal(h.scans,1);assert.equal(h.db.files.size,1);
});
test('scanner outages retain quarantine without extraction; blocked originals cannot produce proposals',async()=>{
 let h=uploadHarness({verdict:'unscannable',reason:'network_error'});assert.equal((await h.route.POST(h.request())).status,503);assert.equal(h.db.files.size,1);assert.equal(h.db.tables.mzs_purchase_pdf_results.length,0);assert.equal(h.extractions,0);
 h=uploadHarness({verdict:'malicious',reason:'threat'});assert.equal((await h.route.POST(h.request())).status,200);assert.equal(h.extractions,0);const r=h.db.tables.mzs_purchase_pdf_results[0];assert.equal(r.extraction,'blocked');assert.equal(r.pages.length,0);assert.equal(Object.keys(r.proposal).length,0);
});
test('original download requires clean matching verdict and verifies the stored file hash',async()=>{
 const h=uploadHarness();const uploaded=await h.route.POST(h.request()),{id}=await uploaded.json();const route=load('app/admin/workspaces/accountancy/purchases/[id]/original/route.ts',{'../../../../../../../lib/accountancy/pdf/server':{requirePdfAdmin:async()=>({db:h.db})}}),context={params:Promise.resolve({id})};
 let response=await route.GET(new Request('https://example.test'),context);assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/^attachment/);assert.equal(response.headers.get('cache-control'),'private, no-store');
 const intake=h.db.tables.mzs_purchase_pdf_intakes[0];h.db.files.set(intake.file_path,new Blob([Buffer.from('%PDF-'+'x'.repeat(200))]));response=await route.GET(new Request('https://example.test'),context);assert.equal(response.status,404);
 h.db.tables.mzs_purchase_pdf_results[0].verdict='malicious';assert.equal((await route.GET(new Request('https://example.test'),context)).status,404);
});
