"use server";
import {redirect} from "next/navigation";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function recordBookingReceipt(formData:FormData){
 const {db}=await requireEstateAdmin();
 const id=String(formData.get("booking_id")||"");
 const amount=String(formData.get("amount")||"");
 const date=String(formData.get("received_on")||"");
 const reference=String(formData.get("reference")||"").trim();
 const notes=String(formData.get("notes")||"").trim();
 if(!UUID.test(id)||!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(amount)||Number(amount)<=0||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)||!reference||reference.length>200||notes.length>2000){
  throw new Error("Invalid receipt information.");
 }
 const {error}=await db.rpc("mzs_admin_record_booking_receipt",{
  p_booking_id:id,p_amount:Number(amount),p_received_on:date,p_reference:reference,p_notes:notes||null
 });
 if(error)throw new Error("Receipt was not recorded. Check the booking status and unique payment reference.");
 redirect("/admin/unified-bookings/"+id+"?receipt=recorded");
}

export async function reverseBookingReceipt(formData:FormData){
 const {db}=await requireEstateAdmin();
 const receiptId=String(formData.get("receipt_id")||"");
 const reason=String(formData.get("reason")||"").trim();
 if(!UUID.test(receiptId)||reason.length<5||reason.length>500)throw new Error("A valid receipt and reversal reason are required.");
 const {data:bookingId,error}=await db.rpc("mzs_admin_reverse_booking_receipt",{p_receipt_id:receiptId,p_reason:reason});
 if(error||!bookingId)throw new Error("Unable to reverse receipt. Verify the receipt is active.");
 redirect("/admin/unified-bookings/"+bookingId+"?receipt=reversed");
}

export async function createBookingInvoiceDraft(formData:FormData){
 const {db}=await requireEstateAdmin();
 const bookingId=String(formData.get("booking_id")||"");
 const issuerId=String(formData.get("issuer_id")||"");
 const recipient=String(formData.get("recipient_name")||"").trim();
 const email=String(formData.get("recipient_email")||"").trim();
 const vatRateText=String(formData.get("vat_rate")||"");
 const taxNote=String(formData.get("tax_note")||"").trim();
 if(!UUID.test(bookingId)||!UUID.test(issuerId)||recipient.length<1||recipient.length>250||
  email.length>254||!/^\d+(?:\.\d{1,4})?$/.test(vatRateText)||Number(vatRateText)>100||
  taxNote.length<5||taxNote.length>1000)throw new Error("Invalid invoice draft information.");
 const [{data:rows,error:bookingError},{data:issuer,error:issuerError},{data:existing},userRes]=await Promise.all([
  db.rpc("admin_list_rental_bookings").eq("id",bookingId).limit(2),
  db.from("mzs_lease_issuers").select("id,name,prefix,tax_id").eq("id",issuerId).maybeSingle(),
  db.from("mzs_booking_invoice_drafts").select("id").eq("booking_id",bookingId).maybeSingle(),
  db.auth.getUser()
 ]);
 const booking=rows?.[0];const user=userRes.data.user;
 if(bookingError||rows?.length!==1||!booking||booking.status!=="confirmed"||Number(booking.quoted_total_eur)<=0||!issuer||issuerError||existing||!user)throw new Error("Confirmed chargeable booking, issuer and unused draft required.");
 const owner=await db.from("mzs_owner_stay_requests").select("id").eq("booking_id",bookingId).maybeSingle();
 if(owner.error||owner.data)throw new Error("Complimentary owner stays cannot be invoiced.");
 const gross=Math.round(Number(booking.quoted_total_eur)*100);
 const rate=Number(vatRateText)/100;
 const net=Math.round(gross/(1+rate));
 const vat=gross-net;
 const {error}=await db.from("mzs_booking_invoice_drafts").insert({
  booking_id:bookingId,issuer_id:issuerId,recipient_name:recipient,recipient_email:email||null,
  gross_total:gross/100,net_total:net/100,vat_total:vat/100,vat_rate:rate,tax_note:taxNote,
  snapshot:{booking_id:bookingId,project_id:booking.project_id,check_in:booking.check_in,check_out:booking.check_out,
   booking_gross:booking.quoted_total_eur,issuer_name:issuer.name,issuer_prefix:issuer.prefix,issuer_tax_id:issuer.tax_id},
  created_by:user.id
 });
 if(error)throw new Error("Invoice draft could not be saved. Check issuer configuration or whether a draft already exists.");
 redirect("/admin/unified-bookings/"+bookingId+"?invoice=draft");
}

export async function reviewBookingInvoiceDraft(formData:FormData){
 const {db}=await requireEstateAdmin();
 const bookingId=String(formData.get("booking_id")||"");
 const draftId=String(formData.get("draft_id")||"");
 const revision=Number(formData.get("revision"));
 const status=String(formData.get("review_status")||"");
 const note=String(formData.get("tax_note")||"").trim();
 if(!UUID.test(bookingId)||!UUID.test(draftId)||!Number.isInteger(revision)||revision<1||
 !["draft","reviewed"].includes(status)||note.length<5||note.length>1000)throw new Error("Invalid invoice review.");
 const {error}=await db.rpc("mzs_admin_review_booking_invoice_draft",{p_draft_id:draftId,p_revision:revision,p_status:status,p_note:note});
 if(error)throw new Error("Invoice review failed. Reload the dossier and try again.");
 redirect("/admin/unified-bookings/"+bookingId+"?invoice=reviewed");
}

export async function editBookingInvoiceDraft(formData:FormData){
 const {db}=await requireEstateAdmin();
 const bookingId=String(formData.get("booking_id")||"");
 const draftId=String(formData.get("draft_id")||"");
 const issuer=String(formData.get("issuer_id")||"");
 const revision=Number(formData.get("revision"));
 const recipient=String(formData.get("recipient_name")||"").trim();
 const email=String(formData.get("recipient_email")||"").trim();
 const vatRate=Number(formData.get("vat_rate"));
 const taxNote=String(formData.get("tax_note")||"").trim();
 const reason=String(formData.get("reason")||"").trim();
 if(!UUID.test(bookingId)||!UUID.test(draftId)||!UUID.test(issuer)||!Number.isInteger(revision)||revision<1||
 recipient.length<1||recipient.length>250||email.length>254||!Number.isFinite(vatRate)||vatRate<0||vatRate>100||
 taxNote.length<5||taxNote.length>1000||reason.length<5||reason.length>500)throw new Error("Invalid draft edit information.");
 const {data:current,error:readError}=await db.from("mzs_booking_invoice_drafts").select("booking_id").eq("id",draftId).single();
 if(readError||current?.booking_id!==bookingId)throw new Error("Draft does not belong to this reservation.");
 const {error}=await db.rpc("mzs_admin_edit_booking_invoice_draft",{
  p_id:draftId,p_revision:revision,p_issuer:issuer,p_recipient:recipient,p_email:email,
  p_vat_percent:vatRate,p_tax_note:taxNote,p_reason:reason
 });
 if(error)throw new Error("Unable to update draft. Reload and check that it is still in Draft status.");
 redirect("/admin/unified-bookings/"+bookingId+"?invoice=edited");
}
