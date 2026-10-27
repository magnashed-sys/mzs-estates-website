"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {createClient} from "../../lib/supabase/client";
type Action={id:string;title:string;detail:string;href:string;category:string;date:string};
const PANEL={background:"#151411",border:"1px solid #514839",padding:22,marginBottom:24} as const;
export default function GroupActionCenter({refreshVersion}:{refreshVersion:number}){
 const [actions,setActions]=useState<Action[]>([]);
 const [unavailable,setUnavailable]=useState<string[]>([]);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  let active=true;
  async function load(){
   setLoading(true);
   const db=createClient();
   const [owner,bookings,capital,outbox]=await Promise.all([
    db.from("mzs_owner_stay_requests").select("id,check_in,check_out,created_at,status").eq("status","requested").order("created_at",{ascending:false}).limit(100),
    db.rpc("admin_list_rental_bookings").eq("status","requested").order("created_at",{ascending:false}).limit(100),
    db.from("mzs_capital_requests").select("id,created_at,status").order("created_at",{ascending:false}).limit(100),
    db.from("mzs_mail_outbox").select("id,created_at,status,event_type").in("status",["pending","failed"]).order("created_at",{ascending:false}).limit(100)
   ]);
   if(!active)return;
   const issues:string[]=[];
   const all:Action[]=[];
   if(owner.error)issues.push("Owner stays");
   else (owner.data||[]).forEach(x=>all.push({id:"owner-"+x.id,title:"Owner stay approval",detail:x.check_in+" – "+x.check_out,href:"/admin/owner-stays",category:"ESTATES",date:x.created_at}));
   if(bookings.error)issues.push("Booking requests");
   else (bookings.data||[]).forEach(x=>all.push({id:"booking-"+x.id,title:"Rental booking request",detail:x.check_in+" – "+x.check_out,href:"/admin/bookings/operations",category:"BOOKINGS",date:x.created_at}));
   if(capital.error)issues.push("Capital enquiries");
   else (capital.data||[]).filter(x=>x.status==="pending"||x.status==="new").forEach(x=>all.push({id:"capital-"+x.id,title:"Capital enquiry",detail:"Review submitted request",href:"/admin/capital-requests",category:"CAPITAL",date:x.created_at}));
   if(outbox.error)issues.push("Email queue");
   else {
    const failed=(outbox.data||[]).filter(x=>x.status==="failed");
    if(failed.length)all.push({id:"email-failed",title:failed.length+" email delivery failures",detail:"Check outgoing notifications",href:"/admin?tab=overview",category:"SYSTEM",date:failed[0].created_at});
   }
   all.sort((a,b)=>b.date.localeCompare(a.date));
   setActions(all.slice(0,12));setUnavailable(issues);setLoading(false);
  }
  void load();return()=>{active=false};
 },[refreshVersion]);
 return <section style={PANEL} aria-label="Group Action Center">
  <div style={{display:"flex",justifyContent:"space-between",gap:15,flexWrap:"wrap"}}>
   <div><p style={{color:"#d5c09a",letterSpacing:2,fontSize:11}}>MZS GROUP / WORKFLOW</p><h2 style={{fontFamily:"Georgia,serif",fontWeight:400,margin:"8px 0"}}>Central Action Center</h2>
   <p style={{color:"#aaa398",margin:0}}>Open requests from across your existing management modules.</p></div>
   <strong style={{color:"#d5c09a"}}>{loading?"…":actions.length+" visible"}</strong>
  </div>
  {loading?<p role="status">Loading pending work…</p>:<>
   {unavailable.length>0&&<p role="alert" style={{color:"#e3a995"}}>Some registers could not be loaded: {unavailable.join(", ")}. Counts may be incomplete.</p>}
   {actions.length===0?<p style={{marginTop:18}}>No pending actions in the available registers.</p>:
   <div style={{display:"grid",gap:10,marginTop:20}}>
    {actions.map(a=><Link key={a.id} href={a.href} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:15,color:"#eeeae2",padding:14,border:"1px solid #403a30",textDecoration:"none"}}>
      <span><small style={{color:"#d5c09a",letterSpacing:1}}>{a.category}</small><br/><strong>{a.title}</strong><br/><small style={{color:"#aaa398"}}>{a.detail}</small></span>
      <span style={{color:"#d5c09a"}}>Review →</span>
    </Link>)}
   </div>}
  </>}
 </section>;
}
