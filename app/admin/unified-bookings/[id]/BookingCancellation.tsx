"use client";
import {useAdminI18n} from '../../../../lib/admin/i18n';

import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
export type CancellationPlan={kind:"live"|"historical"|"owner"|"block";canCancel:boolean;blockers:string[];fingerprint:string;label:string;notification:string};
export default function BookingCancellation({bookingId,plan}:{bookingId:string;plan:CancellationPlan}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const router=useRouter(),lock=useRef(false);
 const [reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[done,setDone]=useState(false);
 const [message,setMessage]=useState("");
 async function submit(){
  if(lock.current||!plan.canCancel||reason.trim().length<5)return;
  if(!window.confirm(adminT("{p0}? {p1} Dates become available; amounts, receipts and original records are retained. Reason: {p2}", {p0: plan.label, p1: plan.notification, p2: reason.trim()})))return;
  lock.current=true;setBusy(true);setError("");
  try{
   const response=await fetch("/api/rental/admin-booking",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({functionName:"mzs_admin_cancel_booking_dossier",args:{p_booking_id:bookingId,p_reason:reason.trim(),p_fingerprint:plan.fingerprint}})});
   const data=await response.json();
   if(!response.ok||data.result?.status!=="cancelled")throw new Error(data.error||"Cancellation could not be confirmed. Reload before retrying.");
   setDone(true);setMessage(data.result.emailQueued?"Booking cancelled. Cancellation email queued; check notification activity for delivery status.":"Action completed. No automatic email was sent.");
   router.refresh();
  }catch(cause){setError(cause instanceof Error?cause.message:"Cancellation could not be confirmed.");}
  finally{lock.current=false;setBusy(false);}
 }
 const control={padding:12,background:"#211f1b",color:"#eee8dd",border:"1px solid #74654f",minHeight:44,maxWidth:"100%"} as const;
 return <section aria-label={adminT("Cancellation and availability")} style={{marginTop:20,borderTop:"1px solid #514839",paddingTop:16}}>
  <h3>{adminT(plan.label)}</h3>
  <p>{plan.notification}</p>
  <p>{adminT("Releases the occupied dates and records your reason. It does not delete the booking, change the agreed amount or process a refund.")}</p>
  {plan.kind==="historical"&&<p>{adminT("For past stays, use this only to correct an incorrectly confirmed reservation. A stay that took place should be archived instead. The original confirmation remains unchanged.")}</p>}
  {!plan.canCancel?<p>{adminT("Unavailable:")} {plan.blockers.join("; ")}.</p>:done?<p role="status">{adminT(message)}</p>:<>
   <label style={{display:"grid",gap:8}}>{adminT("Cancellation / release reason")}<textarea style={control} value={reason} minLength={5} maxLength={500} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
   <button type="button" style={{...control,marginTop:12}} disabled={busy||reason.trim().length<5} onClick={()=>void submit()}>{busy?adminT("Saving…"):adminT(plan.label)}</button>
  </>}
  {error&&<p role="alert">{adminT(error)}</p>}
 </section>;
}
