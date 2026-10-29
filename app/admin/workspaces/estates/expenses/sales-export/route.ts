import {creditExport,type CreditNote} from '../../../../../../lib/finance/credit-notes';
import {NextRequest} from "next/server";
import {requireEstateAdmin} from "../../../../../../lib/security/estate-properties";
import {accountantCsv} from "../../../../../../lib/property-operations/finance";
import {buildAccountantZip,exportHash,exportBytes,type ArchiveFile} from "../../../../../../lib/property-operations/accountant-archive";
import {normalizeIssuedInvoice,receiptEvents,dateYear,type IssuedInvoice,type RecordedReceipt} from "../../../../../../lib/property-operations/sales-reconciliation";
export const dynamic="force-dynamic";
export const runtime="nodejs";
import {staffEnvironmentAvailable} from "../../../../../../lib/security/property-staff";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"};
const colsI=["source","invoice_id","issuer_id","invoice_number","invoice_date","source_document_id","gross_eur","net_eur","vat_eur","vat_note","currency"];
const colsR=["source","receipt_id","invoice_id","source_reference","receipt_type","original_received_on","administrative_reversed_on","vat_note","event","event_date","amount_eur"];
const colsX=["source","receipt_id","invoice_id","reason","amount_eur"];
export async function GET(request:NextRequest){
 if(!staffEnvironmentAvailable())return new Response(null,{status:404,headers});
 const {db}=await requireEstateAdmin();
 const q=new URL(request.url).searchParams,entity=q.get("entity")??"",rawYear=q.get("year")??"";
 if(!uuid.test(entity)||!/^20\d{2}$/.test(rawYear)||Number(rawYear)>2100)return new Response("Invalid entity or year.",{status:400,headers});
 const year=Number(rawYear);
 try{
  const {data:source,error:sourceError}=await db.rpc("mzs_ops_accountant_source",{p_entity:entity});
  if(sourceError||!source||source.issuer?.id!==entity||!Array.isArray(source.leases)||!Array.isArray(source.bookings)||!Array.isArray(source.rent_receipts)||!Array.isArray(source.guest_receipts)||!Array.isArray(source.external)||!Array.isArray(source.external_receipts)||!Array.isArray(source.imported)||!Array.isArray(source.imported_receipts)||!Array.isArray(source.services)||!Array.isArray(source.service_receipts)||!Array.isArray(source.credit_notes))throw Error("Incomplete accountant snapshot");
  const leases=source.leases as (IssuedInvoice&{contract_id:string})[],bookings=source.bookings as (IssuedInvoice&{booking_id:string})[];
  const issuer={data:source.issuer as {id:string;name:string}};
  const issued:IssuedInvoice[]=[
   ...(source.services as IssuedInvoice[]).map(x=>({...x,source:"standalone_invoice" as const})),
   ...leases.map(x=>({...x,source:"rental_contract" as const})),
   ...bookings.map(x=>({...x,source:"holiday_booking" as const})),
   ...(source.external as IssuedInvoice[]).map(x=>({...x,source:"external_cost_invoice" as const}))
  ];
  const credits=creditExport(source.credit_notes as CreditNote[],source.services,entity,year);
  const invoiceNumbers=new Set<string>();
  for(const x of issued){
   if(x.issuer_id!==entity||!x.number||invoiceNumbers.has(x.number))throw Error("Overlapping or missing issued number");
   invoiceNumbers.add(x.number);
  }
  for(const c of source.credit_notes as CreditNote[]){if(invoiceNumbers.has(c.number))throw Error('Duplicate credit number');invoiceNumbers.add(c.number);}
  const invoices=issued.filter(x=>dateYear(x.issued_on)===year)
   .map(x=>normalizeIssuedInvoice(x,entity,year));
  invoices.sort((a,b)=>a.invoice_date.localeCompare(b.invoice_date)||a.invoice_id.localeCompare(b.invoice_id));
  const leaseMap=new Map(leases.map(x=>[x.id,x])),
   bookingMap=new Map(bookings.map(x=>[x.booking_id,x]));
  if(bookingMap.size!==bookings.length)throw Error("Ambiguous booking");
  const externalMap=new Map((source.external as IssuedInvoice[]).map(x=>[x.id,x]));
  const externalReceipts=source.external_receipts as (RecordedReceipt&{invoice_id:string})[];
  const rentReceipts=source.rent_receipts as (RecordedReceipt&{invoice_id:string})[],guestReceipts=source.guest_receipts as (RecordedReceipt&{booking_id:string})[];
  const imported=source.imported as {id:string;issuer_id:string;number:string;issued_on:string;gross_cents:number;source_paid_cents:number;source_open_cents:number;excluded:boolean}[];
  const importedMap=new Map(imported.map(i=>[i.id,i]));if(importedMap.size!==imported.length||imported.some(i=>!uuid.test(i.id)||i.issuer_id!==entity||![i.gross_cents,i.source_paid_cents,i.source_open_cents].every(Number.isSafeInteger)||i.source_paid_cents+i.source_open_cents!==i.gross_cents))throw Error('Invalid imported references');
  const importedReceipts=source.imported_receipts as (RecordedReceipt&{invoice_id:string})[];
  const serviceMap=new Map((source.services as IssuedInvoice[]).map(i=>[i.id,i]));const serviceReceipts=source.service_receipts as (RecordedReceipt&{invoice_id:string})[];
  const receiptIds=new Set<string>();
  for(const row of [...rentReceipts,...guestReceipts,...externalReceipts,...importedReceipts,...serviceReceipts]){if(!uuid.test(row.id)||receiptIds.has(row.id))throw Error("Duplicate receipt source");receiptIds.add(row.id);}
  const events:Record<string,unknown>[]=[],exceptions:Record<string,unknown>[]=[];
  function record(row:RecordedReceipt,invoice:IssuedInvoice){
   const normalized=receiptEvents(row,invoice.id,year);
   events.push(...normalized.events);
   if(normalized.exception)exceptions.push(normalized.exception);
  }
  for(const r of rentReceipts){const i=leaseMap.get(r.invoice_id);if(!i)throw Error("Unmatched rent receipt");record({...r,source:"lease_payment"}, {...i,source:"rental_contract"});}
  for(const r of guestReceipts){const i=bookingMap.get(r.booking_id);if(!i)throw Error("Unmatched booking receipt");record({...r,source:"booking_receipt"}, {...i,source:"holiday_booking"});}
  for(const r of externalReceipts){const i=externalMap.get(r.invoice_id);if(!i)throw Error("Unmatched standalone receipt");record({...r,source:"external_receipt"},{...i,source:"external_cost_invoice"});}
  for(const r of importedReceipts){if(!importedMap.has(r.invoice_id))throw Error('Unmatched imported receipt');const normalized=receiptEvents({...r,source:'archive_receipt'},r.invoice_id,year);events.push(...normalized.events);if(normalized.exception)exceptions.push(normalized.exception);}
  for(const r of serviceReceipts){const i=serviceMap.get(r.invoice_id);if(!i)throw Error('Unmatched platform invoice receipt');record({...r,source:'service_receipt'},{...i,source:'standalone_invoice'});}
  events.sort((a,b)=>String(a.event_date).localeCompare(String(b.event_date))||String(a.receipt_id).localeCompare(String(b.receipt_id)));
  exceptions.sort((a,b)=>String(a.receipt_id).localeCompare(String(b.receipt_id)));
  const files:ArchiveFile[]=[],manifest:{name:string;sha256:string;bytes:number}[]=[];
  function add(name:string,contents:string){const bytes=exportBytes(contents);files.push({name,bytes});manifest.push({name,sha256:exportHash(bytes),bytes:bytes.length});}
  add('issued-credit-notes.csv',accountantCsv(['credit_id','credit_number','issued_on','issuer_id','original_invoice_id','original_invoice_number','net_eur','vat_eur','gross_eur','allocated_eur','reason','currency'],credits));
  add("issued-sales-invoices.csv",accountantCsv(colsI,invoices));
  add("registered-receipt-events.csv",accountantCsv(colsR,events));
  add("receipt-exceptions.csv",accountantCsv(colsX,exceptions));
  const referencedIds=new Set(events.filter(e=>e.source==='archive_receipt').map(e=>e.invoice_id));
  add('imported-invoice-references.csv',accountantCsv(['id','issuer_id','number','issued_on','gross_cents','source_paid_cents','source_open_cents','excluded'],imported.filter(i=>referencedIds.has(i.id))));
  add("README.txt",[
   "MZS ISSUED SALES AND REGISTERED RECEIPTS — PARTIAL ACCOUNTANT EXPORT",
   "Entity: "+issuer.data.name+" / "+entity,"Year: "+year,"Source snapshot: "+source.snapshot_at,
   "Includes platform standalone invoices, issued rental/booking invoices, externally issued historical-cost invoices and separately dated registered receipt events.",
   "Additional imported-invoice receipts and reversals are included by event date. Imported invoice references are historical context only; do not post them as new sales. Imported paid snapshots are not receipt events. Excluded source references remain labelled when needed to explain recorded events.",
   "Credit notes are separate signed sales adjustments, selected by credit issue year and allocated to the original invoice. Do not treat credit allocations as bank receipts or refunds. Original invoice sales remain unchanged.",
   "A receipt may relate to an invoice issued in another year.",
   "Administrative reversal does not establish a bank refund.",
   "Receipts with unknown dates are listed as undated exceptions in every selected year; no receipt year is inferred.",
   "Uninvoiced bookings and unattributable payments are outside this partial report.",
   "Rental invoice VAT/net components are blank and require accountant verification.",
   "External invoice amounts/VAT are copied from the issued document. Explicitly recorded standalone receipts and administrative reversals are included; no delivery or bank event is inferred.",
   "No source is changed, invoiced, paid or emailed."
  ].join("\n")+"\n");
  add("manifest.json",JSON.stringify({kind:"partial-sales-receipts",entity,year,
   invoice_rows:invoices.length,credit_rows:credits.length,receipt_events:events.length,exceptions:exceptions.length,
   statutory_complete:false,files:manifest},null,2)+"\n");
  const zip=buildAccountantZip(files);
  if(zip.length>4*1024*1024)throw Error("Export exceeds response limit");
  return new Response(new Uint8Array(zip),{headers:{...headers,"Content-Type":"application/zip",
   "Content-Disposition":'attachment; filename="MZS-Sales-Receipts-'+year+'-'+entity.slice(0,8)+'.zip"'}});
 }catch{return new Response("Incomplete financial source data: no export was created.",{status:503,headers});}
}
