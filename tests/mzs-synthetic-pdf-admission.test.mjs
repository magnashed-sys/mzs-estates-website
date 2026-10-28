import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {PDFDocument} from "pdf-lib";
import {buildMzsSyntheticExpensePdf} from "../scripts/generate-mzs-synthetic-expense-pdf.mjs";

const source=readFileSync(new URL("../lib/property-operations/synthetic-pdf-admission.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const subject={};
vm.runInNewContext(compiled,{exports:subject,Buffer});
const {checkSyntheticExpensePdf,SYNTHETIC_PDF_MARKER,MAX_SYNTHETIC_PDF_BYTES}=subject;
const sample=buildMzsSyntheticExpensePdf();

test("Generated fictional fixture is a structurally readable one-page PDF and explicitly synthetic",async()=>{
 assert.equal(SYNTHETIC_PDF_MARKER,"MZS-SYNTHETIC-EXPENSE-TEST-2026");
 assert.ok(Buffer.isBuffer(sample));
 assert.equal(checkSyntheticExpensePdf(sample).ok,true);
 const pdf=await PDFDocument.load(sample,{updateMetadata:false});
 assert.equal(pdf.getPageCount(),1);
 assert.ok(sample.toString("latin1").includes("NOT A SUPPLIER INVOICE"));
});

test("Genuine or unmarked PDF files must be rejected even with a valid PDF header and tail",()=>{
 const original=sample.toString("latin1");
 const unmarked=Buffer.from(original.replace("%"+SYNTHETIC_PDF_MARKER,"%"+"NOT-A-TEST-DOCUMENT"),"latin1");
 assert.equal(checkSyntheticExpensePdf(unmarked).ok,false);
 assert.equal(checkSyntheticExpensePdf(Buffer.from("NOT A PDF")).ok,false);
 assert.equal(checkSyntheticExpensePdf(Buffer.from("PK\x03\x04"+original,"latin1")).ok,false);
 assert.equal(checkSyntheticExpensePdf(Buffer.from(original+"INJECTED","latin1")).ok,false);
 assert.equal(checkSyntheticExpensePdf(Buffer.from(original.slice(0,-15),"latin1")).ok,false);
 assert.equal(checkSyntheticExpensePdf(Buffer.alloc(MAX_SYNTHETIC_PDF_BYTES+1)).ok,false);
});

test("Obvious active, embedded and encrypted PDF instructions fail closed in Staging",()=>{
 for(const directive of [
  "/JavaScript","/JS","/OpenAction","/AA","/Launch","/EmbeddedFile",
  "/EmbeddedFiles","/RichMedia","/XFA","/AcroForm","/Encrypt"
 ]){
  const changed=Buffer.from(sample.toString("latin1").replace("trailer\n",
    "%"+directive+"\ntrailer\n"),"latin1");
  assert.equal(checkSyntheticExpensePdf(changed).ok,false,directive);
 }
});

test("The upload route checks the same synthetic fixture before any Storage mutation",()=>{
 const route=readFileSync(new URL("../app/admin/workspaces/estates/expenses/documents/route.ts",import.meta.url),"utf8");
 assert.match(route,/checkSyntheticExpensePdf\(bytes\)/);
 assert.ok(route.indexOf("checkSyntheticExpensePdf(bytes)")<route.indexOf(".storage.from(bucket).upload("));
 assert.match(route,/confirmed_synthetic_file/);
 assert.match(route,/originIsValid\(request\)/);
 assert.doesNotMatch(route,/service_role|mzs_booking_invoices|mzs_capital_payments|sendMail/);
});
