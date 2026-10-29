
import {getAdminI18n} from '../../../lib/admin/i18n-server';
import Link from "next/link";
import BookingRegister from "./BookingRegister";
import {requireEstateAdmin} from "../../../lib/security/estate-properties";

export const dynamic="force-dynamic";
type Item={id:string;category:"Guest booking"|"Owner stay"|"Unavailable";property:string;checkIn:string;checkOut:string;status:string;amount:string;href:string;editable:boolean;total:number|null;guestCount:number|null;notes:string;guestName:string;invoiceRecipient:string;sourceRef:string};
export default async function UnifiedBookings(){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

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
 const [legacyMatches,legacyOverrides,guestProfiles]=await Promise.all([
   bookingIds.length?db.from("mzs_booking_legacy_sources").select("booking_id,source_key,original_booking_number,source_guest_name,invoice_recipient_name").in("booking_id",bookingIds):Promise.resolve({data:[],error:null}),
   bookingIds.length?db.from("mzs_booking_legacy_overrides").select("booking_id,guest_name,invoice_recipient_name").in("booking_id",bookingIds):Promise.resolve({data:[],error:null}),
   profileIds.length?db.from("profiles").select("id,full_name").in("id",profileIds):Promise.resolve({data:[],error:null})
 ]);
 if(legacyMatches.error)errors.push("historic confirmation data");
 if(legacyOverrides.error)errors.push("historical corrections");
 if(guestProfiles.error)errors.push("guest profiles");
 const historicByBooking=new Map((legacyMatches.data||[]).map(item=>[item.booking_id,item]));
 const overridesByBooking=new Map((legacyOverrides.data||[]).map(item=>[item.booking_id,item]));
 const guestNamesById=new Map((guestProfiles.data||[]).map(item=>[item.id,item.full_name]));
 const ownerBookingIds=new Set((requests.data||[]).map(r=>r.booking_id).filter(Boolean));
 const rows:Item[]=[
  ...(bookings.data||[]).filter(b=>!ownerBookingIds.has(b.id)).map(b=>({
   id:b.id,category:(b.status==="blocked"?"Unavailable":"Guest booking") as Item["category"],
   property:names.get(b.project_id)||"Property",checkIn:b.check_in,checkOut:b.check_out,
   status:b.status,amount:b.quoted_total_eur==null?"Not priced":new Intl.NumberFormat(adminLocale,{style:"currency",currency:"EUR"}).format(Number(b.quoted_total_eur)),
   href:"/admin?tab=bookings",editable:["confirmed","requested"].includes(b.status)&&!b.is_test,total:b.quoted_total_eur===null?null:Number(b.quoted_total_eur),guestCount:b.guest_count,notes:b.admin_notes||"",guestName:overridesByBooking.get(b.id)?.guest_name||historicByBooking.get(b.id)?.source_guest_name||(b.user_id?guestNamesById.get(b.user_id):null)||"No account / name",invoiceRecipient:overridesByBooking.get(b.id)?.invoice_recipient_name||historicByBooking.get(b.id)?.invoice_recipient_name||"",sourceRef:historicByBooking.get(b.id)?(`${historicByBooking.get(b.id)?.original_booking_number} · ${historicByBooking.get(b.id)?.source_key}`):""
  })),
  ...(requests.data||[]).map(r=>({
   id:r.id,category:"Owner stay" as const,property:names.get(grantsById.get(r.partner_id))||"Property",
   checkIn:r.check_in,checkOut:r.check_out,status:r.status,amount:"€0.00",href:"/admin/owner-stays",editable:false,total:0,guestCount:null,notes:"",guestName:"Owner / partner",invoiceRecipient:"Complimentary",sourceRef:""
  }))
 ].sort((a,b)=>b.checkIn.localeCompare(a.checkIn));
 const style={color:"#f0e9de",background:"#12110f",border:"1px solid #504534",padding:"14px"} as const;
 return <main style={{minHeight:"100vh",background:"#0d0d0c",color:"#eee8dd",padding:"40px clamp(20px,5vw,70px)"}}>
  <Link href="/admin" style={{color:"#d5c09a"}}>{adminT("← Group Administration")}</Link>
  <p style={{fontSize:11,letterSpacing:3,color:"#d5c09a",marginTop:30}}>{adminT("MZS GROUP / BOOKINGS")}</p>
  <h1 style={{fontFamily:"Georgia,serif",fontWeight:400}}>{adminT("Bookings.")}</h1>
  <p style={{color:"#aaa398",maxWidth:850}}>{adminT("Your central reservation register for current, historic and future bookings. Search by guest, company, reference, property or year, then open the full reservation dossier. Booking requests, calendars and complimentary owner stays retain their dedicated approval controls.")}</p>
  <nav style={{display:"flex",flexWrap:"wrap",gap:12,margin:"25px 0"}}>
   <Link href="/admin/bookings" style={{...style,borderColor:"#d5c09a",color:"#d5c09a"}}>{adminT("All Bookings")}</Link>
   <Link href="/admin?tab=bookings" style={style}>{adminT("Requests, cancellations & calendar →")}</Link>
   <Link href="/admin/owner-stays" style={style}>{adminT("Owner stays →")}</Link>
   <Link href="/admin/group/estates/contracts?view=invoices" style={style}>{adminT("Contracts & invoices →")}</Link>
   <Link href="/admin/group/estates/properties" style={style}>{adminT("Properties →")}</Link>
  </nav>
  {errors.length>0&&<p role="alert" style={{color:"#e3a995"}}>{adminT("Incomplete registers:")} {errors.join(", ")}{adminT(". Verify records in the source module.")}</p>}
  <section style={{display:"flex",gap:12,flexWrap:"wrap",margin:"25px 0"}} aria-label={adminT("Loaded booking summary")}>
   {[["Guest bookings",rows.filter(x=>x.category==="Guest booking").length],
      ["Awaiting review",rows.filter(x=>x.status==="requested").length],
      ["Owner stays",rows.filter(x=>x.category==="Owner stay").length],
      ["Blocked periods",rows.filter(x=>x.category==="Unavailable").length]].map(([label,total])=>
      <div key={label} style={{...style,minWidth:160}}><small style={{color:"#d5c09a"}}>{adminT(label)}</small><p style={{fontSize:26,margin:"8px 0"}}>{total}</p></div>)}
  </section>
  <p style={{color:"#a9a092",fontSize:12}}>{adminT("Summary counts reflect the records loaded in this register, not financial receipts. Requests are approved in Requests & Calendar. Historical corrections remain audit-logged.")}</p>
  <BookingRegister rows={rows.map(({id,category,property,checkIn,checkOut,status,amount,href,guestName,invoiceRecipient,sourceRef})=>({id,category,property,checkIn,checkOut,status,amount,href,guestName,invoiceRecipient,sourceRef}))}/>
  {!rows.length&&<p>{adminT("No records available in the current reporting scope.")}</p>}
 </main>;
}
