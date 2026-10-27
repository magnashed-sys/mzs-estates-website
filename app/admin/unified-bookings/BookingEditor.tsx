"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {adjustBookingPrice} from "../owner-stays/actions";
type Booking={id:string;checkIn:string;checkOut:string;guestCount:number|null;total:number|null;notes:string};
export default function BookingEditor({booking}:{booking:Booking}){
 const router=useRouter();
 const [open,setOpen]=useState(false);
 const [dates,setDates]=useState({checkIn:booking.checkIn,checkOut:booking.checkOut,guests:String(booking.guestCount||1),notes:booking.notes});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const input={background:"#211f1b",color:"#f4eadc",border:"1px solid #74654f",padding:8,minWidth:125} as const;
 async function saveStay(){
  if(busy)return;
  const guests=Number(dates.guests);
  if(!dates.checkIn||dates.checkOut<=dates.checkIn||!Number.isInteger(guests)||guests<1||dates.notes.length>2000){setError("Check dates, guests and notes.");return;}
  if(!window.confirm("Save these booking dates and guest details? Price may be recalculated at the original nightly rate. Confirmed-booking changes can queue an email to the linked client."))return;
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/rental/admin-booking",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({functionName:"admin_modify_live_rental_booking",args:{
      p_booking_id:booking.id,p_check_in:dates.checkIn,p_check_out:dates.checkOut,
      p_guest_count:guests,p_expected_check_in:booking.checkIn,p_expected_check_out:booking.checkOut,
      p_expected_guest_count:booking.guestCount,p_admin_notes:dates.notes
    }})});
   const result=await response.json();
   if(!response.ok||result.result!=="updated")throw Error(result.error||"Modification could not be confirmed.");
   setOpen(false);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Booking update failed");}
  finally{setBusy(false);}
 }
 return <div style={{maxWidth:350}}>
  <button style={input} type="button" onClick={()=>setOpen(!open)}>{open?"Close":"Edit booking"}</button>
  {open&&<div style={{padding:15,marginTop:8,border:"1px solid #625743",background:"#181613"}}>
    <strong>Dates and guests</strong>
    <div style={{display:"grid",gap:9,marginTop:10}}>
      <label>Check-in <input style={input} type="date" value={dates.checkIn} onChange={e=>setDates(x=>({...x,checkIn:e.target.value}))}/></label>
      <label>Check-out <input style={input} type="date" value={dates.checkOut} onChange={e=>setDates(x=>({...x,checkOut:e.target.value}))}/></label>
      <label>Guests <input style={input} type="number" min="1" value={dates.guests} onChange={e=>setDates(x=>({...x,guests:e.target.value}))}/></label>
      <label>Admin notes <textarea style={input} value={dates.notes} onChange={e=>setDates(x=>({...x,notes:e.target.value}))}/></label>
      <button style={input} disabled={busy} onClick={saveStay} type="button">{busy?"Saving…":"Save dates and guests"}</button>
    </div>
    <hr style={{borderColor:"#514839",margin:"20px 0"}}/>
    <strong>Booking total</strong>
    <p style={{fontSize:12,color:"#bbb1a3"}}>Adjust the complete EUR amount separately after editing dates. A reason is required and a price audit is retained. For a confirmed client booking, a price change can queue a client email.</p>
    <form action={adjustBookingPrice} style={{display:"grid",gap:9}}>
     <input type="hidden" name="booking_id" value={booking.id}/>
     <input type="hidden" name="expected" value={booking.total===null?"":String(booking.total)}/>
     <label>Total EUR <input style={input} name="total" type="number" step="0.01" min="0" defaultValue={booking.total??0} required/></label>
     <label>Reason <input style={input} name="reason" minLength={5} maxLength={500} required/></label>
     <button style={input} type="submit">Save audited total</button>
    </form>
    {error&&<p role="alert" style={{color:"#f2a58b"}}>{error}</p>}
   </div>}
 </div>;
}
