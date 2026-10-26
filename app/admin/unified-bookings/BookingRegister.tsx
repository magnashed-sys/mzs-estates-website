"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
export type BookingRow={id:string;category:"Guest booking"|"Owner stay"|"Unavailable";property:string;checkIn:string;checkOut:string;status:string;amount:string;href:string};
export default function BookingRegister({rows}:{rows:BookingRow[]}){
 const [query,setQuery]=useState("");
 const [kind,setKind]=useState("all");
 const [status,setStatus]=useState("all");
 const [time,setTime]=useState("all");
 const [property,setProperty]=useState("all");
 const today=new Date().toISOString().slice(0,10);
 const properties=useMemo(()=>Array.from(new Set(rows.map(r=>r.property))).sort(),[rows]);
 const statuses=useMemo(()=>Array.from(new Set(rows.map(r=>r.status))).sort(),[rows]);
 const filtered=useMemo(()=>rows.filter(r=>
  (kind==="all"||r.category===kind)&&
  (status==="all"||r.status===status)&&
  (property==="all"||r.property===property)&&
  (time==="all"||(time==="upcoming"?r.checkIn>=today:time==="current"?r.checkIn<=today&&r.checkOut>today:r.checkOut<=today))&&
  (!query||[r.property,r.id,r.category,r.status,r.checkIn,r.checkOut].some(v=>v.toLowerCase().includes(query.toLowerCase().trim())))
 ),[rows,kind,status,property,time,query,today]);
 const control={padding:"10px 12px",background:"#171511",color:"#eee8dd",border:"1px solid #71614b",borderRadius:4,minWidth:130} as const;
 return <section aria-label="Unified reservation register">
  <div style={{background:"#151411",border:"1px solid #514839",padding:18,marginBottom:18}}>
   <h2 style={{fontFamily:"Georgia,serif",fontWeight:400,marginTop:0}}>Find reservations</h2>
   <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"end"}}>
    <label style={{display:"grid",gap:6}}>Search<input style={control} aria-label="Search reservations" value={query} placeholder="Property or reference" onChange={e=>setQuery(e.target.value)}/></label>
    <label style={{display:"grid",gap:6}}>Type<select style={control} value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All types</option>{["Guest booking","Owner stay","Unavailable"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label style={{display:"grid",gap:6}}>Property<select style={control} value={property} onChange={e=>setProperty(e.target.value)}><option value="all">All properties</option>{properties.map(x=><option key={x}>{x}</option>)}</select></label>
    <label style={{display:"grid",gap:6}}>Status<select style={control} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{statuses.map(x=><option key={x}>{x}</option>)}</select></label>
    <label style={{display:"grid",gap:6}}>Period<select style={control} value={time} onChange={e=>setTime(e.target.value)}><option value="all">All dates</option><option value="upcoming">Upcoming check-ins</option><option value="current">Current stays</option><option value="past">Completed stays</option></select></label>
    <button style={control} type="button" onClick={()=>{setQuery("");setKind("all");setStatus("all");setProperty("all");setTime("all")}}>Reset filters</button>
   </div>
   <p aria-live="polite" style={{color:"#bcb2a4",marginBottom:0}}>{filtered.length} of {rows.length} loaded records. The register is limited to the latest 250 entries per source.</p>
  </div>
  <div style={{overflowX:"auto"}}>
   <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
    <thead><tr>{["Reservation","Property","Type","Check-in","Check-out","Status","Amount"].map(k=><th key={k} style={{textAlign:"left",borderBottom:"1px solid #655944",padding:12}}>{k}</th>)}</tr></thead>
    <tbody>{filtered.map(r=><tr key={r.category+r.id}>
     <td style={{padding:12,borderBottom:"1px solid #3d382f"}}><Link style={{color:"#d5c09a",fontWeight:600}} href={r.category==="Owner stay"?r.href:"/admin/unified-bookings/"+r.id}>{r.category==="Owner stay"?"Manage owner stay →":"Open dossier →"}</Link></td>
     <td>{r.property}</td><td>{r.category}</td><td>{r.checkIn}</td><td>{r.checkOut}</td><td>{r.status}</td><td>{r.amount}</td>
    </tr>)}</tbody>
   </table>
  </div>
  {filtered.length===0&&<p>No matching reservations. Change the filters or search term.</p>}
 </section>;
}
