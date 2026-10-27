import Link from "next/link";
import {redirect} from "next/navigation";
import {requireEstateAdmin} from "../../../lib/security/estate-properties";

export const dynamic="force-dynamic";
type RawParams=Record<string,string|string[]|undefined>;
type Row={
 id:string;category:"Guest booking"|"Owner stay"|"Unavailable";
 property:string;checkIn:string;checkOut:string;status:string;
 amount:number|null;href:string;guestName:string;invoiceRecipient:string;sourceRef:string;
};
type Result={total:number;items:Row[];years:number[];properties:{id:string;name:string}[];
 summary:{guest:number;owner:number;blocked:number;requested:number};
 offset:number;limit:number};
const param=(input:RawParams,key:string)=>{
 const value=input[key];return typeof value==="string"?value.trim():"";
};
const money=(v:number|null)=>v===null?"Not priced":new Intl.NumberFormat("en-GB",{style:"currency",currency:"EUR"}).format(v);
const formatDate=(s:string)=>s?new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(s+"T12:00:00Z")):"—";
const UUID=/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const style={background:"#151411",border:"1px solid #514839",padding:20,borderRadius:5} as const;
const control={padding:"11px 12px",minWidth:155,maxWidth:"100%",boxSizing:"border-box",color:"#eee8dd",background:"#1d1b16",border:"1px solid #726046",borderRadius:4,minHeight:44} as const;
const linkStyle={color:"#d5c09a",textDecoration:"none"} as const;
const statuses=["requested","confirmed","cancelled","declined","blocked","test_approved","approved","pending","rejected","withdrawn"];
const categories=["Guest booking","Owner stay","Unavailable"];
const periods:[string,string][]=[["all","All dates"],["upcoming","Upcoming check-ins"],["current","Current stays"],["past","Completed stays"]];
export default async function AdminBookings({searchParams}:{searchParams:Promise<RawParams>}){
 const {db}=await requireEstateAdmin();
 const params=await searchParams;
 const query=param(params,"q").slice(0,150);
 const yearRaw=param(params,"year");
 const year=/^\d{4}$/.test(yearRaw)&&Number(yearRaw)>=1900&&Number(yearRaw)<=2199?Number(yearRaw):null;
 const property=UUID.test(param(params,"property"))?param(params,"property"):null;
 const category=categories.includes(param(params,"category"))?param(params,"category"):"all";
 const status=statuses.includes(param(params,"status"))?param(params,"status"):"all";
 const period=periods.some(x=>x[0]===param(params,"period"))?param(params,"period"):"all";
 const archive=["active","archived","all"].includes(param(params,"archive"))?param(params,"archive"):"active";
 const pageSize=[25,50,100].includes(Number(param(params,"size")))?Number(param(params,"size")):25;
 const page=Math.min(Math.max(Number.parseInt(param(params,"page"),10)||1,1),1000);
 const offset=(page-1)*pageSize;
 const {data,error}=await db.rpc("mzs_admin_bookings_search_v2",{
   p_query:query,p_year:year,p_property:property,p_category:category,
   p_status:status,p_period:period,p_archive:archive,p_offset:offset,p_limit:pageSize
 });
 const payload=error?null:data as Result|null;
 const rows=Array.isArray(payload?.items)?payload.items:[];
 const ownerRequestIds=rows.filter(r=>r.category==="Owner stay").map(r=>r.id);
 const ownerLinks=ownerRequestIds.length?await db.from("mzs_owner_stay_requests").select("id,booking_id").in("id",ownerRequestIds):{data:[],error:null};
 const ownerBookings=new Map((ownerLinks.data||[]).map(r=>[r.id,r.booking_id]));
 const total=typeof payload?.total==="number"?payload.total:0;
 const maxPage=Math.max(1,Math.ceil(total/pageSize));
 const href=(next:number)=>{
  const p=new URLSearchParams();
  if(archive!=="active")p.set("archive",archive);
  if(query)p.set("q",query);if(year)p.set("year",String(year));
  if(property)p.set("property",property);
  if(category!=="all")p.set("category",category);
  if(status!=="all")p.set("status",status);
  if(period!=="all")p.set("period",period);
  if(pageSize!==25)p.set("size",String(pageSize));
  if(next>1)p.set("page",String(next));
  return "/admin/bookings"+(p.toString()?"?"+p.toString():"");
 };
 if(!error&&page>maxPage)redirect(href(maxPage));
 const returnTo=href(page);
 const dossierHref=(r:Row)=>{
  const bookingId=r.category==="Owner stay"?ownerBookings.get(r.id):r.id;
  return bookingId?"/admin/bookings/"+bookingId+"?"+new URLSearchParams({returnTo}).toString():"/admin/owner-stays#request-"+r.id;
 };
 const loadedFrom=total===0?0:offset+1;
 const loadedTo=Math.min(offset+rows.length,total);
 return <main style={{background:"#0d0d0c",color:"#eee8dd",minHeight:"100vh",padding:"36px clamp(18px,4vw,60px)"}}>
  <div style={{maxWidth:1500,margin:"0 auto"}}>
   <Link href="/admin/workspaces/group" style={linkStyle}>← Group Administration</Link>
   <p style={{fontSize:11,letterSpacing:3,color:"#d5c09a",marginTop:30}}>MZS GROUP / ADMINISTRATION</p>
   <h1 style={{fontFamily:"Georgia,serif",fontWeight:400,fontSize:"clamp(36px,5vw,58px)",margin:"8px 0"}}>Bookings.</h1>
   <p style={{color:"#b5ac9c",maxWidth:850,lineHeight:1.8}}>Central reservations and owner stays. Search and filter your full booking history in the database, then open an audited dossier. Original booking details and corrected billing recipients remain available.</p>
   <nav aria-label="Booking workflows" style={{display:"flex",gap:10,flexWrap:"wrap",margin:"24px 0"}}>
    <Link href="/admin/bookings" style={{...control,...linkStyle,borderColor:"#d5c09a"}}>All Bookings</Link>
    <Link href="/admin/bookings/operations" style={{...control,...linkStyle}}>Requests &amp; Calendar</Link>
    <Link href="/admin/bookings/operations?scope=test" style={{...control,...linkStyle}}>Test cleanup</Link>
    <Link href="/admin/owner-stays" style={{...control,...linkStyle}}>Owner stays</Link>
    <Link href="/admin/group/estates/contracts?view=invoices" style={{...control,...linkStyle}}>Contracts &amp; Invoices</Link>
    <Link href="/admin/group/estates/properties" style={{...control,...linkStyle}}>Properties</Link>
   </nav>
   <section style={style} aria-label="Search and filter bookings">
    <h2 style={{fontFamily:"Georgia,serif",fontWeight:400,fontSize:25,margin:"0 0 18px"}}>Find reservations</h2>
    <form action="/admin/bookings" method="GET" style={{display:"flex",gap:12,alignItems:"end",flexWrap:"wrap"}}>
     <label style={{display:"grid",gap:6}}>Search
      <input style={{...control,width:250}} name="q" maxLength={150} defaultValue={query} placeholder="Guest, company, original reference…"/>
     </label>
     <label style={{display:"grid",gap:6}}>Year (check-in)
      <select style={control} name="year" defaultValue={year??""}><option value="">All years</option>{(payload?.years||[]).map(y=><option key={y} value={y}>{y}</option>)}</select>
     </label>
     <label style={{display:"grid",gap:6}}>Property
      <select style={control} name="property" defaultValue={property??""}><option value="">All properties</option>{(payload?.properties||[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
     </label>
     <label style={{display:"grid",gap:6}}>Type
      <select style={control} name="category" defaultValue={category}><option value="all">All types</option>{categories.map(x=><option key={x} value={x}>{x}</option>)}</select>
     </label>
     <label style={{display:"grid",gap:6}}>Status
      <select style={control} name="status" defaultValue={status}><option value="all">All statuses</option>{statuses.map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select>
     </label>
     <label style={{display:"grid",gap:6}}>Period
      <select style={control} name="period" defaultValue={period}>{periods.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
     </label>
     <label style={{display:"grid",gap:6}}>Archive
      <select style={control} name="archive" defaultValue={archive}><option value="active">Not archived</option><option value="archived">Archived</option><option value="all">Including archive</option></select>
     </label>
     <label style={{display:"grid",gap:6}}>Per page
      <select style={control} name="size" defaultValue={pageSize}>{[25,50,100].map(x=><option key={x} value={x}>{x}</option>)}</select>
     </label>
     <button style={{...control,background:"#d5c09a",color:"#1a1711",fontWeight:700,cursor:"pointer"}} type="submit">Apply filters</button>
     <Link href="/admin/bookings" style={{...control,...linkStyle}}>Reset</Link>
    </form>
    {error&&<p role="alert" style={{color:"#e3a995"}}>Booking records could not be loaded. Please refresh or try again. No data has been modified.</p>}
    {!error&&<p role="status" style={{color:"#c1b9a9",margin:"18px 0 0"}}>
      Showing {loadedFrom}–{loadedTo} of <strong style={{color:"#d5c09a"}}>{total}</strong> matching records · Page {page} of {maxPage}. Search and filters apply to the full register, not only the current page.
    </p>}
   </section>
   {!error&&<section aria-label="Filtered booking totals" style={{display:"flex",flexWrap:"wrap",gap:12,margin:"18px 0 22px"}}>
    {([["Guest bookings",payload?.summary?.guest],["Awaiting review",payload?.summary?.requested],["Owner stays",payload?.summary?.owner],["Unavailable periods",payload?.summary?.blocked]] as const).map(([name,amount])=>
      <div key={name} style={{...style,minWidth:165,flex:"1 1 160px"}}><small style={{color:"#d5c09a"}}>{name}</small>
       <p style={{fontSize:29,margin:"8px 0 0"}}>{amount??0}</p>
      </div>)}
   </section>}
   {!error&&<section aria-label="Matching booking records" style={{...style,padding:0,overflow:"hidden"}}>
    <div style={{overflowX:"auto"}}>
     <table style={{width:"100%",minWidth:1120,borderCollapse:"collapse",textAlign:"left"}}>
      <thead style={{background:"#1e1b16"}}><tr>{["Reservation","Guest / contact","Invoice recipient","Original reference","Property","Type","Check-in","Check-out","Status","Agreed amount"].map(h=><th key={h} style={{padding:"16px 12px",borderBottom:"1px solid #514839",fontWeight:500,color:"#d5c09a"}}>{h}</th>)}</tr></thead>
      <tbody>{rows.map(r=><tr key={r.category+r.id} style={{borderBottom:"1px solid #373229"}}>
       <td style={{padding:12}}><Link href={dossierHref(r)} style={linkStyle}>{r.category==="Owner stay"&&!ownerBookings.get(r.id)?"Manage request →":"Open dossier →"}</Link></td>
       <td style={{padding:12}}>{r.guestName}</td>
       <td style={{padding:12}}>{r.invoiceRecipient||"—"}</td>
       <td style={{padding:12,whiteSpace:"nowrap",fontSize:12}}>{r.sourceRef||"—"}</td>
       <td style={{padding:12}}>{r.property}</td>
       <td style={{padding:12}}>{r.category}</td>
       <td style={{padding:12,whiteSpace:"nowrap"}}>{formatDate(r.checkIn)}</td>
       <td style={{padding:12,whiteSpace:"nowrap"}}>{formatDate(r.checkOut)}</td>
       <td style={{padding:12}}>{r.status.replaceAll("_"," ")}</td>
       <td style={{padding:12,whiteSpace:"nowrap"}}>{r.category==="Owner stay"?"Complimentary":money(r.amount)}</td>
      </tr>)}</tbody>
     </table>
    </div>
    {!rows.length&&<p style={{padding:22}}>No reservations match these filters. Change the year or search terms.</p>}
   </section>}
   {!error&&<nav aria-label="Booking result pages" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,margin:"22px 0",flexWrap:"wrap"}}>
    <div>{page>1?<Link style={{...control,...linkStyle}} href={href(page-1)}>← Previous page</Link>:<span style={{color:"#77736b"}}>First page</span>}</div>
    <span style={{color:"#c1b9a9"}}>Page {page} / {maxPage}</span>
    <div>{page<maxPage?<Link style={{...control,...linkStyle}} href={href(page+1)}>Next page →</Link>:<span style={{color:"#77736b"}}>Last page</span>}</div>
   </nav>}
   <p style={{color:"#8f8778",fontSize:12,lineHeight:1.6}}>Reservations are listed by arrival date, newest first. Confirmed amounts are not proof of payment. Booking requests, cancellations and owner stays continue to use their existing controlled workflows.</p>
  </div>
 </main>;
}
