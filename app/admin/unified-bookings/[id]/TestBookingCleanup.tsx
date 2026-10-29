"use client";
import {useAdminI18n} from '../../../../lib/admin/i18n';

import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {bookingReturnHref} from "../../../../lib/admin/booking-return";
import {createClient} from "../../../../lib/supabase/client";
export default function TestBookingCleanup({bookingId,returnHref}:{bookingId:string;returnHref?:string}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const router=useRouter(),lock=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function remove(){
  if(lock.current||!window.confirm(adminT("Permanently delete this test booking and its linked test cancellation requests? This cannot be undone.")))return;
  lock.current=true;setBusy(true);setError("");
  try{
   const {data,error:failure}=await createClient().rpc("delete_test_rental_booking",{p_booking_id:bookingId});
   if(failure||data!==true)throw new Error("Deletion could not be confirmed. The record may have changed or have linked history. Refresh and review it before trying again.");
   router.replace(returnHref?bookingReturnHref(returnHref):"/admin/bookings/operations?scope=test");router.refresh();
  }catch(cause){setError(cause instanceof Error?cause.message:"Deletion could not be confirmed.");lock.current=false;setBusy(false);}
 }
 return <section aria-label={adminT("Test booking cleanup")}>
  <p>{adminT("This record is marked as a test. Real reservations are protected by the deletion rules.")}</p>
  <button type="button" disabled={busy} onClick={()=>void remove()} style={{padding:12,color:"#181410",background:"#d5c09a"}}>{busy?adminT("Deleting…"):adminT("Delete test booking")}</button>
  {error&&<p role="alert">{adminT(error)}</p>}
 </section>;
}
