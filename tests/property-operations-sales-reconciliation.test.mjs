import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const filename="lib/property-operations/sales-reconciliation.ts";
const source=readFileSync(new URL("../"+filename,import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(js,{exports,Date,Number,String,Error});
const {euroCents,centsEuro,dateYear,normalizeIssuedInvoice,receiptEvents}=exports;
const issuer="11111111-1111-4111-8111-111111111111";
const invoice="22222222-2222-4222-8222-222222222222";
const contract="33333333-3333-4333-8333-333333333333";
const payment="44444444-4444-4444-8444-444444444444";
test("financial sources use exact decimal cents, not floating point sums",()=>{
 assert.equal(euroCents("0.01"),1);
 assert.equal(euroCents("149898.11"),14989811);
 assert.equal(euroCents("50"),5000);
 assert.equal(centsEuro(14989811),"149898.11");
 for(const bad of ["1.999","1,00","-1.00",null,"Infinity","NaN",1.237])
  assert.throws(()=>euroCents(bad));
});
test("issued booking tax components must reconcile; rental invoice tax stays unknown",()=>{
 const row={source:"holiday_booking",id:invoice,issuer_id:issuer,booking_id:contract,
  issued_on:"2026-10-14",number:"BOOK-12",total:"121.00",net_total:"100.00",vat_total:"21.00"};
 const result=normalizeIssuedInvoice(row,issuer,2026);
 assert.equal(result.gross_eur,"121.00");assert.equal(result.net_eur,"100.00");
 assert.equal(result.vat_eur,"21.00");assert.equal(result.vat_note,"");
 const rental=normalizeIssuedInvoice({...row,source:"rental_contract",contract_id:contract,
   net_total:undefined,vat_total:undefined},issuer,2026);
 assert.equal(rental.vat_eur,"");
 assert.match(rental.vat_note,/verify/);
 assert.throws(()=>normalizeIssuedInvoice({...row,vat_total:"19.00"},issuer,2026),/mismatch/);
 assert.throws(()=>normalizeIssuedInvoice(row,"55555555-5555-4555-8555-555555555555",2026),/attribut/);
 assert.throws(()=>normalizeIssuedInvoice(row,issuer,2025),/attribut/);
});
test("recorded receipt and later administrative reversal are distinct annual events",()=>{
 const r={source:"lease_payment",id:payment,amount:"120.00",received_on:"2026-12-20",
  reversed_at:"2027-01-02T10:00:00Z",reference:"B-1"};
 const issued2026=receiptEvents(r,invoice,2026);
 assert.equal(issued2026.events.length,1);
 assert.equal(issued2026.events[0].event,"recorded_receipt");
 assert.equal(issued2026.events[0].amount_eur,"120.00");
 const reversed2027=receiptEvents(r,invoice,2027);
 assert.equal(reversed2027.events.length,1);
 assert.equal(reversed2027.events[0].event,"administrative_reversal");
 assert.equal(reversed2027.events[0].amount_eur,"-120.00");
});
test("undated historical settlements are exceptions, not invented receipt dates",()=>{
 const r={source:"booking_receipt",id:payment,amount:"500.00",received_on:null,
  reversed_at:null,reference:"OLD-1",receipt_type:"historical_settlement"};
 const x=receiptEvents(r,invoice,2026);
 assert.equal(x.events.length,0);
 assert.match(x.exception.reason,/unknown/);
 assert.equal(dateYear(null),null);
 assert.throws(()=>dateYear("2026-02-30"),/Invalid/);
});
test("sales export stays scoped to active admin in Staging and does not include unissued drafts",()=>{
 const route=readFileSync(new URL("../app/admin/workspaces/estates/expenses/sales-export/route.ts",import.meta.url),"utf8");
 assert.match(route,/process\.env\.VERCEL_ENV!=="preview"/);
 assert.match(route,/await requireEstateAdmin\(\)/);
 assert.match(route,/eq\("issuer_id",entity\)/);
 assert.match(route,/issued-sales-invoices\.csv/);
 assert.match(route,/registered-receipt-events\.csv/);
 assert.match(route,/receipt-exceptions\.csv/);
 assert.match(route,/no-store/);
 assert.match(route,/complete|Onvolledige/i);
 assert.doesNotMatch(route,/\bservice_role\b|sendMail\(|mzs_booking_invoice_drafts/);
});
