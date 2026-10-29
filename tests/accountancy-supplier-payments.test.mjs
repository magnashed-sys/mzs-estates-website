import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exported={};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/accountancy/supplier-payments.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,{exports:exported,process:{env:{}}});
const {supplierPaymentEnvironment,paymentOverview}=exported;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const cost={id:id(1),legal_entity_id:id(2),supplier_invoice_number:'SYNTH-2026-1',gross_cents:10000};
const entry=(n,amount,reversed_at=null)=>({
 id:id(n),draft_id:cost.id,issuer_id:cost.legal_entity_id,
 amount_cents:amount,paid_on:'2026-10-20',reference:'Synthetic test',recorded_by:id(9),
 created_at:'2026-10-20T10:00:00Z',reversed_at,
 reversed_by:reversed_at?id(9):null,reversal_reason:reversed_at?'Incorrect amount':null
});
test('supplier payment functions never activate on production or wrong preview environment',()=>{
 const e={VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co',MZS_SUPPLIER_PAYMENTS_ENABLED:'true'};
 assert.equal(supplierPaymentEnvironment(e),true);
 assert.equal(supplierPaymentEnvironment({...e,VERCEL_ENV:'production'}),false);
 assert.equal(supplierPaymentEnvironment({...e,NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co'}),false);
 assert.equal(supplierPaymentEnvironment({...e,MZS_SUPPLIER_PAYMENTS_ENABLED:'false'}),false);
});
test('payment status is an administrative entry, never bank-verified, even at full invoice amount',()=>{
 const a=paymentOverview([cost],[{draft_id:cost.id,review_status:'reviewed'}],[entry(3,10000)]);
 assert.equal(a[0].recorded_cents,10000);
 assert.equal(a[0].remaining_unrecorded_cents,0);
 assert.equal(a[0].bank_status,'not_reconciled');
});
test('partial payments and reversals preserve original amounts and avoid double count',()=>{
 const a=paymentOverview([cost],[],[entry(3,4000),entry(4,2000,'2026-10-21T12:00:00Z'),entry(5,3500)]);
 assert.equal(a[0].recorded_cents,7500);
 assert.equal(a[0].reversed_cents,2000);
 assert.equal(a[0].remaining_unrecorded_cents,2500);
 assert.equal(a[0].payment_count,2);
 assert.equal(a[0].reversal_count,1);
 assert.equal(a[0].bank_status,'not_reconciled');
 assert.equal(a[0].review_status,'pending');
});
test('source cannot credit another entity, unknown draft, duplicate UUID or exceed invoice gross',()=>{
 assert.throws(()=>paymentOverview([cost],[],[{...entry(3,100),issuer_id:id(20)}]),/inconsistent/);
 assert.throws(()=>paymentOverview([cost],[],[{...entry(3,100),draft_id:id(20)}]),/inconsistent/);
 assert.throws(()=>paymentOverview([cost],[],[entry(3,100),entry(3,200)]),/inconsistent/);
 assert.throws(()=>paymentOverview([cost],[],[entry(3,10001)]),/exceeds invoice/);
});
test('PGlite migration validates real SQL roles, idempotence, partials, reversals and immutable history',()=>{
 const r=spawnSync(process.execPath,['tests/db/accountancy-supplier-payments.cjs'],{
  encoding:'utf8',timeout:90000,maxBuffer:3*1024*1024
 });
 assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
});
