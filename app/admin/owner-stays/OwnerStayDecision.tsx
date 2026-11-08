"use client";
import {useAdminI18n} from '../../../lib/admin/i18n';

import {useActionState} from "react";
import {decideOwnerStay,type OwnerStayDecisionResult} from "./actions";

const initial:OwnerStayDecisionResult={status:"idle",message:""};
const button={padding:"11px 16px",minHeight:44,borderRadius:6,background:"#28543f",color:"#fff",border:"1px solid #28543f",cursor:"pointer",fontWeight:600} as const;

export default function OwnerStayDecision({id,blocked=false}:{id:string;blocked?:boolean}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [outcome,action,pending]=useActionState(decideOwnerStay,initial);
 return <form action={action} style={{display:"grid",gap:10,maxWidth:700}}>
  <input type="hidden" name="request_id" value={id}/>
  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
   <button type="submit" name="decision" value="approve" disabled={pending||blocked} title={blocked?adminT("Cannot approve dates already occupied by a confirmed booking or calendar block"):undefined} style={{...button,opacity:pending||blocked?0.45:1}}>
     {pending?adminT("Processing…"):adminT("Approve · create confirmed stay")}
   </button>
   <button type="submit" name="decision" value="decline" disabled={pending} style={{...button,opacity:pending?0.45:1}}>{adminT("Decline")}</button>
  </div>
  {outcome.message&&<p role={outcome.status==="error"?"alert":"status"} style={{padding:12,margin:0,border:"1px solid "+(outcome.status==="error"?"#dcb9af":"#b6d2b7"),borderRadius:8,background:outcome.status==="error"?"#fff1eb":"#edf5e9",color:outcome.status==="error"?"#8b443a":"#2f6341"}}>
    {adminT(outcome.message)}
  </p>}
 </form>;
}
