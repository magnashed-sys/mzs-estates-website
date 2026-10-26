import Link from "next/link";
import {notFound} from "next/navigation";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import BookingEditor from "../BookingEditor";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money=(v:number|string|null)=>v===null?"Not priced":new Intl.NumberFormat("en-GB",{style:"currency",currency:"EUR"}).format(Number(v));
export default async function BookingDossier({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!UUID.test(id))notFound();
 const {db}=await requireEstateAdmin();
 const {data:rows,error}=await db.rpc("admin_list_rental_bookings").eq("id",id).limit(2);
 if(error||!rows||rows.length!==1)notFound();
 const b=rows[0];
 const [{data:property},{data:guest},{data:owner},changes,prices,notifications]=await Promise.all([
  db.from("projects").select("title").eq("id",b.project_id).maybeSingle(),
  b.user_id?db.from("profiles").select("full_name,email").eq("id",b.user_id).maybeSingle():Promise.resolve({data:null}),
  db.from("mzs_owner_stay_requests").select("id,status").eq("booking_id",id).maybeSingle(),
  db.from("rental_booking_admin_audit").select("id,action,reason,created_at,previous_values,resulting_values").eq("booking_id",id).order("created_at",{ascending:false}).limit(100),
  db.from("mzs_booking_price_audit").select("id,old_total,new_total,reason,created_at").eq("booking_id",id).order("created_at",{ascending:false}).limit(100),
  db.from("rental_change_notifications").select("id,kind,status,attempts,created_at").eq("booking_id",id).order("created_at",{ascending:false}).limit(100)
 ]);
 const editable=!b.is_test&&["requested","confirmed"].includes(b.status)&&!owner;
 const card={padding:24,border:"1px solid #514839",background:"#151411",borderRadius:6} as const;
 return <main style={{background:"#0d0d0c",color:"#eee8dd",minHeight:"100vh",padding:"42px clamp(20px,5vw,70px)"}}>
  <Link href="/admin/unified-bookings" style={{color:"#d5c09a"}}>← Unified Bookings</Link>
  <p style={{color:"#d5c09a",letterSpacing:3,fontSize:11,marginTop:30}}>MZS ESTATES / RESERVATION DOSSIER</p>
  <h1 style={{fontFamily:"Georgia,serif",fontWeight:400}}>{property?.title||"Rental property"}</h1>
  <p style={{color:"#b5ac9c"}}>Booking reference: {b.id}</p>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginBottom:22}}>
    <section style={card}><small>Reservation type</small><h2 style={{fontWeight:400}}>{owner?"Owner stay":b.status==="blocked"?"Unavailable period":"Guest booking"}</h2><p>Status: {b.status}</p></section>
    <section style={card}><small>Stay</small><h2 style={{fontWeight:400}}>{b.check_in} – {b.check_out}</h2><p>{b.guest_count??"Unspecified"} guests</p></section>
    <section style={card}><small>Recorded total</small><h2 style={{fontWeight:400}}>{money(b.quoted_total_eur)}</h2><p>{owner?"Complimentary owner use":"Registered booking amount"}</p></section>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:18}}>
    <section style={card}><h2>Guest & administration</h2><p>Guest: {guest?.full_name||"Not linked"}</p><p>Email: {guest?.email||"Not available"}</p><p>Internal notes: {b.admin_notes||"None"}</p></section>
    <section style={card}><h2>Manage reservation</h2>
      {editable?<BookingEditor booking={{id:b.id,checkIn:b.check_in,checkOut:b.check_out,guestCount:b.guest_count,total:b.quoted_total_eur===null?null:Number(b.quoted_total_eur),notes:b.admin_notes||""}}/>:
        <><p>This reservation uses a dedicated workflow or is not eligible for modification here.</p><Link href={owner?"/admin/owner-stays":"/admin?tab=bookings"} style={{color:"#d5c09a"}}>Open original management →</Link></>}
      <p style={{color:"#a8a093",fontSize:12}}>Changes use the existing permission-checked booking functions. Amount changes require an audit reason.</p>
    </section>
  </div>
  <section style={{...card,marginTop:20}}><h2>Financial overview</h2>
    <p>Recorded booking value: <strong>{money(b.quoted_total_eur)}</strong></p>
    <p style={{color:"#bcb2a4"}}>This rental booking does not currently have a verified direct link to issued rental invoices or payment transactions. No paid balance or invoice status is inferred from the booking total.</p>
    <Link href="/admin/group/estates/contracts?view=invoices" style={{color:"#d5c09a"}}>Open invoices & payments administration →</Link>
  </section>
  <section style={{...card,marginTop:20}}><h2>Activity & audit history</h2>
    {(changes.error||prices.error||notifications.error)&&<p role="alert" style={{color:"#e3a995"}}>Some audit or notification records could not be loaded. The activity history may be incomplete.</p>}
    <h3>Reservation changes</h3>
    {(changes.data||[]).length===0?<p>No administrator modification records.</p>:(changes.data||[]).map(x=><div key={x.id} style={{padding:"12px 0",borderBottom:"1px solid #443e34"}}><strong>{x.action}</strong> · {new Date(x.created_at).toLocaleString("en-GB")}<p>Reason: {x.reason||"Not provided"}</p><details><summary>Recorded before / after</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>Before: {JSON.stringify(x.previous_values,null,2)}{"\\n"}After: {JSON.stringify(x.resulting_values,null,2)}</pre></details></div>)}
    <h3>Price adjustments</h3>
    {(prices.data||[]).length===0?<p>No separately audited price changes.</p>:(prices.data||[]).map(x=><p key={x.id}>{new Date(x.created_at).toLocaleString("en-GB")} · {money(x.old_total)} → {money(x.new_total)} · {x.reason}</p>)}
    <h3>Client notification activity</h3>
    {(notifications.data||[]).length===0?<p>No modification or cancellation notification records.</p>:(notifications.data||[]).map(x=><p key={x.id}>{x.kind} · {x.status} · {new Date(x.created_at).toLocaleString("en-GB")} · {x.attempts} attempts</p>)}
  </section>
 </main>;
}
