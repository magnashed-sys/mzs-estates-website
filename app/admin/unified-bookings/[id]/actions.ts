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
