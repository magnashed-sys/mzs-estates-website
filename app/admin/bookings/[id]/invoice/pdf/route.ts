import {requireEstateAdmin} from "../../../../../../lib/security/estate-properties";
import {bookingInvoicePdf} from "../../../../../../lib/estates/booking-invoice-pdf";
import {invoiceAddress,isMaseIssuer} from "../../../../../../lib/estates/booking-invoice";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"};
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const {db}=await requireEstateAdmin();
 const {id}=await params;
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))return new Response("Not found",{status:404,headers});
 const [bookings,owner,legacy,correction,draft,issued]=await Promise.all([
  db.rpc("admin_list_rental_bookings").eq("id",id).limit(2),
  db.from("mzs_owner_stay_requests").select("id").eq("booking_id",id).maybeSingle(),
  db.from("mzs_booking_legacy_sources").select("invoice_issuer_id,invoice_recipient_name,invoice_recipient_relationship_id,source_address,original_booking_number,confirmation_date").eq("booking_id",id).maybeSingle(),
  db.from("mzs_booking_legacy_overrides").select("invoice_recipient_name,invoice_recipient_relationship_id").eq("booking_id",id).maybeSingle(),
  db.from("mzs_booking_invoice_drafts").select("issuer_id,recipient_name,gross_total,vat_total,vat_rate").eq("booking_id",id).maybeSingle(),
  db.from("mzs_booking_invoices").select("id").eq("booking_id",id).maybeSingle()
 ]);
 if([bookings,owner,legacy,correction,draft,issued].some(r=>r.error))return new Response("Invoice data unavailable. Please retry.",{status:503,headers});
 const b=bookings.data?.[0];
 if(bookings.data?.length!==1||!b)return new Response("Not found",{status:404,headers});
 if(b.status!=="confirmed"||b.is_test||owner.data||Number(b.quoted_total_eur)<=0||issued.data)return new Response("A confirmed chargeable guest booking without an issued invoice is required.",{status:409,headers});
 const issuerId=draft.data?.issuer_id||legacy.data?.invoice_issuer_id;
 if(!issuerId)return new Response("Select an issuing entity and save an invoice draft in the dossier first.",{status:409,headers});
 const companyId=correction.data?.invoice_recipient_relationship_id||(!correction.data?legacy.data?.invoice_recipient_relationship_id:null);
 const [issuer,property,guest,company]=await Promise.all([
  db.from("mzs_lease_issuers").select("name,address,tax_id,iban").eq("id",issuerId).maybeSingle(),
  db.from("projects").select("title").eq("id",b.project_id).maybeSingle(),
  b.user_id?db.from("profiles").select("full_name").eq("id",b.user_id).maybeSingle():Promise.resolve({data:null,error:null}),
  companyId?db.from("mzs_lease_relationships").select("address,billing_address").eq("id",companyId).maybeSingle():Promise.resolve({data:null,error:null})
 ]);
 if([issuer,property,guest,company].some(r=>r.error))return new Response("Billing details unavailable.",{status:503,headers});
 if(!issuer.data||!isMaseIssuer(issuer.data))return new Response("This approved invoice model is configured for Mase Estates SL. Review the issuer and CIF.",{status:409,headers});
 if(draft.data&&(Number(draft.data.gross_total)!==Number(b.quoted_total_eur)||Number(draft.data.vat_total)!==0||Number(draft.data.vat_rate)!==0))return new Response("Review the draft: the booking total or approved no-VAT treatment does not match.",{status:409,headers});
 const recipient=draft.data?.recipient_name||correction.data?.invoice_recipient_name||legacy.data?.invoice_recipient_name||guest.data?.full_name;
 if(!recipient||!property.data||!issuer.data.address||!issuer.data.iban)return new Response("Complete the recipient and issuing entity before previewing.",{status:409,headers});
 let paidCents=0;const receiptDates=new Set<string>();
 // Read every active receipt; never silently truncate the payment total.
 for(let offset=0;;offset+=1000){
  if(offset>=50000)return new Response("Too many receipts; administrator review required.",{status:409,headers});
  const receipts=await db.from("mzs_booking_receipts").select("id,amount,received_on").eq("booking_id",id).is("reversed_at",null).order("id").range(offset,offset+999);
  if(receipts.error)return new Response("Payment data unavailable; no PDF generated.",{status:503,headers});
  for(const r of receipts.data||[]){paidCents+=Math.round(Number(r.amount)*100);if(r.received_on)receiptDates.add(r.received_on);}
  if((receipts.data||[]).length<1000)break;
 }
 const recipientAddress=company.data?(invoiceAddress(company.data.billing_address)||invoiceAddress(company.data.address)):
  correction.data&&correction.data.invoice_recipient_name!==legacy.data?.invoice_recipient_name?"":invoiceAddress(legacy.data?.source_address);
 const bookedOn=legacy.data?legacy.data.confirmation_date:(b.created_at?new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(b.created_at)):null);
 const bytes=await bookingInvoicePdf({
  issuer:{...issuer.data,tax_id:issuer.data.tax_id||""},recipient,recipientAddress,
  property:property.data.title,reference:String(legacy.data?.original_booking_number||id),
  checkIn:b.check_in,checkOut:b.check_out,bookedOn,total:Number(b.quoted_total_eur),paid:paidCents/100,receiptDates:[...receiptDates].sort()
 });
 return new Response(new Uint8Array(bytes),{headers:{...headers,"Content-Type":"application/pdf","Content-Disposition":'inline; filename="booking-invoice-draft-'+id+'.pdf"'}});
}
