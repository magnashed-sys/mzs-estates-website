export type Row = Record<string,string|number|boolean|null>;
export type PartnerSource = {issuer:{id:string;name:string};snapshot_at:string}&Record<string,unknown>;
export function rows(source:PartnerSource,key:string):Row[]{
 const value=source[key];
 if(!Array.isArray(value))throw Error('Financial source incomplete');
 return value as Row[];
}
export function cents(value:unknown):number{
 if(!['number','string'].includes(typeof value)||! /^-?\d+(?:\.\d{1,2})?$/.test(String(value)))throw Error('Invalid financial amount');
 const n=Number(value);if(!Number.isFinite(n))throw Error('Invalid financial amount');
 const result=Math.round(n*100);if(!Number.isSafeInteger(result))throw Error('Financial amount out of range');return result;
}
export function integerCents(value:unknown):number{
 const n=Number(value);if(!['number','string'].includes(typeof value)||value===''||!Number.isSafeInteger(n))throw Error('Invalid cents');return n;
}
export function inYear(row:Row,field:string,year:number):boolean{return typeof row[field]==='string'&&row[field].slice(0,4)===String(year);}
export const invoiceKeys=['leases','bookings','external','services'] as const;
export const receiptKeys=['rent_receipts','guest_receipts','external_receipts','imported_receipts','service_receipts'] as const;
export function partnerSummary(source:PartnerSource,year:number){
 let invoiced=0,received=0,paid=0,reviewedCosts=0;
 const numbers=new Set<string>();const bookings=new Set<string>();
 for(const key of invoiceKeys)for(const r of rows(source,key)){
  if(r.number){const number=String(r.number).trim().toUpperCase();if(numbers.has(number))throw Error('Ambiguous invoice number');numbers.add(number);}
  if(key==='bookings'&&r.booking_id){const id=String(r.booking_id);if(bookings.has(id))throw Error('Ambiguous booking receipts');bookings.add(id);}
 }
 for(const key of receiptKeys){const ids=new Set<string>();for(const r of rows(source,key))if(r.id){if(ids.has(String(r.id)))throw Error('Duplicate receipt');ids.add(String(r.id));}}
 const excludedImports=new Set(rows(source,'imported').filter(r=>r.excluded).map(r=>r.id));
 for(const key of invoiceKeys)for(const r of rows(source,key))if(inYear(r,'issued_on',year)&&r.status!=='void')invoiced+=cents(r.total);
 for(const r of rows(source,'credit_notes'))if(inYear(r,'issued_on',year))invoiced-=integerCents(r.gross_cents);
 for(const key of receiptKeys)for(const r of rows(source,key))if(inYear(r,'received_on',year)&&!r.reversed_at&&r.receipt_type!=='historical_settlement'&&!(key==='imported_receipts'&&excludedImports.has(r.invoice_id)))received+=cents(r.amount);
 for(const r of rows(source,'supplier_payments'))if(inYear(r,'paid_on',year)&&!r.reversed_at)paid+=integerCents(r.amount_cents);
 for(const r of rows(source,'costs'))if(inYear(r,'invoice_date',year)&&r.review_status==='reviewed'&&r.status==='draft'&&r.currency==='EUR')reviewedCosts+=integerCents(r.gross_cents);
 if(![invoiced,received,paid,reviewedCosts].every(Number.isSafeInteger))throw Error('Totals out of range');
 return {invoiced,received,paid,reviewedCosts};
}
export function availableYears(source:PartnerSource,currentYear:number):number[]{
 const years=new Set([currentYear]);
 for(const value of Object.values(source))if(Array.isArray(value))for(const row of value){
  for(const key of ['issued_on','received_on','paid_on','invoice_date','due_date','document_date']){
   const date=row[key];if(typeof date==='string'&&/^\d{4}-\d{2}-\d{2}/.test(date))years.add(Number(date.slice(0,4)));
  }
  if(Number.isInteger(row.fiscal_year))years.add(row.fiscal_year);
 }
 return [...years].sort((a,b)=>b-a);
}
