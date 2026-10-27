import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import ts from "typescript";
import {PDFDocument} from "pdf-lib";
const require=createRequire(import.meta.url);
function load(file,overrides={}){
 const code=ts.transpileModule(readFileSync(new URL("../"+file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 new Function("require","module","exports",code)(name=>name in overrides?overrides[name]:require(name),module,module.exports);
 return module.exports;
}
const model=load("lib/estates/booking-invoice.ts");
test("payment schedule uses calendar dates and reconciles rounded instalments",()=>{
 assert.deepEqual(model.bookingPaymentSchedule(4845,2422.5,"2027-07-08","2026-10-05"),
 {total:4845,paid:2422.5,deposit:2422.5,finalInstalment:2422.5,outstanding:2422.5,credit:0,depositDue:"2026-10-12",balanceDue:"2027-06-24"});
 const s=model.bookingPaymentSchedule(99.99,120,"2028-03-01",null);
 assert.equal(Math.round(s.deposit*100)+Math.round(s.finalInstalment*100),9999);assert.equal(s.balanceDue,"2028-02-16");
 assert.equal(s.depositDue,null);assert.equal(s.outstanding,0);assert.equal(s.credit,20.01);
 assert.throws(()=>model.shiftDate("2027-02-30",7),/Invalid/);
});
test("missing addresses are omitted and no-VAT treatment is issuer-specific",()=>{
 assert.equal(model.invoiceAddress({}),"");
 assert.equal(model.invoiceAddress(null),"");
 assert.equal(model.invoiceAddress({street:"Calle Sol 1",postal_code:"07800",city:"Ibiza",country:"España"}),"Calle Sol 1\n07800 Ibiza\nEspaña");
 assert.equal(model.isMaseIssuer({name:"Mase Estates SL",tax_id:"B16396079"}),true);
 assert.equal(model.isMaseIssuer({name:"Another landlord",tax_id:"B16396079"}),false);
 assert.equal(model.bookingInvoiceTerms.length,3);
});
test("trilingual invoice renders valid PDF with empty recipient address",async()=>{
 const renderer=load("lib/estates/booking-invoice-pdf.ts",{"./booking-invoice":model});
 const bytes=await renderer.bookingInvoicePdf({
  issuer:{name:"Mase Estates SL",address:"Carrer de Benizamid 8 17\n07800 Eivissa, Ibiza, Spain",tax_id:"B16396079",iban:"ES8521005675070200256149"},
  recipient:"Patrick Engelhart",recipientAddress:"",property:"Villa La Nucia",reference:"2420",
  checkIn:"2027-07-08",checkOut:"2027-07-25",bookedOn:"2026-10-05",total:4845,paid:2422.5,receiptDates:["2026-10-19"]
 });
 const doc=await PDFDocument.load(bytes);assert.equal(doc.getPageCount(),1);
 if(process.env.MZS_INVOICE_PREVIEW_PATH)writeFileSync(process.env.MZS_INVOICE_PREVIEW_PATH,bytes);
});
test("PDF route refuses owner stays and fails closed on payment errors",async()=>{
 const id="a926bd61-e85a-44db-aeea-9486d3f414cd";
 const fixture={
  rental_bookings:[{id,status:"confirmed",is_test:false,quoted_total_eur:100,project_id:"p",user_id:"u",check_in:"2027-07-08",check_out:"2027-07-25",created_at:"2026-10-05T12:00:00Z"}],
  mzs_owner_stay_requests:[],mzs_booking_legacy_sources:[{invoice_issuer_id:"e",invoice_recipient_name:"Guest",source_address:{},original_booking_number:"2420",confirmation_date:"2026-10-05"}],
  mzs_booking_legacy_overrides:[],mzs_booking_invoice_drafts:[],mzs_booking_invoices:[],
  mzs_lease_issuers:[{name:"Mase Estates SL",tax_id:"B16396079",address:"Ibiza Spain",iban:"ES123"}],
  projects:[{title:"Villa"}],profiles:[{full_name:"Guest"}],
  mzs_booking_receipts:[{id:"r",amount:50,received_on:"2026-10-19",reversed_at:null},{id:"reversed",amount:40,received_on:"2026-10-18",reversed_at:"2026-10-20"}]
 };
 let errorTable=null,seen=null,denied=false;
 const db={from:table=>builder(table),rpc:()=>builder("rental_bookings")};
 function builder(table){
  let single=false,active=false;
  const q={select(){return q},eq(){return q},limit(){return q},order(){return q},range(){return q},
   is(){active=true;return q},maybeSingle(){single=true;return q},
   then(resolve,reject){let data=fixture[table]||[];if(active)data=data.filter(r=>!r.reversed_at);
    return Promise.resolve({data:single?(data[0]||null):data,error:errorTable===table?{message:"Unavailable"}:null}).then(resolve,reject);}
  };return q;
 }
 const route=load("app/admin/bookings/[id]/invoice/pdf/route.ts",{
  "../../../../../../lib/security/estate-properties":{requireEstateAdmin:async()=>{if(denied)throw Error("unauthorized");return {db};}},
  "../../../../../../lib/estates/booking-invoice":model,
  "../../../../../../lib/estates/booking-invoice-pdf":{bookingInvoicePdf:async data=>{seen=data;return Buffer.from("PDF");}}
 });
 const get=()=>route.GET(new Request("https://example.test"),{params:Promise.resolve({id})});
 assert.equal((await get()).status,200);assert.equal(seen.paid,50);assert.equal(seen.recipientAddress,"");
 fixture.mzs_owner_stay_requests=[{id:"owner"}];assert.equal((await get()).status,409);
 fixture.mzs_owner_stay_requests=[];errorTable="mzs_booking_receipts";assert.equal((await get()).status,503);
 denied=true;await assert.rejects(get(),/unauthorized/);
});
