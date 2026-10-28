import {NextRequest} from "next/server";
import {requireEstateAdmin} from "../../../../../../lib/security/estate-properties";
import {accountantCsv} from "../../../../../../lib/property-operations/finance";
import {buildAccountantZip,exportHash,exportBytes,type ArchiveFile} from "../../../../../../lib/property-operations/accountant-archive";
import {normalizeIssuedInvoice,receiptEvents,dateYear,type IssuedInvoice,type RecordedReceipt} from "../../../../../../lib/property-operations/sales-reconciliation";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const staging="https://senonkpxdtlhyhrubicg.supabase.co";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"};
const colsI=["source","invoice_id","issuer_id","invoice_number","invoice_date","source_document_id","gross_eur","net_eur","vat_eur","vat_note","currency"];
const colsR=["source","receipt_id","invoice_id","source_reference","receipt_type","original_received_on","administrative_reversed_on","vat_note","event","event_date","amount_eur"];
const colsX=["source","receipt_id","invoice_id","reason","amount_eur"];
async function readAll(query:()=>any,cap=3000):Promise<any[]>{
 const rows:any[]=[],seen=new Set<string>();let count:number|null=null;
 for(let offset=0;offset<cap;offset+=100){
  const r=await query().range(offset,offset+99);
  if(r.error||!Array.isArray(r.data)||!Number.isSafeInteger(r.count)||r.count>cap)throw Error("Incomplete register");
  if(count===null)count=r.count;
  if(count!==r.count)throw Error("Register changed during read");
  for(const x of r.data){if(!x.id||seen.has(x.id))throw Error("Duplicate source");seen.add(x.id);rows.push(x);}
  if(rows.length===count)return rows;
  if(r.data.length<100)throw Error("Incomplete pagination");
 }
 throw Error("Export cap exceeded");
}
async function linked(db:any,table:string,key:string,ids:string[],fields:string){
 const all:any[]=[],seen=new Set<string>();
 for(let i=0;i<ids.length;i+=50){
  const subset=ids.slice(i,i+50);
  const rows=await readAll(()=>db.from(table).select(fields,{count:"exact"}).in(key,subset).order("id"));
  for(const x of rows){if(seen.has(x.id))throw Error("Duplicate receipt");seen.add(x.id);all.push(x);}
 }
 return all;
}
export async function GET(request:NextRequest){
 if(process.env.VERCEL_ENV!=="preview"||process.env.NEXT_PUBLIC_SUPABASE_URL!==staging)return new Response(null,{status:404,headers});
 const {db}=await requireEstateAdmin();
 const q=new URL(request.url).searchParams,entity=q.get("entity")??"",rawYear=q.get("year")??"";
 if(!uuid.test(entity)||!/^20\d{2}$/.test(rawYear)||Number(rawYear)>2100)return new Response("Ongeldige entiteit of jaar.",{status:400,headers});
 const year=Number(rawYear);
 try{
  const issuer=await db.from("mzs_lease_issuers").select("id,name").eq("id",entity).maybeSingle();
  if(issuer.error||!issuer.data)throw Error("Unknown entity");
  const [leases,bookings]=await Promise.all([
   readAll(()=>db.from("mzs_lease_invoices").select("id,issuer_id,contract_id,number,issued_on,total",{count:"exact"}).eq("issuer_id",entity).order("id")),
   readAll(()=>db.from("mzs_booking_invoices").select("id,issuer_id,booking_id,number,issued_on,total,net_total,vat_total",{count:"exact"}).eq("issuer_id",entity).order("id"))
  ]);
  const issued:IssuedInvoice[]=[
   ...leases.map(x=>({...x,source:"rental_contract" as const})),
   ...bookings.map(x=>({...x,source:"holiday_booking" as const}))
  ];
  const invoiceNumbers=new Set<string>();
  for(const x of issued){
   if(x.issuer_id!==entity||!x.number||invoiceNumbers.has(x.number))throw Error("Overlapping or missing issued number");
   invoiceNumbers.add(x.number);
  }
  const invoices=issued.filter(x=>dateYear(x.issued_on)===year)
   .map(x=>normalizeIssuedInvoice(x,entity,year));
  invoices.sort((a,b)=>a.invoice_date.localeCompare(b.invoice_date)||a.invoice_id.localeCompare(b.invoice_id));
  const leaseMap=new Map(leases.map(x=>[x.id,x])),
   bookingMap=new Map(bookings.map(x=>[x.booking_id,x]));
  if(bookingMap.size!==bookings.length)throw Error("Ambiguous booking");
  const [rentReceipts,guestReceipts]=await Promise.all([
   linked(db,"mzs_lease_payments","invoice_id",leases.map(x=>x.id),
    "id,invoice_id,amount,received_on,reference,reversed_at"),
   linked(db,"mzs_booking_receipts","booking_id",bookings.map(x=>x.booking_id),
    "id,booking_id,amount,received_on,reference,receipt_type,reversed_at")
  ]);
  const events:Record<string,unknown>[]=[],exceptions:Record<string,unknown>[]=[];
  function record(row:RecordedReceipt,invoice:IssuedInvoice){
   const normalized=receiptEvents(row,invoice.id,year);
   events.push(...normalized.events);
   if(normalized.exception&&dateYear(invoice.issued_on)===year)exceptions.push(normalized.exception);
  }
  for(const r of rentReceipts){const i=leaseMap.get(r.invoice_id);if(!i)throw Error("Unmatched rent receipt");record({...r,source:"lease_payment"}, {...i,source:"rental_contract"});}
  for(const r of guestReceipts){const i=bookingMap.get(r.booking_id);if(!i)throw Error("Unmatched booking receipt");record({...r,source:"booking_receipt"}, {...i,source:"holiday_booking"});}
  events.sort((a,b)=>String(a.event_date).localeCompare(String(b.event_date))||String(a.receipt_id).localeCompare(String(b.receipt_id)));
  exceptions.sort((a,b)=>String(a.receipt_id).localeCompare(String(b.receipt_id)));
  const files:ArchiveFile[]=[],manifest:{name:string;sha256:string;bytes:number}[]=[];
  function add(name:string,contents:string){const bytes=exportBytes(contents);files.push({name,bytes});manifest.push({name,sha256:exportHash(bytes),bytes:bytes.length});}
  add("issued-sales-invoices.csv",accountantCsv(colsI,invoices));
  add("registered-receipt-events.csv",accountantCsv(colsR,events));
  add("receipt-exceptions.csv",accountantCsv(colsX,exceptions));
  add("README.txt",[
   "MZS STAGING SALES AND RECEIPT REHEARSAL — NOT STATUTORY ACCOUNTS",
   "Entity: "+issuer.data.name+" / "+entity,"Year: "+year,
   "Includes issued rental/booking invoices and separately dated registered receipt events.",
   "A receipt may relate to an invoice issued in another year.",
   "Administrative reversal does not establish a bank refund.",
   "Historical receipts with unknown date are exceptions in the invoice issue year.",
   "Uninvoiced bookings and unattributable payments are outside this partial report.",
   "Rental invoice VAT/net components are blank and require accountant verification.",
   "No source is changed, invoiced, paid or emailed."
  ].join("\n")+"\n");
  add("manifest.json",JSON.stringify({kind:"partial-sales-receipts",entity,year,
   invoice_rows:invoices.length,receipt_events:events.length,exceptions:exceptions.length,
   statutory_complete:false,files:manifest},null,2)+"\n");
  const zip=buildAccountantZip(files);
  return new Response(new Uint8Array(zip),{headers:{...headers,"Content-Type":"application/zip",
   "Content-Disposition":'attachment; filename="MZS-Sales-Receipts-PREVIEW-'+year+'-'+entity.slice(0,8)+'.zip"'}});
 }catch{return new Response("Onvolledige financiële brongegevens: geen export aangemaakt.",{status:503,headers});}
}
