import Link from "next/link";
import BookingRegister from "./BookingRegister";
import {requireEstateAdmin} from "../../../lib/security/estate-properties";

export const dynamic="force-dynamic";
type Item={id:string;category:"Guest booking"|"Owner stay"|"Unavailable";property:string;checkIn:string;checkOut:string;status:string;amount:string;href:string;editable:boolean;total:number|null;guestCount:number|null;notes:string;guestName:string;invoiceRecipient:string;sourceRef:string};
export default async function UnifiedBookings(){
 const {db}=await requireEstateAdmin();
 const [bookings,requests,properties]=await Promise.all([
  db.rpc("admin_list_rental_bookings").order("check_in",{ascending:false}).limit(250),
  db.from("mzs_owner_stay_requests").select("id,partner_id,check_in,check_out,status,booking_id,created_at").order("created_at",{ascending:false}).limit(250),
  db.from("projects").select("id,title")
 ]);
 const errors=[bookings.error&&"booking register",requests.error&&"owner requests",properties.error&&"properties"].filter(Boolean);
 const names=new Map((properties.data||[]).map(p=>[p.id,p.title]));
 const grants=await db.from("mzs_property_partners").select("id,project_id");
 const grantsById=new Map((grants.data||[]).map(g=>[g.id,g.project_id]));
 if(grants.error)errors.push("partner assignments");
 const bookingIds=(bookings.data||[]).map(b=>b.id);
 const profileIds=Array.from(new Set((bookings.data||[]).map(b=>b.user_id).filter((id):id is string=>Boolean(id))));
 const [legacyMatches,guestProfiles]=await Promise.all([
   bookingIds.length?db.from("mzs_booking_legacy_sources").select("booking_id,source_key,original_booking_number,source_guest_name,invoice_recipient_name").in("booking_id",bookingIds):Promise.resolve({data:[],error:null}),
   profileIds.length?db.from("profiles").select("id,full_name").in("id",profileIds):Promise.resolve({data:[],error:null})
 ]);
 if(legacyMatches.error)errors.push("historic confirmation data");
 if(guestProfiles.error)errors.push("guest profiles");
 const historicByBooking=new Map((legacyMatches.data||[]).map(item=>[item.booking_id,item]));
 const guestNamesById=new Map((guestProfiles.data||[]).map(item=>[item.id,item.full_name]));
 const ownerBookingIds=new Set((requests.data||[]).map(r=>r.booking_id).filter(Boolean));
 const rows:Item[]=[
  ...(bookings.data||[]).filter(b=>!ownerBookingIds.has(b.id)).map(b=>({
   id:b.id,category:(b.status==="blocked"?"Unavailable":"Guest booking") as Item["category"],
   property:names.get(b.project_id)||"Property",checkIn:b.check_in,checkOut:b.check_out,
   status:b.status,amount:b.quoted_total_eur==null?"Not priced":new Intl.NumberFormat("en-GB",{style:"currency",currency:"EUR"}).format(Number(b.quoted_total_eur)),
   href:"/admin?tab=bookings",editable:["confirmed","requested"].includes(b.status)&&!b.is_test,total:b.quoted_total_eur===null?null:Number(b.quoted_total_eur),guestCount:b.guest_count,notes:b.admin_notes||"",guestName:historicByBooking.get(b.id)?.source_guest_name||(b.user_id?guestNamesById.get(b.user_id):null)||"No account / name",invoiceRecipient:historicByBooking.get(b.id)?.invoice_recipient_name||"",sourceRef:historicByBooking.get(b.id)?(`${historicByBooking.get(b.id)?.original_booking_number} · ${historicByBooking.get(b.id)?.source_key}`):""
  })),
  ...(requests.data||[]).map(r=>({
   id:r.id,category:"Owner stay" as const,property:names.get(grantsById.get(r.partner_id))||"Property",
   checkIn:r.check_in,checkOut:r.check_out,status:r.status,amount:"€0.00",href:"/admin/owner-stays",editable:false,total:0,guestCount:null,notes:"",guestName:"Owner / partner",invoiceRecipient:"Complimentary",sourceRef:""
  }))
 ].sort((a,b)=>b.checkIn.localeCompare(a.checkIn));
 const style={color:"#f0e9de",background:"#12110f",border:"1px solid #504534",padding:"14px"} as const;
 return <main style={{minHeight:"100vh",background:"#0d0d0c",color:"#eee8dd",padding:"40px clamp(20px,5vw,70px)"}}>
  <Link href="/admin?tab=bookings" style={{color:"#d5c09a"}}>← Group Administration</Link>
  <p style={{fontSize:11,letterSpacing:3,color:"#d5c09a",marginTop:30}}>MZS ESTATES / ADMINISTRATION</p>
  <h1 style={{fontFamily:"Georgia,serif",fontWeight:400}}>Unified Bookings</h1>
  <p style={{color:"#aaa398"}}>Open a reservation to review its details and manage dates, guests and prices in a dedicated dossier. Owner stays and blocked periods retain their specialist controls.</p>
  <nav style={{display:"flex",flexWrap:"wrap",gap:12,margin:"25px 0"}}>
   <Link href="/admin?tab=bookings" style={style}>Guest bookings & calendar →</Link>
   <Link href="/admin/owner-stays" style={style}>Owner stays, pricing & partner access →</Link>
   <Link href="/admin/group/estates/properties" style={style}>Properties →</Link>
  </nav>
  {errors.length>0&&<p role="alert" style={{color:"#e3a995"}}>Incomplete registers: {errors.join(", ")}. Verify records in the source module.</p>}
  <section style={{display:"flex",gap:12,flexWrap:"wrap",margin:"25px 0"}}>
   {["Guest booking","Owner stay","Unavailable"].map(category=><div key={category} style={{...style,minWidth:160}}><small style={{color:"#d5c09a"}}>{category}</small><p style={{fontSize:26,margin:"8px 0"}}>{rows.filter(x=>x.category===category).length}</p></div>)}
  </section>
  <BookingRegister rows={rows.map(({id,category,property,checkIn,checkOut,status,amount,href,guestName,invoiceRecipient,sourceRef})=>({id,category,property,checkIn,checkOut,status,amount,href,guestName,invoiceRecipient,sourceRef}))}/>
  {!rows.length&&<p>No records available in the current reporting scope.</p>}
 </main>;
}
