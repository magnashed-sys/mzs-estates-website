import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exported={};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/accountancy/invoice-control.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,{exports:exported});
const {annualInvoiceControl}=exported;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function draft(n,supplier=n){
 return {id:id(n),supplier_relationship_id:id(supplier),legal_entity_id:id(99),
  supplier_invoice_number:'INV/2026-000'+n,invoice_date:'2026-10-05',
  supplier_name:'Synthetic supplier '+supplier,gross_cents:21175,archive_documents:[]};
}
function doc(n,category='supplier_invoice',date='2026-10-05',status='reviewed'){
 return {id:id(n),title:'Original',sha256:'a'.repeat(64),review_status:status,category,document_date:date};
}
test('no supplier payment ledger means no paid, unpaid, or overdue assertion',()=>{
 const c=draft(1);const result=annualInvoiceControl({costs:[c]});
 assert.equal(result.paymentReconciled,0);
 assert.equal(result.paymentVerificationAvailable,false);
 assert.equal(result.rows[0].payment_evidence_status,'not_reconciled_no_supplier_payment_ledger');
 assert.equal(result.rows[0].content_verification,'manual_comparison_required');
 assert.deepEqual([...result.rows[0].issues],[]);
});
test('matching archived supplier invoice metadata has no date or classification warning but is not content verified',()=>{
 const c=draft(1);c.archive_documents=[doc(20)];
 const result=annualInvoiceControl({costs:[c]});
 assert.equal(result.rows[0].invoice_original_count,1);
 assert.equal(result.rows[0].invoice_original_reviewed,true);
 assert.equal(result.exceptions.length,0);
 assert.equal(result.rows[0].content_verification,'manual_comparison_required');
});
test('different archived invoice date creates a non-mutating metadata exception',()=>{
 const c=draft(1);c.archive_documents=[doc(20,'supplier_invoice','2026-10-06')];
 const result=annualInvoiceControl({costs:[c]});
 assert.equal(result.datedOriginalMismatches,1);
 assert.ok(result.rows[0].issues.includes('archive_date_differs'));
});
test('a linked document classified as something else must not silently pass as supplier invoice',()=>{
 const c=draft(1);c.archive_documents=[doc(20,'purchase_deed')];
 const result=annualInvoiceControl({costs:[c]});
 assert.equal(result.classificationWarnings,1);
 assert.equal(result.rows[0].invoice_original_count,0);
 assert.ok(result.rows[0].issues.includes('archive_not_supplier_invoice'));
});
test('missing archive document date is unknown, not falsely interpreted as mismatch',()=>{
 const c=draft(1);c.archive_documents=[doc(20,'supplier_invoice',null)];
 const result=annualInvoiceControl({costs:[c]});
 assert.equal(result.datedOriginalMismatches,0);
 assert.equal(result.rows[0].archive_dates.length,0);
});
test('superseded documents do not count as supporting invoice evidence',()=>{
 const c=draft(1);c.archive_documents=[doc(20,'supplier_invoice','2026-10-01','superseded')];
 const result=annualInvoiceControl({costs:[c]});
 assert.equal(result.rows[0].invoice_original_count,0);
 assert.equal(result.datedOriginalMismatches,0);
});
test('same specific invoice reference, date and amount under two different suppliers is only possible double entry',()=>{
 const a=draft(1,1),b=draft(2,2);
 a.supplier_invoice_number='AA.0001-99';b.supplier_invoice_number='AA0001/99';
 const result=annualInvoiceControl({costs:[a,b]});
 assert.equal(result.possibleDoubleEntries,2);
 assert.ok(result.rows.every(r=>r.issues.includes('possible_double_entry')));
 assert.ok(result.rows.every(r=>r.payment_evidence_status==='not_reconciled_no_supplier_payment_ledger'));
});
test('generic invoice numbers, distinct amount, date or same supplier do not create false duplicate warning',()=>{
 const a=draft(1,1),b=draft(2,2),c=draft(3,3),d=draft(4,1);
 a.supplier_invoice_number='1';b.supplier_invoice_number='1';
 c.supplier_invoice_number='AB-123456';d.supplier_invoice_number='AB/123456';
 d.gross_cents=21176;
 const result=annualInvoiceControl({costs:[a,b,c,d]});
 assert.equal(result.possibleDoubleEntries,0);
});
test('supplier invoice metadata warnings are independent from a human review status',()=>{
 const a=draft(1);a.archive_documents=[doc(20,'supplier_invoice','2026-10-06','pending_review')];
 const result=annualInvoiceControl({costs:[a]});
 assert.equal(result.rows[0].invoice_original_reviewed,false);
 assert.equal(result.datedOriginalMismatches,1);
});
