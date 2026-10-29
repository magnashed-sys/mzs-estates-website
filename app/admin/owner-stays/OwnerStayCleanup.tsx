"use client";
import {useAdminI18n} from '../../../lib/admin/i18n';

import {useActionState} from "react";
import {deleteOwnerStayRequest,type OwnerStayDecisionResult} from "./actions";

const initial:OwnerStayDecisionResult={status:"idle",message:""};
export default function OwnerStayCleanup({id,status,checkIn,checkOut}:{id:string;status:string;checkIn:string;checkOut:string}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [outcome,action,pending]=useActionState(deleteOwnerStayRequest,initial);
 return <details style={{marginTop:14}}>
  <summary>{adminT("Remove closed request")}</summary>
  <form action={action} onSubmit={event=>{
   if(!window.confirm(adminT("Permanently remove this {p0} owner-stay request for {p1} – {p2}? The deletion reason and request snapshot remain in the administrator audit log. This cannot be undone.", {p0: adminT(status), p1: checkIn, p2: checkOut})))event.preventDefault();
  }} style={{display:"grid",gap:12,maxWidth:520,paddingTop:12}}>
   <input type="hidden" name="request_id" value={id}/>
   <input type="hidden" name="expected_status" value={status}/>
   <input type="hidden" name="check_in" value={checkIn}/>
   <input type="hidden" name="check_out" value={checkOut}/>
   <p style={{margin:0}}>{adminT("Only closed requests without a linked reservation can be removed. An audit record is retained.")}</p>
   <label>{adminT("Reason for deletion")}<input name="reason" required minLength={5} maxLength={500} disabled={pending} style={{display:"block",boxSizing:"border-box",width:"100%",padding:10,background:"#24221f",color:"#fff",border:"1px solid #655c4c"}}/>
   </label>
   <button disabled={pending} style={{padding:12,background:"#382521",color:"#fff",border:"1px solid #986958",cursor:"pointer"}}>{pending?adminT("Deleting…"):adminT("Delete closed request")}</button>
   {outcome.message&&<p role={outcome.status==="error"?"alert":"status"}>{adminT(outcome.message)}</p>}
  </form>
 </details>;
}
