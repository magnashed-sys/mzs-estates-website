import Link from "next/link";
import {bookingReturnHref} from "../../../../lib/admin/booking-return";
import {notFound} from "next/navigation";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import TestBookingCleanup from "./TestBookingCleanup";
import BookingCleanup from "./BookingCleanup";
import BookingEditor from "../BookingEditor";
import LegacyBookingEditor from "./LegacyBookingEditor";
import {recordBookingReceipt,reverseBookingReceipt,createBookingInvoiceDraft,reviewBookingInvoiceDraft,editBookingInvoiceDraft} from "./actions";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money=(v:number|string|null)=>v===null?"Not priced":new Intl.NumberFormat("en-GB",{style:"currency",currency:"EUR"}).format(Number(v));
export default async function BookingDossier({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {id}=await params;
 const returnHref=bookingReturnHref((await searchParams).returnTo);
 if(!UUID.test(id))notFound();
 const {db}=await requireEstateAdmin();
 const {data:rows,error}=await db.rpc("admin_list_rental_bookings").eq("id",id).limit(2);
 if(error||!rows||rows.length!==1)notFound();
 const b=rows[0];
 const cleanup=await db.rpc("mzs_admin_booking_cleanup_plan",{p_booking_id:id});
 const [{data:property},{data:guest},{data:owner},changes,prices,notifications]=await Promise.all([
  db.from("projects").select("title").eq("id",b.project_id).maybeSingle(),
  b.user_id?db.from("profiles").select("full_name,email").eq("id",b.user_id).maybeSingle():Promise.resolve({data:null}),
  db.from("mzs_owner_stay_requests").select("id,status").eq("booking_id",id).maybeSingle(),
  db.from("rental_booking_admin_audit").select("id,action,reason,created_at,previous_values,resulting_values").eq("booking_id",id).order("created_at",{ascending:false}).limit(100),
  db.from("mzs_booking_price_audit").select("id,old_total,new_total,reason,created_at").eq("booking_id",id).order("created_at",{ascending:false}).limit(100),
  db.from("rental_change_notifications").select("id,kind,status,attempts,created_at").eq("booking_id",id).order("created_at",{ascending:false}).limit(100)
 ]);
 const receiptResult=await db.from("mzs_booking_receipts").select("id,amount,received_on,reference,notes,created_at,reversed_at,reversal_reason").eq("booking_id",id).order("received_on",{ascending:false}).limit(250);
 const legacyResult=await db.from("mzs_booking_legacy_sources").select("source_key,original_booking_number,confirmation_date,source_guest_name,booking_contact_name,source_email,source_phone,source_address,source_billed_days,source_nights,source_filename,source_sha256,invoice_recipient_kind,invoice_recipient_name,invoice_recipient_relationship_id,invoice_issuer_id,price_breakdown,source_terms").eq("booking_id",id).maybeSingle();
 const legacy=legacyResult.data;
 const [correctionResult,legacyAuditResult,invoiceCompaniesResult]=await Promise.all([
  db.from("mzs_booking_legacy_overrides").select("guest_name,contact_name,contact_email,invoice_recipient_kind,invoice_recipient_name,invoice_recipient_relationship_id,version,modified_at").eq("booking_id",id).maybeSingle(),
  db.from("mzs_booking_legacy_change_audit").select("id,actor_id,reason,created_at,old_booking,new_booking,old_override,new_override").eq("booking_id",id).order("created_at",{ascending:false}).limit(100),
  db.from("mzs_lease_relationships").select("id,name").eq("kind","company").order("name").limit(250)
 ]);
 const currentCorrection=correctionResult.data;
 const effectiveInvoiceRecipient=currentCorrection?.invoice_recipient_name||legacy?.invoice_recipient_name;
 const effectiveGuestName=currentCorrection?.guest_name||legacy?.source_guest_name;
 const effectiveContactEmail=currentCorrection?.contact_email||legacy?.source_email;
 const receipts=receiptResult.data||[];
 const receiptTotal=receipts.filter(r=>!r.reversed_at).reduce((sum,r)=>sum+Math.round(Number(r.amount)*100),0)/100;
 const chargeable=!owner&&b.status==="confirmed"&&Number(b.quoted_total_eur)>0;
 const [invoiceDraft,issuerList]=await Promise.all([db.from("mzs_booking_invoice_drafts").select("id,recipient_name,gross_total,net_total,vat_total,vat_rate,tax_note,created_at,issuer_id,recipient_email,review_status,revision,reviewed_at").eq("booking_id",id).maybeSingle(),db.from("mzs_lease_issuers").select("id,name,tax_id,prefix").order("name")]);
 const editable=!legacy&&!b.is_test&&Boolean(b.user_id)&&["requested","confirmed"].includes(b.status)&&!owner;
 const card={padding:24,border:"1px solid #514839",background:"#151411",borderRadius:6} as const;
 return <main style={{background:"#0d0d0c",color:"#eee8dd",minHeight:"100vh",padding:"42px clamp(20px,5vw,70px)"}}>
  <Link href={returnHref} style={{color:"#d5c09a"}}>← Back to bookings</Link>
  <p style={{color:"#d5c09a",letterSpacing:3,fontSize:11,marginTop:30}}>MZS ESTATES / RESERVATION DOSSIER</p>
  <h1 style={{fontFamily:"Georgia,serif",fontWeight:400}}>{property?.title||"Rental property"}</h1>
  <p style={{color:"#b5ac9c"}}>Booking reference: {b.id}</p>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginBottom:22}}>
    <section style={card}><small>Reservation type</small><h2 style={{fontWeight:400}}>{owner?"Owner stay":b.status==="blocked"?"Unavailable period":"Guest booking"}</h2><p>Status: {b.status}</p></section>
    <section style={card}><small>Stay</small><h2 style={{fontWeight:400}}>{b.check_in} – {b.check_out}</h2><p>{b.guest_count??"Unspecified"} guests</p></section>
    <section style={card}><small>Recorded total</small><h2 style={{fontWeight:400}}>{money(b.quoted_total_eur)}</h2><p>{owner?"Complimentary owner use":"Registered booking amount"}</p></section>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:18}}>
    <section style={card}><h2>Guest & administration</h2><p>Guest: {effectiveGuestName||guest?.full_name||"Not available"}</p><p>Contact email: {effectiveContactEmail||guest?.email||"Not available"}</p><p>Account: {guest?.email?("Linked: "+guest.email):"No account linked"}</p><p>Internal notes: {b.admin_notes||"None"}</p></section>
    <section style={card}><h2>Manage reservation</h2>
      {!cleanup.error&&cleanup.data?<BookingCleanup key={cleanup.data.fingerprint} bookingId={id} plan={cleanup.data} returnHref={returnHref}/>:<p role="alert">Cleanup options could not be loaded. Refresh to verify.</p>}
      {b.is_test&&["requested","test_approved","declined","cancelled"].includes(b.status)&&<TestBookingCleanup bookingId={b.id} returnHref={returnHref}/>}
      {legacy&&!correctionResult.error&&!invoiceCompaniesResult.error&&b.status==="confirmed"&&!b.is_test&&!owner?<LegacyBookingEditor key={id+"-"+(currentCorrection?.version||0)} booking={{id:b.id,checkIn:b.check_in,checkOut:b.check_out,checkInTime:(b.preferred_check_in||"").slice(0,5),checkOutTime:(b.preferred_check_out||"").slice(0,5),guestCount:b.guest_count,total:b.quoted_total_eur===null?null:Number(b.quoted_total_eur),notes:b.admin_notes||""}} source={{guestName:effectiveGuestName||"",contactName:currentCorrection?.contact_name||legacy.booking_contact_name,contactEmail:effectiveContactEmail||"",billingKind:(currentCorrection?.invoice_recipient_kind||legacy.invoice_recipient_kind) as "person"|"company",invoiceRecipient:effectiveInvoiceRecipient||"",companyId:currentCorrection?.invoice_recipient_relationship_id||legacy.invoice_recipient_relationship_id,version:currentCorrection?.version||0}} companies={invoiceCompaniesResult.data||[]}/>:editable?<BookingEditor booking={{id:b.id,checkIn:b.check_in,checkOut:b.check_out,guestCount:b.guest_count,total:b.quoted_total_eur===null?null:Number(b.quoted_total_eur),notes:b.admin_notes||""}}/>:
        <><p>{legacy&&!b.user_id?"Imported reservation without a client login. The standard client-booking editor cannot update it; the imported confirmation remains authoritative.":"This reservation uses a dedicated workflow or is not eligible for modification here."}</p><Link href={owner?"/admin/owner-stays":"/admin/bookings/operations"} style={{color:"#d5c09a"}}>Open booking operations →</Link></>}
      <p style={{color:"#a8a093",fontSize:12}}>Changes use the existing permission-checked booking functions. Amount changes require an audit reason.</p>
    </section>
  </div>
  {legacy&&<section style={{...card,marginTop:20}} aria-label="Original booking and billing recipient">
    <h2>Original confirmation & billing recipient</h2>
    <p><strong>Original reference:</strong> {legacy.original_booking_number} · <strong>Source ID:</strong> {legacy.source_key}</p>
    <p><strong>Booking contact:</strong> {legacy.booking_contact_name}</p>
    <p><strong>Invoice recipient on original confirmation:</strong> {legacy.invoice_recipient_name} ({legacy.invoice_recipient_kind==="company"?"Company":"Private person"})</p>
    {currentCorrection&&<p><strong>Current invoice recipient:</strong> {currentCorrection.invoice_recipient_name} ({currentCorrection.invoice_recipient_kind==="company"?"Company":"Private person"}) · last corrected {new Date(currentCorrection.modified_at).toLocaleString("en-GB")}</p>}
    <p><strong>Issuing entity:</strong> Mase Estates SL</p>
    <p><strong>Source file:</strong> {legacy.source_filename} · page 1</p>
    <p><strong>Confirmation date:</strong> {legacy.confirmation_date||"Not stated"}</p>
    <p><strong>Contact address:</strong> {Object.values(legacy.source_address||{}).filter(Boolean).join(" · ")||"Not stated"}</p>
    <p><strong>Source billed days:</strong> {legacy.source_billed_days} · <strong>Original nights:</strong> {legacy.source_nights} · <strong>Current nights:</strong> {Math.round((Date.parse(b.check_out+"T00:00:00Z")-Date.parse(b.check_in+"T00:00:00Z"))/86400000)}</p>
    {legacy.source_billed_days!==legacy.source_nights&&<p style={{color:"#e3a995"}}>The historical confirmation bills a different number of days than the date difference. The originally agreed total was preserved.</p>}
    <details><summary>Original price components and special terms</summary>
      <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>{JSON.stringify(legacy.price_breakdown,null,2)}{"\n"}{JSON.stringify(legacy.source_terms,null,2)}</pre>
    </details>
    {correctionResult.error&&<p role="alert">Historical correction information could not be loaded; editing is unavailable.</p>}
    {legacyResult.error&&<p role="alert">Original confirmation metadata could not be loaded.</p>}
  </section>}
  {legacyResult.error&&<p role="alert" style={{color:"#e3a995"}}>Historical billing metadata could not be loaded. Check the source record before issuing invoices.</p>}
  <section style={{...card,marginTop:20}}><h2>Booking payments</h2>
    <p>Recorded booking value: <strong>{money(b.quoted_total_eur)}</strong></p>
    <p>Receipts recorded against this booking: <strong>{receiptResult.error?"Unavailable":money(receiptTotal)}</strong></p>
    <p>{legacy?"Difference vs registered receipts (not a verified outstanding debt):":"Remaining balance:"} <strong>{receiptResult.error||b.quoted_total_eur===null?"Unavailable":money(Number(b.quoted_total_eur)-receiptTotal)}</strong></p>
    {legacy&&<p style={{color:"#e3a995"}}>Historical payment records have not been reconciled. Do not infer this amount is unpaid or paid until bank records are checked.</p>}
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
    {legacy&&<p style={{color:"#bcb2a4"}}>The invoice recipient is prefilled from the current corrected historic booking. Changes to the invoice recipient must be saved in the booking dossier before starting an invoice draft.</p>}
    {(invoiceDraft.error||issuerList.error)&&<p role="alert">Invoice configuration could not be loaded; draft creation is unavailable.</p>}
    {invoiceDraft.data?<div>
       <p><strong>Draft registered</strong> · {new Date(invoiceDraft.data.created_at).toLocaleString("en-GB")}</p>
       <p>Recipient: {invoiceDraft.data.recipient_name}</p>
       <p>Gross: {money(invoiceDraft.data.gross_total)} · VAT: {money(invoiceDraft.data.vat_total)} · Net: {money(invoiceDraft.data.net_total)}</p>
       <p>VAT assessment: {invoiceDraft.data.tax_note}</p>
       <p>Status: <strong>{invoiceDraft.data.review_status}</strong>{invoiceDraft.data.reviewed_at&&" · reviewed "+new Date(invoiceDraft.data.reviewed_at).toLocaleString("en-GB")}</p>
       {invoiceDraft.data.review_status==="draft"&&<details style={{border:"1px solid #514839",padding:14,margin:"18px 0"}}>
         <summary style={{cursor:"pointer",color:"#d5c09a"}}>Edit draft details</summary>
         <form action={editBookingInvoiceDraft} style={{display:"grid",gap:12,marginTop:16,maxWidth:480}}>
           <input type="hidden" name="booking_id" value={id}/><input type="hidden" name="draft_id" value={invoiceDraft.data.id}/><input type="hidden" name="revision" value={invoiceDraft.data.revision}/>
           <label>Issuing entity<select name="issuer_id" defaultValue={invoiceDraft.data.issuer_id} required style={{display:"block",padding:10,width:"100%"}}>{(issuerList.data||[]).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
           <label>Recipient<input name="recipient_name" defaultValue={invoiceDraft.data.recipient_name} required maxLength={250} style={{display:"block",padding:10,width:"100%"}}/></label>
           <label>Email<input type="email" name="recipient_email" defaultValue={invoiceDraft.data.recipient_email||""} maxLength={254} style={{display:"block",padding:10,width:"100%"}}/></label>
           <label>VAT rate (%)<input type="number" name="vat_rate" defaultValue={Number(invoiceDraft.data.vat_rate)*100} min={0} max={100} step="0.0001" required style={{display:"block",padding:10,width:"100%"}}/></label>
           <label>VAT explanation<textarea name="tax_note" defaultValue={invoiceDraft.data.tax_note} minLength={5} maxLength={1000} required style={{display:"block",padding:10,width:"100%"}}/></label>
           <label>Reason for editing<textarea name="reason" minLength={5} maxLength={500} required style={{display:"block",padding:10,width:"100%"}}/></label>
           <button type="submit" style={{padding:12,background:"#d5c09a",color:"#181410"}}>Save draft changes</button>
         </form>
       </details>}
       <form action={reviewBookingInvoiceDraft} style={{display:"grid",gap:12,maxWidth:480,marginTop:16}}>
        <input type="hidden" name="booking_id" value={id}/>
        <input type="hidden" name="draft_id" value={invoiceDraft.data.id}/>
        <input type="hidden" name="revision" value={invoiceDraft.data.revision}/>
        <label>VAT review notes <textarea name="tax_note" defaultValue={invoiceDraft.data.tax_note} minLength={5} maxLength={1000} required style={{display:"block",padding:10,width:"100%"}}/></label>
        <label>Review decision <select name="review_status" defaultValue={invoiceDraft.data.review_status} style={{display:"block",padding:10,width:"100%"}}><option value="draft">Return to draft</option><option value="reviewed">Mark reviewed</option></select></label>
        <button style={{padding:12,background:"#d5c09a",color:"#181410"}} type="submit">Save review</button>
       </form>
       <small>Issuer selection and totals are snapshotted in the draft. Issuance requires a separate approval workflow.</small>
    </div>:chargeable&&!invoiceDraft.error&&!issuerList.error?<form action={createBookingInvoiceDraft} style={{display:"grid",gap:12,maxWidth:480}}>
      <input type="hidden" name="booking_id" value={id}/>
      <label>Issuing entity <select name="issuer_id" required defaultValue={legacy?.invoice_issuer_id||""} style={{display:"block",padding:10,width:"100%"}}><option value="" disabled>Select issuing entity</option>{(issuerList.data||[]).map(i=><option key={i.id} value={i.id}>{i.name} · {i.prefix||"No prefix"}</option>)}</select></label>
      {(issuerList.data||[]).length===0&&<p role="alert">No issuing entity is configured. Create an issuer in Rental Contracts before drafting an invoice.</p>}
      <label>Invoice recipient <input name="recipient_name" maxLength={250} required defaultValue={effectiveInvoiceRecipient||guest?.full_name||""} style={{display:"block",padding:10,width:"100%"}}/></label>
      <label>Recipient email <input name="recipient_email" type="email" maxLength={254} defaultValue={effectiveContactEmail||guest?.email||""} style={{display:"block",padding:10,width:"100%"}}/></label>
      <label>VAT rate (%) <input name="vat_rate" type="number" min="0" max="100" step="0.0001" required placeholder="Enter verified rate" style={{display:"block",padding:10,width:"100%"}}/></label>
      <label>VAT / tax assessment notes <textarea name="tax_note" required minLength={5} maxLength={1000} placeholder="Explain the VAT rate or exemption after checking applicable treatment" style={{display:"block",padding:10,width:"100%"}}/></label>
      <p>Total including VAT: <strong>{money(b.quoted_total_eur)}</strong>. The draft calculates net and VAT components from this existing total.</p>
      <button type="submit" disabled={(issuerList.data||[]).length===0} style={{padding:12,background:"#d5c09a",color:"#181410",fontWeight:600}}>Save invoice draft</button>
    </form>:<p>No invoice draft available for this booking type or status.</p>}
  </section>
  {legacy&&<section style={{...card,marginTop:20}}>
    <h2>Historical reservation correction log</h2>
    {legacyAuditResult.error?<p role="alert">Correction audit history could not be loaded.</p>:
      (legacyAuditResult.data||[]).length===0?<p>No changes have been made since import. The original confirmation is still authoritative.</p>:
      (legacyAuditResult.data||[]).map(change=><div key={change.id} style={{padding:"12px 0",borderBottom:"1px solid #403b31"}}>
        <p><strong>{new Date(change.created_at).toLocaleString("en-GB")}</strong> · {change.reason}</p>
        <details><summary>Compare before and after</summary>
          <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>{JSON.stringify({beforeBooking:change.old_booking,afterBooking:change.new_booking,beforeContactAndBilling:change.old_override,afterContactAndBilling:change.new_override},null,2)}</pre>
        </details>
      </div>)}
  </section>}
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
