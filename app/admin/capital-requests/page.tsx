"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import styles from "./requests.module.css";

type RequestRecord = {
 id: string; user_id: string; request_type: "capital" | "possibilities";
 amount_eur: number; explanation: string; status: string;
 email_status: string; created_at: string;
};
const stages = ["new", "in_review", "contacted", "closed"];
export default function CapitalRequestsAdmin() {
 const [items, setItems] = useState<RequestRecord[]>([]);
 const [names, setNames] = useState<Record<string,string>>({});
 const [state, setState] = useState("loading");
 const [busy, setBusy] = useState("");
 const [notice, setNotice] = useState("");
 const load = useCallback(async () => {
   const supabase = createClient();
   const { data: auth } = await supabase.auth.getUser();
   if (!auth.user) { setState("denied"); return; }
   const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id",auth.user.id).single();
   if (profile?.role !== "admin" || !profile.is_active) { setState("denied"); return; }
   const { data, error } = await supabase.from("mzs_capital_requests")
     .select("id,user_id,request_type,amount_eur,explanation,status,email_status,created_at")
     .order("created_at",{ascending:false}).limit(300);
   if (error) { setState("error"); return; }
   const rows = (data || []) as RequestRecord[];
   const ids = [...new Set(rows.map(x => x.user_id))];
   if(ids.length) {
     const people = await supabase.from("profiles").select("id,full_name,email").in("id",ids);
     if(!people.error) setNames(Object.fromEntries((people.data || []).map(p=>[p.id,(p.full_name || "Member") + (p.email ? " · "+p.email : "")])));
   }
   setItems(rows);setState("ready");
 },[]);
 useEffect(()=>{void load();},[load]);
 async function update(id:string,status:string) {
   if (busy || !stages.includes(status)) return;
   setBusy(id);setNotice("");
   try {
     const response = await fetch("/api/capital-requests/admin",{
       method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})
     });
     if(!response.ok) throw new Error("Update not confirmed.");
     await load();
     setNotice("Status updated.");
   } catch {setNotice("Could not confirm update. Reload before retrying.");}
   finally{setBusy("");}
 }
 return <main className={styles.page}>
   <Link href="/admin">← MZS Group Administration</Link>
   <p className={styles.kicker}>MZS CAPITAL / ADMINISTRATION</p>
   <h1>Capital Requests</h1>
   <p>Private financing enquiries and available investment capital.</p>
   {state==="loading" && <p>Loading requests…</p>}
   {state==="denied" && <p>Administrator access required.</p>}
   {state==="error" && <p>Unable to load capital requests.</p>}
   {notice && <p role="status">{notice}</p>}
   {state==="ready" && (items.length===0?<p>No capital requests received yet.</p>:
   <div className={styles.list}>{items.map(item=><article key={item.id} className={styles.card}>
    <div className={styles.top}><strong>{item.request_type==="capital"?"Request Capital":"Request Possibilities"}</strong>
      <span>{new Date(item.created_at).toLocaleString("en-GB",{timeZone:"Europe/Madrid"})}</span></div>
    <h2>{new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR"}).format(item.amount_eur)}</h2>
    <p>{names[item.user_id] || "Member · "+item.user_id}</p>
    <p className={styles.explanation}>{item.explanation}</p>
    <p>Admin email: {item.email_status}</p>
    <label>Status <select aria-label={"Status for "+item.id} value={item.status}
      onChange={e=>void update(item.id,e.target.value)} disabled={busy!==""}>
       {stages.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}
    </select></label>
    <small>Reference: {item.id}</small>
   </article>)}</div>)}
 </main>;
}
