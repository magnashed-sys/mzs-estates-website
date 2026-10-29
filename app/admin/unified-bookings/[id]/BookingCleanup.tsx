"use client";
import {useAdminI18n} from '../../../../lib/admin/i18n';

import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {bookingReturnHref} from "../../../../lib/admin/booking-return";
import {createClient} from "../../../../lib/supabase/client";
type Plan={archived:boolean;canArchive:boolean;canDelete:boolean;blockers:string[];fingerprint:string};
export default function BookingCleanup({bookingId,plan,returnHref}:{bookingId:string;plan:Plan;returnHref?:string}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const router=useRouter(),lock=useRef(false);
 const [reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function apply(action:"archive"|"restore"|"delete"){
  if(lock.current||reason.trim().length<5)return;
  const message=action==="delete"?"Permanently remove this erroneous booking? An audit record remains; this action cannot be undone.":action==="archive"?"Move this booking to the archive? Dates, payments and history remain unchanged.":"Restore this booking to the working list? Its original status is unchanged.";
  if(!window.confirm(adminT(message)))return;
  lock.current=true;setBusy(true);setError("");
  try{
   const {data,error:failure}=await createClient().rpc("mzs_admin_booking_cleanup",{p_booking_id:bookingId,p_action:action,p_reason:reason.trim(),p_fingerprint:plan.fingerprint});
   if(failure||data!==action)throw new Error(failure?.message||"Result could not be confirmed. Refresh before trying again.");
   if(action==="delete")router.replace(bookingReturnHref(returnHref));else router.refresh();
  }catch(cause){setError(cause instanceof Error?cause.message:"Cleanup failed.");}
  finally{lock.current=false;setBusy(false);}
 }
 const field={padding:10,background:"#211f1b",color:"#eee8dd",border:"1px solid #74654f",maxWidth:"100%"} as const;
 return <section aria-label={adminT("Booking cleanup")} style={{border:"1px solid #514839",padding:16,marginBottom:20}}>
  <h3>{plan.archived?adminT("Archived booking"):adminT("Cleanup")}</h3>
  <p>{adminT("Archiving changes only the admin working list. It does not cancel a reservation, change payments or send a customer email.")}</p>
  {!plan.canDelete&&<p>{adminT("Permanent deletion unavailable:")} {[...new Set(plan.blockers)].join("; ")}.</p>}
  {(plan.archived||plan.canArchive||plan.canDelete)&&<>
   <label style={{display:"grid",gap:8}}>{adminT("Reason")}<textarea style={field} minLength={5} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></label>
   <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:12}}>
    {(plan.archived||plan.canArchive)&&<button style={field} disabled={busy||reason.trim().length<5} onClick={()=>void apply(plan.archived?"restore":"archive")}>{plan.archived?adminT("Restore to working list"):adminT("Archive booking")}</button>}
    {plan.canDelete&&<button style={field} disabled={busy||reason.trim().length<5} onClick={()=>void apply("delete")}>{adminT("Delete erroneous booking")}</button>}
   </div>
  </>}
  {busy&&<p role="status">{adminT("Saving…")}</p>}{error&&<p role="alert">{adminT(error)}</p>}
 </section>;
}
