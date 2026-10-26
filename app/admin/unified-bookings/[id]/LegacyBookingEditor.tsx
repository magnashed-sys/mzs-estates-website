"use client";
import {useActionState,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {updateLegacyBooking} from "./actions";

type BookingFields={
 id:string;
 checkIn:string;
 checkOut:string;
 checkInTime:string;
 checkOutTime:string;
 total:number|null;
 guestCount:number|null;
 notes:string;
};
type SourceFields={
 guestName:string;
 contactName:string;
 contactEmail:string;
 billingKind:"person"|"company";
 invoiceRecipient:string;
 companyId:string|null;
 version:number;
};
type Company={id:string;name:string};
export default function LegacyBookingEditor({booking,source,companies}:{
 booking:BookingFields;source:SourceFields;companies:Company[];
}){
 const router=useRouter();
 const [result,action,pending]=useActionState(updateLegacyBooking,{ok:false,message:""});
 const [billingKind,setBillingKind]=useState(source.billingKind);
 useEffect(()=>{if(result.ok)router.refresh();},[result.ok,router]);
 const field={display:"block",padding:10,width:"100%",background:"#211f1b",
  border:"1px solid #74654f",color:"#f4eadc",borderRadius:3,boxSizing:"border-box"} as const;
 const expected=JSON.stringify({
  check_in:booking.checkIn,check_out:booking.checkOut,
  check_in_time:booking.checkInTime||null,check_out_time:booking.checkOutTime||null,
  guest_count:booking.guestCount,total:booking.total,admin_notes:booking.notes||""
 });
 return <section style={{marginTop:12}}>
  <p style={{color:"#d5c09a",fontSize:12,letterSpacing:1.5}}>EDIT IMPORTED RESERVATION</p>
  <p style={{color:"#bcb2a4",fontSize:13}}>Correct dates, guest/contact details, billing recipient and agreed total. The original PDF values are always preserved in the source and every correction is audit-logged. No automatic guest email or invoice will be sent.</p>
  <form action={action} style={{display:"grid",gap:16}}>
   <input type="hidden" name="booking_id" value={booking.id}/>
   <input type="hidden" name="expected_booking" value={expected}/>
   <input type="hidden" name="override_version" value={source.version}/>
   <fieldset style={{border:"1px solid #514839",padding:14,display:"grid",gap:12}}>
    <legend style={{padding:"0 7px",color:"#d5c09a"}}>Stay & price</legend>
    <label>Check-in date<input style={field} type="date" name="check_in" defaultValue={booking.checkIn} required/></label>
    <label>Check-out date<input style={field} type="date" name="check_out" defaultValue={booking.checkOut} required/></label>
    <label>Check-in time<input style={field} type="time" name="check_in_time" defaultValue={booking.checkInTime}/></label>
    <label>Check-out time<input style={field} type="time" name="check_out_time" defaultValue={booking.checkOutTime}/></label>
    <label>Guests (leave blank if unknown)<input style={field} type="number" min="1" max="50" name="guest_count" defaultValue={booking.guestCount??""} placeholder="Not specified"/></label>
    <label>Agreed total (€)<input style={field} type="number" min="0" step="0.01" name="total" defaultValue={booking.total??""} required/></label>
   </fieldset>
   <fieldset style={{border:"1px solid #514839",padding:14,display:"grid",gap:12}}>
    <legend style={{padding:"0 7px",color:"#d5c09a"}}>Guest & billing contact</legend>
    <label>Guest / original booking name<input style={field} name="guest_name" maxLength={250} minLength={2} required defaultValue={source.guestName}/></label>
    <label>Contact person<input style={field} name="contact_name" maxLength={250} minLength={2} required defaultValue={source.contactName}/></label>
    <label>Contact email<input style={field} type="email" name="contact_email" maxLength={254} defaultValue={source.contactEmail}/></label>
    <label>Invoice recipient type<select style={field} name="invoice_recipient_kind" value={billingKind} onChange={e=>setBillingKind(e.target.value as "person"|"company")}>
     <option value="person">Private person</option><option value="company">Company</option>
    </select></label>
    {billingKind==="company"?
      <label>Invoice company<select style={field} required name="invoice_recipient_relationship_id" defaultValue={source.companyId||""}>
       <option disabled value="">Select registered company</option>
       {companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}
      </select></label>:
      <label>Private invoice recipient<input style={field} required name="invoice_recipient_name" minLength={2} maxLength={250} defaultValue={source.invoiceRecipient}/></label>}
   </fieldset>
   <label>Internal notes<textarea style={field} name="admin_notes" maxLength={2000} rows={3} defaultValue={booking.notes}/></label>
   <label>Reason for correction (required)<textarea style={field} name="reason" rows={3} minLength={5} maxLength={500} required placeholder="Describe what was corrected and why"/></label>
   {result.message&&<p role={result.ok?"status":"alert"} style={{color:result.ok?"#a8d0b3":"#e3a995",margin:0}}>{result.message}</p>}
   <button type="submit" disabled={pending} style={{padding:"12px 18px",background:"#d5c09a",color:"#181410",border:0,borderRadius:4,fontWeight:600,cursor:pending?"wait":"pointer",opacity:pending?0.7:1}}>
    {pending?"Saving correction…":"Save audited correction"}
   </button>
   <small style={{color:"#bcb2a4"}}>Conflicting reservations, already-issued invoices and concurrent changes are blocked. Registered receipts remain unchanged and should be checked after a price correction.</small>
  </form>
 </section>;
}
