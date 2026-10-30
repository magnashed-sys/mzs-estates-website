import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash,randomBytes} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url),modules=new Map();
function load(file){
 file=path.resolve(file);if(modules.has(file))return modules.get(file);
 const exports={};modules.set(file,exports);
 vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports,Buffer,Uint8Array,TextEncoder,ReadableStream,Date,require:n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):require(n)});
 return exports;
}
const original=load('lib/accountancy/year-originals.ts'),zip=load('lib/property-operations/accountant-archive.ts'),pkg=load('lib/accountancy/year-package.ts');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(count=4){
 const bytes=Buffer.from('%PDF-1.4\nSYNTHETIC ONLY\n%%EOF\n');
 const documents=Array.from({length:count},(_,n)=>({id:id(10+n),issuer_id:id(2),fiscal_year:2026,title:'Synthetic '+n,original_name:'../same invoice.pdf',category:'other',review_status:['reviewed','pending_review','needs_attention','superseded'][n%4],sha256:hash(bytes),notes:'Original note',updated_at:'2026-10-30T09:00:00+00:00'}));
 const source={administration:{id:id(1),issuer_id:id(2),fiscal_year:2026,purpose:'current',vat_treatment:'pending',checks:{income:false,costs:false,bank:false,assets:false,financing:false,tax:false,documents:false}},snapshot_at:'2026-10-30T09:01:00Z',sales:{issuer:{id:id(2),name:'Synthetic'},snapshot_at:'2026-10-30T09:01:00Z',leases:[],bookings:[],external:[],services:[],credit_notes:[],rent_receipts:[],guest_receipts:[],external_receipts:[],service_receipts:[],imported_receipts:[],imported:[]},costs:[],reviews:[],projects:[],documents,capital_references:[]};
 const rows=documents.map(d=>({...d,file_path:`${id(2)}/2026/${d.id}.pdf`,file_size_bytes:bytes.length,mime_type:'application/pdf'}));
 const calls=[],state={rows,download:async()=>({data:new Blob([bytes]),error:null}),queryError:null};
 const db={from(table){assert.equal(table,'mzs_accountancy_documents');calls.push(['query']);const filters={};return {select(){return this},eq(k,v){filters[k]=v;return this},async in(k,ids){calls.push(['scope',filters,ids]);return {data:state.rows.filter(r=>ids.includes(r.id)),error:state.queryError}}}},storage:{from(bucket){assert.equal(bucket,'mzs-private-accountancy-documents');return {download:async(p,o,request)=>{calls.push(['download',p,request]);return state.download(p)}}}}};
 return {source,bytes,db,state,calls};
}
async function unzip(stream){
 const reader=stream.getReader(),chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;assert.ok(value.length<=65536);chunks.push(Buffer.from(value));}
 const buffer=Buffer.concat(chunks),files=new Map();let pos=0;
 while(buffer.readUInt32LE(pos)===0x04034b50){const size=buffer.readUInt32LE(pos+18),len=buffer.readUInt16LE(pos+26);const name=buffer.subarray(pos+30,pos+30+len).toString();files.set(name,inflateRawSync(buffer.subarray(pos+30+len,pos+30+len+size)));pos+=30+len+size;}
 assert.equal(buffer.readUInt32LE(pos),0x02014b50);assert.equal(buffer.readUInt32LE(buffer.length-22),0x06054b50);
 assert.equal(buffer.readUInt32LE(buffer.length-6),pos);assert.equal(buffer.readUInt16LE(buffer.length-12),files.size);
 return {buffer,files};
}
test('year ZIP includes every review status once with safe paths, original filenames and matching manifest hashes',async()=>{
 const f=fixture(),originals=await original.loadYearOriginals(f.db,f.source);
 assert.equal(originals.length,4);
 assert.equal(f.calls.filter(c=>c[0]==='download').length,4);
 for(const c of f.calls.filter(c=>c[0]==='scope'))assert.deepEqual(c[1],{issuer_id:id(2),fiscal_year:2026});
 const files=pkg.yearAccountantFiles(f.source,id(1),[],undefined,undefined,originals);
 const archive=await unzip(zip.accountantZipStream(files,{maxFiles:650,maxBytes:88*1024*1024}));
 const text=n=>archive.files.get(n).toString(),manifest=JSON.parse(text('manifest.json'));
 assert.equal(manifest.original_pdfs,4);assert.equal(manifest.original_pdf_bytes,4*f.bytes.length);assert.equal(manifest.statutory_complete,false);
 for(const d of f.source.documents){assert.deepEqual(archive.files.get('documents/'+d.id+'.pdf'),f.bytes);assert.ok(text('source-document-index.csv').includes(d.review_status));}
 assert.match(text('source-document-index.csv'),/\.\.\/same invoice.pdf/);
 assert.equal([...archive.files.keys()].filter(n=>n.endsWith('.pdf')).length,4);
 for(const entry of manifest.files){assert.equal(hash(archive.files.get(entry.name)),entry.sha256);assert.equal(archive.files.get(entry.name).length,entry.bytes);}
 assert.match(text('source-coverage.csv'),/superseded/);
 assert.throws(()=>pkg.yearAccountantFiles(f.source,id(1)),/changed/);
 assert.throws(()=>pkg.yearAccountantFiles(f.source,id(1),[],undefined,undefined,[originals[0],originals[0],...originals.slice(2)]),/changed/);
});
test('cross-entity/year snapshots and duplicate IDs are refused before any query or download',async()=>{
 for(const change of [s=>s.documents[0].issuer_id=id(9),s=>s.documents[0].fiscal_year=2025,s=>s.documents[0].id='../bad',s=>s.documents[1].id=s.documents[0].id]){
  const f=fixture();change(f.source);await assert.rejects(original.loadYearOriginals(f.db,f.source),/changed/);assert.equal(f.calls.length,0);
 }
});
test('metadata drift, wrong storage path, invalid type/size and missing rows stop before downloading',async()=>{
 for(const change of [r=>r.pop(),r=>r[0].issuer_id=id(9),r=>r[0].fiscal_year=2025,r=>r[0].file_path='other/2026/file.pdf',r=>r[0].sha256='a'.repeat(64),r=>r[0].review_status='superseded',r=>r[0].updated_at='2026-10-30T10:00:00Z',r=>r[0].mime_type='text/html',r=>r[0].file_size_bytes=0,r=>r[0].file_size_bytes=20*1024*1024+1]){
  const f=fixture();change(f.state.rows);await assert.rejects(original.loadYearOriginals(f.db,f.source),/changed/);assert.equal(f.calls.filter(c=>c[0]==='download').length,0);
 }
});
test('unavailable storage, mismatched bytes and forged PDF metadata fail closed',async()=>{
 for(const download of [async()=>({error:Error('not found')}),async()=>({data:new Blob(['small'])}),async()=>({data:new Blob([Buffer.alloc(29)])})]){
  const f=fixture(1);f.state.download=download;await assert.rejects(original.loadYearOriginals(f.db,f.source),/unavailable|changed/);
 }
 const f=fixture(1),bad=Buffer.from('HTML-1.4\nSYNTHETIC ONLY\n%%EOF\n');f.source.documents[0].sha256=f.state.rows[0].sha256=hash(bad);f.state.download=async()=>({data:new Blob([bad])});await assert.rejects(original.loadYearOriginals(f.db,f.source),/changed/);
 const q=fixture();q.state.queryError=Error('outage');await assert.rejects(original.loadYearOriginals(q.db,q.source),/unavailable/);
});
test('caps and cancellation prevent excessive private downloads; empty archive is valid',async()=>{
 const f=fixture();for(const row of f.state.rows)row.file_size_bytes=20*1024*1024;
 await assert.rejects(original.loadYearOriginals(f.db,f.source),/limit/);assert.equal(f.calls.filter(c=>c[0]==='download').length,0);
 const many=fixture(501);await assert.rejects(original.loadYearOriginals(many.db,many.source),/limit/);assert.equal(many.calls.length,0);
 const aborted=fixture();const c=new AbortController();c.abort();await assert.rejects(original.loadYearOriginals(aborted.db,aborted.source,c.signal));assert.equal(aborted.calls.length,0);
 const empty=fixture(0);assert.equal((await original.loadYearOriginals(empty.db,empty.source)).length,0);assert.equal(empty.calls.length,0);
});
test('streamed ZIP exceeds buffered hosting limit and extracts byte-for-byte in bounded chunks',async()=>{
 const bytes=randomBytes(5*1024*1024),files=[{name:'documents/large.pdf',bytes}];
 const archive=await unzip(zip.accountantZipStream(files,{maxFiles:650,maxBytes:88*1024*1024}));
 assert.ok(archive.buffer.length>4.5*1024*1024);assert.deepEqual(archive.files.get(files[0].name),bytes);
 assert.throws(()=>zip.accountantZipStream([{name:'../bad',bytes}],{maxFiles:650,maxBytes:88*1024*1024}),/path/);
 assert.throws(()=>zip.accountantZipStream(files,{maxFiles:650,maxBytes:1024}),/bytes|limit/);
 const stream=zip.accountantZipStream(files,{maxFiles:650,maxBytes:88*1024*1024});await stream.cancel();
});
