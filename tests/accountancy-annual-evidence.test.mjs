import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/accountancy/annual-evidence.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,{exports});
const {annualEvidenceReadiness}=exports;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const base=(n,source_document_status='missing')=>({
 id:id(n),invoice_date:'2026-01-10',supplier_name:'Synthetic Supplier',
 supplier_invoice_number:'INV-SYNTH-'+n,property_name:'Synthetic Property',
 gross_cents:12100,source_document_status,archive_documents:[]
});
test('missing original is never inferred from a filename or an unverified flag',()=>{
 const cost=base(1);
 const x=annualEvidenceReadiness({costs:[cost],reviews:[]});
 assert.equal(x.total,1);assert.equal(x.missingOriginals,1);assert.equal(x.pendingCostReview,1);
 assert.equal(x.pendingArchiveReview,0);assert.equal(x.unresolvedCount,1);
 assert.deepEqual([...x.rows[0].issues],['missing_original','cost_pending_review']);
});
test('private verified link takes precedence over the immutable missing flag',()=>{
 const cost=base(2);cost.archive_documents=[{id:id(20),title:'Original',
 sha256:'a'.repeat(64),review_status:'reviewed'}];
 const x=annualEvidenceReadiness({costs:[cost],reviews:[{draft_id:cost.id,review_status:'reviewed'}]});
 assert.equal(x.originalsRetained,1);assert.equal(x.missingOriginals,0);
 assert.equal(x.unresolvedCount,0);assert.equal(x.rows[0].source,'private_archive');
});
test('archived PDF can be retained but still await document review',()=>{
 const cost=base(3);cost.archive_documents=[{id:id(21),title:'Original',sha256:'b'.repeat(64),review_status:'needs_attention'}];
 const x=annualEvidenceReadiness({costs:[cost],reviews:[{draft_id:cost.id,review_status:'reviewed'}]});
 assert.equal(x.missingOriginals,0);assert.equal(x.pendingArchiveReview,1);
 assert.deepEqual([...x.unresolved[0].issues],['archive_pending_review']);
});
test('superseded originals alone do not pass retention checks',()=>{
 const cost=base(4);cost.archive_documents=[{id:id(22),title:'Old file',sha256:'c'.repeat(64),review_status:'superseded'}];
 const x=annualEvidenceReadiness({costs:[cost],reviews:[]});
 assert.equal(x.rows[0].source,'not_retained');assert.equal(x.missingOriginals,1);
});
test('staging isolated source requires both a retained PDF ID and a valid hash',()=>{
 const cost=base(5,'retained_purchase_pdf');cost.source_pdf_id=id(23);cost.source_pdf_sha256='d'.repeat(64);
 assert.equal(annualEvidenceReadiness({costs:[cost],reviews:[]}).missingOriginals,0);
 cost.source_pdf_sha256='not-a-fingerprint';
 assert.equal(annualEvidenceReadiness({costs:[cost],reviews:[]}).missingOriginals,1);
});
test('all entries including excluded and clean costs stay in reconciliation, urgent issues first',()=>{
 const c1=base(1),c2=base(2),c3=base(3);
 c1.invoice_date='2026-12-15';
 c2.invoice_date='2026-01-20';c2.archive_documents=[{id:id(25),title:'Source',sha256:'a'.repeat(64),review_status:'pending_review'}];
 c3.invoice_date='2026-01-01';c3.archive_documents=[{id:id(26),title:'Source',sha256:'a'.repeat(64),review_status:'reviewed'}];
 const reviews=[{draft_id:c1.id,review_status:'excluded'},{draft_id:c2.id,review_status:'reviewed'},{draft_id:c3.id,review_status:'reviewed'}];
 const result=annualEvidenceReadiness({costs:[c1,c2,c3],reviews});
 assert.equal(result.total,3);assert.equal(result.unresolvedCount,2);
 assert.equal(result.unresolved[0].draft_id,c1.id);
 assert.equal(result.unresolved[1].draft_id,c2.id);
 assert.equal(result.rows[2].issues.length,0);
});
