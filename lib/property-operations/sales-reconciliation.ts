/**
 * MZS accountancy rehearsal: exact source-derived sales and receipt records.
 * No accounting ledger, no inferred VAT, no transfer of unattributed payments.
 */
export type InvoiceSource = "rental_contract"|"holiday_booking";
export type IssuedInvoice = {
  source:InvoiceSource;id:string;issuer_id:string;number:string;issued_on:string;
  total:unknown;net_total?:unknown;vat_total?:unknown;contract_id?:string;booking_id?:string;
};
export type ReceiptSource = "lease_payment"|"booking_receipt";
export type RecordedReceipt = {
  source:ReceiptSource;id:string;amount:unknown;received_on:string|null;
  reversed_at:string|null;reference:string;receipt_type?:string|null;
  invoice_id?:string;booking_id?:string;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function euroCents(value:unknown):number{
  if(typeof value!=="string"&&typeof value!=="number")throw new Error("Missing decimal amount");
  const v=String(value);
  if(!/^\d{1,11}(?:\.\d{1,2})?$/.test(v))throw new Error("Invalid decimal amount");
  const [whole,frac=""]=v.split(".");
  const cents=Number(whole)*100+Number(frac.padEnd(2,"0"));
  if(!Number.isSafeInteger(cents)||cents>100000000000)throw new Error("Amount overflow");
  return cents;
}
export function centsEuro(cents:number):string{
  if(!Number.isSafeInteger(cents)||Math.abs(cents)>100000000000)throw Error("Invalid cents");
  return (cents/100).toFixed(2);
}
export function dateYear(value:string|null):number|null {
  if(value===null)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error("Invalid date");
  const d=new Date(value+"T00:00:00Z");
  if(Number.isNaN(d.valueOf())||d.toISOString().slice(0,10)!==value)throw Error("Invalid date");
  return Number(value.slice(0,4));
}
export function normalizeIssuedInvoice(i:IssuedInvoice,legalEntity:string,year:number){
  if(!uuid.test(legalEntity)||!uuid.test(i.id)||!uuid.test(i.issuer_id)||i.issuer_id!==legalEntity ||
   !["rental_contract","holiday_booking"].includes(i.source) ||
   (i.source==="rental_contract"&&!i.contract_id)||
   (i.source==="holiday_booking"&&!i.booking_id)||
   typeof i.number!=="string"||!i.number.trim()||i.number.length>100 ||
   dateYear(i.issued_on)!==year)throw Error("Invoice is not attributable to exact entity/issue year");
  const total=euroCents(i.total),net=i.net_total===undefined?null:euroCents(i.net_total),
   vat=i.vat_total===undefined?null:euroCents(i.vat_total);
  if((net===null)!==(vat===null))throw Error("Partial net/VAT invoice");
  if(net!==null&&vat!==null&&net+vat!==total)throw Error("Invoice VAT mismatch");
  return {
    source:i.source,invoice_id:i.id,issuer_id:i.issuer_id,invoice_number:i.number,
    invoice_date:i.issued_on,source_document_id:i.source==="rental_contract"?i.contract_id!:i.booking_id!,
    gross_eur:centsEuro(total),net_eur:net===null?"":centsEuro(net),
    vat_eur:vat===null?"":centsEuro(vat),
    vat_note:net===null?"Net/VAT not available in this issued invoice source; accountant to verify":"",
    currency:"EUR"
  };
}
export function receiptEvents(r:RecordedReceipt,matchedInvoice:string,year:number){
  if(!uuid.test(r.id)||!uuid.test(matchedInvoice)||!["lease_payment","booking_receipt"].includes(r.source))
    throw Error("Unmatched receipt");
  const amount=euroCents(r.amount);
  if(amount<=0||typeof r.reference!=="string"||r.reference.length>500)throw Error("Invalid receipt");
  const recordedYear=dateYear(r.received_on);
  const reversalYear=r.reversed_at===null?null:dateYear(r.reversed_at.slice(0,10));
  const events:Record<string,unknown>[]=[];
  const base={
    source:r.source,receipt_id:r.id,invoice_id:matchedInvoice,
    source_reference:r.reference,receipt_type:r.receipt_type??"",
    original_received_on:r.received_on??"",
    administrative_reversed_on:r.reversed_at??"",
    vat_note:"Receipt register event, not VAT determination"
  };
  if(recordedYear===year){
    events.push({...base,event:"recorded_receipt",event_date:r.received_on,amount_eur:centsEuro(amount)});
  }
  if(reversalYear===year){
    events.push({...base,event:"administrative_reversal",event_date:r.reversed_at!.slice(0,10),
      amount_eur:centsEuro(-amount)});
  }
  if(r.received_on===null && r.receipt_type==="historical_settlement"){
    // Clearly documented exception, never pretend to know the cash year.
    return {events,exception:{
      source:r.source,receipt_id:r.id,invoice_id:matchedInvoice,reason:"Historical settlement; receipt date unknown",
      amount_eur:centsEuro(amount)
    }};
  }
  if(r.received_on===null) {
    return {events,exception:{
      source:r.source,receipt_id:r.id,invoice_id:matchedInvoice,reason:"Missing receipt date",
      amount_eur:centsEuro(amount)
    }};
  }
  return {events,exception:null};
}
