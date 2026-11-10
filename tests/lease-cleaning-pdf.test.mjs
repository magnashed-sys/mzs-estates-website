import test from 'node:test';import assert from 'node:assert/strict';
import ts from 'typescript';import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';import {PDFDocument} from 'pdf-lib';
const require=createRequire(import.meta.url);
const load=file=>{const exports={};new Function('exports','require',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(exports,n=>n==='./lease-cleaning'?load('lib/estates/lease-cleaning.ts'):require(n));return exports;};
const {invoicePdf}=load('lib/estates/invoice-pdf.ts');
const {validateLeaseCleaning}=load('lib/estates/lease-cleaning.ts');
const fixture=(count=1)=>{
 const cleaning={version:1,description:'Schoonmaak\nGrote kantoor 1 x per 2 weken\nKleine kantoor 1 x per maand\nConform bijlage 1: urenstaat.',customer_reference:'SYNTHETIC COST CENTRE',cutoff:'2026-11-10',entries:Array.from({length:count},(_,n)=>({visit_id:'synthetic-'+n,worked_on:'2026-11-08',description:'Schoonmaak en controle kantoor',actual_minutes:45,approved_minutes:45,hours:1,rate_cents:2500,net_cents:2500})),hours:count,net_cents:2500*count,vat_cents:525*count,gross_cents:3025*count};
 const lines=[{description:'Huur kantoor',vat:'exempt',net:1000,tax:0,total:1000},{source:'zorgbalans_cleaning',description:cleaning.description,vat:'21',net:25*count,tax:5.25*count,total:30.25*count}];
 return {number:'SYNTHETIC-CONCEPT',issued_on:'2026-11-14',due_date:'2026-11-30',total:1000+30.25*count,payload:{subject:'Huur december 2026',period_start:'2026-12-01',period_end:'2026-12-31',subtotal:1000+25*count,tax_total:5.25*count,lines,snapshot:{issuer_name:'Synthetic issuer',issuer_address:'Test address',issuer_iban:'TEST-IBAN',tenant_name:'Synthetic tenant',tenant_address:'Test address',cleaning}}};
};
test('rental PDF appends the frozen hours statement, paginates long descriptions and reconciles',async()=>{
 const small=fixture();const bytes=await invoicePdf(small);assert.equal((await PDFDocument.load(bytes)).getPageCount(),2);
 if(process.env.MZS_CLEANING_PDF_PREVIEW)writeFileSync(process.env.MZS_CLEANING_PDF_PREVIEW,bytes);
 const large=fixture(60);large.payload.snapshot.cleaning.entries[0].description='Synthetic long description '.repeat(80);
 assert.ok((await PDFDocument.load(await invoicePdf(large))).getPageCount()>=4);
 const changed=structuredClone(small);changed.payload.snapshot.cleaning.entries[0].approved_minutes=75;
 await assert.rejects(invoicePdf(changed),/does not reconcile/);
 delete changed.payload.snapshot.cleaning;await assert.rejects(invoicePdf(changed),/missing/);
 const dup=fixture(2);dup.payload.snapshot.cleaning.entries[1].visit_id=dup.payload.snapshot.cleaning.entries[0].visit_id;
 assert.throws(()=>validateLeaseCleaning(dup.payload.snapshot.cleaning,dup.payload.lines),/does not reconcile/);
 const mismatch=fixture();mismatch.payload.lines[1].net=50;await assert.rejects(invoicePdf(mismatch),/does not match/);
 const ordinary=fixture();delete ordinary.payload.snapshot.cleaning;ordinary.payload.lines.pop();
 assert.equal((await PDFDocument.load(await invoicePdf(ordinary))).getPageCount(),1,'ordinary rental PDFs are unaffected');
});
