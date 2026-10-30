import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const moduleText=ts.transpileModule(read('lib/accountancy/batch-classifier.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};vm.runInNewContext(moduleText,{exports});
const classify=exports.classifyPrivateAccountancyPdf;
test('historical Gamaservi original filenames map to correct legal years without invented invoice dates',()=>{
 const old=['4234','4690','5387','5693','6374'],next=['346','823','1499','2050','2434','2953','3303','3518','3866','5246'];
 const all=[...old.map(n=>['2023',n]),...next.map(n=>['2024',n])];
 for(const [year,number] of all){
  const row=classify('Factura1-'+year+'-1-'+number+' MZS ESTATES, S.L..pdf',2026);
  assert.equal(row.category,'supplier_invoice');assert.equal(row.fiscal_year,Number(year));
  assert.equal(row.period_label,year+'/1/'+number);assert.equal(row.document_date,null);
  assert.equal(row.review_status,'pending_review');
  assert.match(row.notes,/No invoice, payment or VAT deduction/);
 }
});
test('tax PDFs remain reference only and file names are validated',()=>{
 assert.equal(classify('70932 MZS ESTATES, S.L. - MOD.303 1º TRIM.2024.pdf',2026).category,'vat_return');
 assert.equal(classify('70932 MZS ESTATES, S.L. - MOD.200 2023.pdf',2026).category,'corporate_tax');
 assert.equal(classify('70932 MZS ESTATES, S.L. - MOD.390 0A 2023.pdf',2026).category,'vat_summary');
 for(const bad of ['../../../financials.pdf','f.txt','bad\nname.pdf'])assert.throws(()=>classify(bad,2026));
});
test('bulk UI preserves existing authenticated private upload and immutable audit flow',()=>{
 const client=read('app/admin/workspaces/accountancy/documents/BulkArchiveUpload.tsx');
 const parent=read('app/admin/workspaces/accountancy/documents/page.tsx');
 assert.match(parent,/requireEstateAdmin/);
 assert.match(parent,/BulkArchiveUpload/);
 assert.match(client,/db\.storage\.from\(ARCHIVE_BUCKET\)\.upload/);
 assert.match(client,/registerDocument\(form\)/);
 assert.match(client,/upsert:false/);
 assert.match(client,/MAX_PDF_BYTES/);
 assert.match(client,/new Set/);
 assert.doesNotMatch(client,/mzs_ops_expense_drafts|mzs_accountancy_supplier_payments|service_role/);
});
