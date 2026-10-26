"use client";
import {useActionState} from "react";
import {decideOwnerStay,type OwnerStayDecisionResult} from "./actions";

const initial:OwnerStayDecisionResult={status:"idle",message:""};
const button={padding:"10px 12px",background:"#24221f",color:"#fff",border:"1px solid #655c4c",cursor:"pointer"} as const;

export default function OwnerStayDecision({id,blocked=false}:{id:string;blocked?:boolean}){
 const [outcome,action,pending]=useActionState(decideOwnerStay,initial);
 return <form action={action} style={{display:"grid",gap:10,maxWidth:700}}>
  <input type="hidden" name="request_id" value={id}/>
  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
   <button type="submit" name="decision" value="approve" disabled={pending||blocked} title={blocked?"Cannot approve dates already occupied by a confirmed booking or calendar block":undefined} style={{...button,opacity:pending||blocked?0.45:1}}>
     {pending?"Processing…":"Approve · create confirmed stay"}
   </button>
   <button type="submit" name="decision" value="decline" disabled={pending} style={{...button,opacity:pending?0.45:1}}>Decline</button>
  </div>
  {outcome.message&&<p role={outcome.status==="error"?"alert":"status"} style={{padding:12,margin:0,border:"1px solid #655c4c",color:outcome.status==="error"?"#f0b9a6":"#c9d8bd"}}>
    {outcome.message}
  </p>}
 </form>;
}
