import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {TextEncoder} from "node:util";
import {createRequire} from "node:module";
import {inflateRawSync} from "node:zlib";
const require=createRequire(import.meta.url);
const source=readFileSync(new URL("../lib/property-operations/accountant-archive.ts",import.meta.url),"utf8");
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exposed={};
vm.runInNewContext(code,{exports:exposed,require,Buffer,Uint8Array,TextEncoder,Set,Error});
const {buildAccountantZip,exportBytes,exportHash}=exposed;
function readZip(b){
 const buf=Buffer.from(b);let cursor=0;const entries=[];
 while(cursor+4<=buf.length && buf.readUInt32LE(cursor)===0x04034b50){
  const method=buf.readUInt16LE(cursor+8),size=buf.readUInt32LE(cursor+18),
    nameLen=buf.readUInt16LE(cursor+26),extra=buf.readUInt16LE(cursor+28);
  const name=buf.subarray(cursor+30,cursor+30+nameLen).toString("utf8");
  const raw=buf.subarray(cursor+30+nameLen+extra,cursor+30+nameLen+extra+size);
  entries.push({name,data:method===8?inflateRawSync(raw):raw});
  cursor+=30+nameLen+extra+size;
 }
 assert.equal(buf.readUInt32LE(buf.length-22),0x06054b50);
 assert.equal(buf.readUInt16LE(buf.length-22+10),entries.length);
 return entries;
}
test("ZIP rehearsal can be extracted and preserves UTF-8, SHA-256 and reproducibility",()=>{
 const sources=[
  {name:"README.txt",bytes:exportBytes("MZS test only\n")},
  {name:"purchase-invoices.csv",bytes:exportBytes("nummer,bedrag\nA-1,12.10\n")},
  {name:"documents/example.pdf",bytes:exportBytes("%PDF-1.4\nfixture\n")}
 ];
 const zip=buildAccountantZip(sources);
 assert.ok(zip.length>30);
 const records=readZip(zip);
 assert.deepEqual(records.map(r=>r.name),sources.map(r=>r.name));
 assert.equal(records[2].data.toString("utf8"),"%PDF-1.4\nfixture\n");
 assert.equal(exportHash(records[1].data).length,64);
 assert.deepEqual(Buffer.from(zip),Buffer.from(buildAccountantZip(sources)));
});
test("archive rejects zip slip, name duplication, missing source and oversized buffers",()=>{
 for(const name of ["../secret.txt","/secret.txt","documents//a.pdf","documents/../a.pdf"]){
  assert.throws(()=>buildAccountantZip([{name,bytes:exportBytes("x")}]),/path/);
 }
 assert.throws(()=>buildAccountantZip([
  {name:"README.txt",bytes:exportBytes("A")},{name:"README.txt",bytes:exportBytes("B")}
 ]),/path/);
 assert.throws(()=>buildAccountantZip([]),/count/);
 assert.throws(()=>buildAccountantZip([{name:"large.bin",bytes:new Uint8Array(24*1024*1024+1)}]),/bytes|limit/);
});
