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
 const [{data:property},{data:guest},{data:owner}]=await Promise.all([
  db.from("projects").select("title").eq("id",b.project_id).maybeSingle(),
  b.user_id?db.from("profiles").select("full_name,email").eq("id",b.user_id).maybeSingle():Promise.resolve({data:null}),
  db.from("mzs_owner_stay_requests").select("id,status").eq("booking_id",id).maybeSingle()
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
 </main>;
}
