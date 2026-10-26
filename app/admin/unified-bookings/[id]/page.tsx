import Link from "next/link";
import {notFound} from "next/navigation";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import BookingEditor from "../BookingEditor";
import {recordBookingReceipt,reverseBookingReceipt,createBookingInvoiceDraft} from "./actions";
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
 const receiptResult=await db.from("mzs_booking_receipts").select("id,amount,received_on,reference,notes,created_at,reversed_at,reversal_reason").eq("booking_id",id).order("received_on",{ascending:false}).limit(250);
 const receipts=receiptResult.data||[];
 const receiptTotal=receipts.filter(r=>!r.reversed_at).reduce((sum,r)=>sum+Math.round(Number(r.amount)*100),0)/100;
 const chargeable=!owner&&b.status==="confirmed"&&Number(b.quoted_total_eur)>0;
 const [invoiceDraft,issuerList]=await Promise.all([db.from("mzs_booking_invoice_drafts").select("id,recipient_name,gross_total,net_total,vat_total,vat_rate,tax_note,created_at,issuer_id").eq("booking_id",id).maybeSingle(),db.from("mzs_lease_issuers").select("id,name,tax_id,prefix").order("name")]);
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
  <section style={{...card,marginTop:20}}><h2>Booking payments</h2>
    <p>Recorded booking value: <strong>{money(b.quoted_total_eur)}</strong></p>
    <p>Receipts recorded against this booking: <strong>{receiptResult.error?"Unavailable":money(receiptTotal)}</strong></p>
    <p>Remaining balance: <strong>{receiptResult.error||b.quoted_total_eur===null?"Unavailable":money(Number(b.quoted_total_eur)-receiptTotal)}</strong></p>
    <p style={{color:"#bcb2a4"}}>These are manually registered booking receipts, not issued invoices or verified bank-feed transactions. The balance is based on the recorded booking total and these receipts only; it is not added to the recurring lease-contract payment ledger.</p>
    {receiptResult.error&&<p role="alert">Booking receipts could not be loaded. Do not rely on this balance.</p>}
    {receipts.length>0&&<div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}><thead><tr><th>Date</th><th>Amount</th><th>Reference</th><th>Notes</th><th>Correction</th></tr></thead><tbody>{receipts.map(r=><tr key={r.id}><td>{r.received_on}</td><td>{money(r.amount)}</td><td>{r.reference}</td><td>{r.notes||"—"}{r.reversed_at&&<p style={{color:"#e8b29c"}}>Reversed · {new Date(r.reversed_at).toLocaleString("en-GB")}<br/>{r.reversal_reason}</p>}</td><td>{r.reversed_at?"Reversed":<form action={reverseBookingReceipt} style={{display:"grid",gap:6}}><input type="hidden" name="receipt_id" value={r.id}/><input name="reason" required minLength={5} maxLength={500} placeholder="Reason for reversal" aria-label="Reversal reason" style={{padding:7}}/><button type="submit">Reverse receipt</button></form>}</td></tr>)}</tbody></table></div>}
    {chargeable&&!receiptResult.error&&<form action={recordBookingReceipt} style={{marginTop:22,display:"grid",gap:12,maxWidth:420}}>
      <h3>Record a received payment</h3>
      <input type="hidden" name="booking_id" value={id}/>
      <label>Amount (€) <input style={{display:"block",padding:9,width:"100%"}} name="amount" type="number" min="0.01" step="0.01" required/></label>
      <label>Date received <input style={{display:"block",padding:9,width:"100%"}} name="received_on" type="date" required/></label>
      <label>Unique bank reference <input style={{display:"block",padding:9,width:"100%"}} name="reference" maxLength={200} required/></label>
      <label>Internal notes <textarea style={{display:"block",padding:9,width:"100%"}} name="notes" maxLength={2000}/></label>
      <button type="submit" style={{padding:12,background:"#d5c09a",color:"#181410",fontWeight:600}}>Record receipt</button>
      <small style={{color:"#bcb2a4"}}>Record only actual cleared receipts. Use a unique reference to prevent accidental duplicate registration.</small>
    </form>}
    <p><Link href="/admin/group/estates/contracts?view=invoices" style={{color:"#d5c09a"}}>Open recurring lease invoices & payments →</Link></p>
  </section>
  <section style={{...card,marginTop:20}}><h2>Reservation invoicing</h2>
    <p style={{color:"#bcb2a4"}}>Invoice drafts only. No invoice number is consumed, no invoice is issued and no email is sent. The VAT rate must be verified by the administrator for the property, issuer and transaction.</p>
    {(invoiceDraft.error||issuerList.error)&&<p role="alert">Invoice configuration could not be loaded; draft creation is unavailable.</p>}
    {invoiceDraft.data?<div>
       <p><strong>Draft registered</strong> · {new Date(invoiceDraft.data.created_at).toLocaleString("en-GB")}</p>
       <p>Recipient: {invoiceDraft.data.recipient_name}</p>
       <p>Gross: {money(invoiceDraft.data.gross_total)} · VAT: {money(invoiceDraft.data.vat_total)} · Net: {money(invoiceDraft.data.net_total)}</p>
       <p>VAT assessment: {invoiceDraft.data.tax_note}</p>
       <small>Issuer selection and totals are snapshotted in the draft. Issuance requires a separate approval workflow.</small>
    </div>:chargeable&&!invoiceDraft.error&&!issuerList.error?<form action={createBookingInvoiceDraft} style={{display:"grid",gap:12,maxWidth:480}}>
      <input type="hidden" name="booking_id" value={id}/>
      <label>Issuing entity <select name="issuer_id" required defaultValue="" style={{display:"block",padding:10,width:"100%"}}><option value="" disabled>Select issuing entity</option>{(issuerList.data||[]).map(i=><option key={i.id} value={i.id}>{i.name} · {i.prefix||"No prefix"}</option>)}</select></label>
      {(issuerList.data||[]).length===0&&<p role="alert">No issuing entity is configured. Create an issuer in Rental Contracts before drafting an invoice.</p>}
      <label>Invoice recipient <input name="recipient_name" maxLength={250} required defaultValue={guest?.full_name||""} style={{display:"block",padding:10,width:"100%"}}/></label>
      <label>Recipient email <input name="recipient_email" type="email" maxLength={254} defaultValue={guest?.email||""} style={{display:"block",padding:10,width:"100%"}}/></label>
      <label>VAT rate (%) <input name="vat_rate" type="number" min="0" max="100" step="0.0001" required placeholder="Enter verified rate" style={{display:"block",padding:10,width:"100%"}}/></label>
      <label>VAT / tax assessment notes <textarea name="tax_note" required minLength={5} maxLength={1000} placeholder="Explain the VAT rate or exemption after checking applicable treatment" style={{display:"block",padding:10,width:"100%"}}/></label>
      <p>Total including VAT: <strong>{money(b.quoted_total_eur)}</strong>. The draft calculates net and VAT components from this existing total.</p>
      <button type="submit" disabled={(issuerList.data||[]).length===0} style={{padding:12,background:"#d5c09a",color:"#181410",fontWeight:600}}>Save invoice draft</button>
    </form>:<p>No invoice draft available for this booking type or status.</p>}
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
