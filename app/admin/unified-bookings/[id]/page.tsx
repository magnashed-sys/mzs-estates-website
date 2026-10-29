
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import {bookingAllocation} from "../../../../lib/estates/booking-accounting";
import Link from "next/link";
import {isMaseIssuer} from "../../../../lib/estates/booking-invoice";
import {bookingReturnHref} from "../../../../lib/admin/booking-return";
import {notFound} from "next/navigation";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import TestBookingCleanup from "./TestBookingCleanup";
import BookingCleanup from "./BookingCleanup";
import BookingCancellation from "./BookingCancellation";
import BookingEditor from "../BookingEditor";
import LegacyBookingEditor from "./LegacyBookingEditor";
import {recordBookingReceipt,reverseBookingReceipt,createBookingInvoiceDraft,reviewBookingInvoiceDraft,editBookingInvoiceDraft} from "./actions";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money=(v:number|string|null, adminLocale = 'en-GB')=>v===null?"Not priced":new Intl.NumberFormat(adminLocale,{style:"currency",currency:"EUR"}).format(Number(v));
export default async function BookingDossier({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 const {id}=await params;
 const returnHref=bookingReturnHref((await searchParams).returnTo);
 if(!UUID.test(id))notFound();
 const {db}=await requireEstateAdmin();
 const {data:rows,error}=await db.rpc("admin_list_rental_bookings").eq("id",id).limit(2);
 if(error||!rows||rows.length!==1)notFound();
 const b=rows[0];
 const [cleanup,cancellation]=await Promise.all([
  db.rpc("mzs_admin_booking_cleanup_plan",{p_booking_id:id}),
  db.rpc("mzs_admin_booking_cancellation_plan",{p_booking_id:id})
 ]);
 const [{data:property},{data:guest},ownerResult,changes,prices,notifications]=await Promise.all([
  db.from("projects").select("title").eq("id",b.project_id).maybeSingle(),
  b.user_id?db.from("profiles").select("full_name,email").eq("id",b.user_id).maybeSingle():Promise.resolve({data:null}),
  db.from("mzs_owner_stay_requests").select("id,status").eq("booking_id",id).maybeSingle(),
  db.from("rental_booking_admin_audit").select("id,action,reason,created_at,previous_values,resulting_values").eq("booking_id",id).order("created_at",{ascending:false}).limit(100),
  db.from("mzs_booking_price_audit").select("id,old_total,new_total,reason,created_at").eq("booking_id",id).order("created_at",{ascending:false}).limit(100),
  db.from("rental_change_notifications").select("id,kind,status,attempts,created_at").eq("booking_id",id).order("created_at",{ascending:false}).limit(100)
 ]);
 const owner=ownerResult.data;
 const receiptResult=await db.from("mzs_booking_receipts").select("id,amount,received_on,receipt_type,reference,notes,created_at,reversed_at,reversal_reason").eq("booking_id",id).order("received_on",{ascending:false}).limit(250);
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
 const approvedInvoiceIssuer=(issuerList.data||[]).find(i=>i.id===(invoiceDraft.data?.issuer_id||legacy?.invoice_issuer_id));
 const approvedInvoiceModel=Boolean(approvedInvoiceIssuer&&isMaseIssuer(approvedInvoiceIssuer));
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const actionDataReady=!legacyResult.error&&!ownerResult.error&&!cancellation.error&&Boolean(cancellation.data);
 const historicalEditable=actionDataReady&&legacy&&!correctionResult.error&&!invoiceCompaniesResult.error&&!invoiceDraft.error&&!invoiceDraft.data&&b.status==="confirmed"&&!b.is_test&&!owner;
 const editable=actionDataReady&&b.check_in>=today&&!legacy&&!b.is_test&&Boolean(b.user_id)&&["requested","confirmed"].includes(b.status)&&!owner;
 const card={padding:24,border:"1px solid #514839",background:"#151411",borderRadius:6} as const;
 return <main style={{background:"#0d0d0c",color:"#eee8dd",minHeight:"100vh",padding:"42px clamp(20px,5vw,70px)"}}>
  <Link href={returnHref} style={{color:"#d5c09a"}}>{adminT("← Back to bookings")}</Link>
  <p style={{color:"#d5c09a",letterSpacing:3,fontSize:11,marginTop:30}}>{adminT("MZS ESTATES / RESERVATION DOSSIER")}</p>
  <h1 style={{fontFamily:"Georgia,serif",fontWeight:400}}>{property?.title||adminT("Rental property")}</h1>
  <p style={{color:"#b5ac9c"}}>{adminT("Booking reference:")} {b.id}</p>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginBottom:22}}>
    <section style={card}><small>{adminT("Reservation type")}</small><h2 style={{fontWeight:400}}>{owner?adminT("Owner stay"):b.status==="blocked"?adminT("Unavailable period"):adminT("Guest booking")}</h2><p>{adminT("Status:")} {adminT(b.status)}</p></section>
    <section style={card}><small>{adminT("Stay")}</small><h2 style={{fontWeight:400}}>{b.check_in} – {b.check_out}</h2><p>{b.guest_count??adminT("Unspecified")}  {adminT("guests")}</p></section>
    <section style={card}><small>{adminT("Recorded total")}</small><h2 style={{fontWeight:400}}>{money(b.quoted_total_eur, adminLocale)}</h2><p>{owner?adminT("Complimentary owner use"):adminT("Registered booking amount")}</p></section>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:18}}>
    <section style={card}><h2>{adminT("Guest & administration")}</h2><p>{adminT("Guest:")} {effectiveGuestName||guest?.full_name||adminT("Not available")}</p><p>{adminT("Contact email:")} {effectiveContactEmail||guest?.email||adminT("Not available")}</p><p>{adminT("Account:")} {guest?.email?(adminT("Linked: {p0}", {p0: guest.email})):adminT("No account linked")}</p><p>{adminT("Internal notes:")} {b.admin_notes||adminT("None")}</p></section>
    <section style={card} aria-label={adminT("Reservation actions")}><h2>{adminT("Manage reservation")}</h2>
      {!actionDataReady&&<p role="alert">{adminT("Reservation type or actions could not be verified. Refresh before making changes.")}</p>}
      <h3>{adminT("Change reservation details")}</h3>

      {b.is_test&&["requested","test_approved","declined","cancelled"].includes(b.status)&&<TestBookingCleanup bookingId={b.id} returnHref={returnHref}/>}
      {historicalEditable?<LegacyBookingEditor key={id+"-"+(currentCorrection?.version||0)} booking={{id:b.id,checkIn:b.check_in,checkOut:b.check_out,checkInTime:(b.preferred_check_in||"").slice(0,5),checkOutTime:(b.preferred_check_out||"").slice(0,5),guestCount:b.guest_count,total:b.quoted_total_eur===null?null:Number(b.quoted_total_eur),notes:b.admin_notes||""}} source={{guestName:effectiveGuestName||"",contactName:currentCorrection?.contact_name||legacy.booking_contact_name,contactEmail:effectiveContactEmail||"",billingKind:(currentCorrection?.invoice_recipient_kind||legacy.invoice_recipient_kind) as "person"|"company",invoiceRecipient:effectiveInvoiceRecipient||"",companyId:currentCorrection?.invoice_recipient_relationship_id||legacy.invoice_recipient_relationship_id,version:currentCorrection?.version||0}} companies={invoiceCompaniesResult.data||[]}/>:editable?<BookingEditor booking={{id:b.id,checkIn:b.check_in,checkOut:b.check_out,guestCount:b.guest_count,total:b.quoted_total_eur===null?null:Number(b.quoted_total_eur),notes:b.admin_notes||""}}/>:
        <><p>{legacy?adminT("Historical editing requires a confirmed reservation and no invoice draft. Original records remain available below."):owner?adminT("Owner stays use their own approval workflow. Cancellation is available below when eligible."):b.status==="blocked"?adminT("This period blocks availability. You can release it below without deleting its history."):adminT("Date editing is available for upcoming live requested or confirmed client bookings.")}</p><Link href={owner?"/admin/owner-stays#request-"+owner.id:"/admin/bookings/operations"} style={{color:"#d5c09a"}}>{adminT("Open booking operations →")}</Link></>}
      {!cancellation.error&&cancellation.data&&<BookingCancellation key={cancellation.data.fingerprint} bookingId={id} plan={cancellation.data}/>}
      <details style={{marginTop:20}}><summary style={{cursor:"pointer",padding:"12px 0"}}>{adminT("Archive, restore or remove an erroneous record")}</summary>
      {!cleanup.error&&cleanup.data?<BookingCleanup key={cleanup.data.fingerprint} bookingId={id} plan={cleanup.data} returnHref={returnHref}/>:<p role="alert">{adminT("Cleanup options could not be loaded. Refresh to verify.")}</p>}
      </details>
      <p style={{color:"#a8a093",fontSize:12}}>{adminT("Changes use the existing permission-checked booking functions. Amount changes require an audit reason.")}</p>
    </section>
  </div>
  {legacy&&<section style={{...card,marginTop:20}} aria-label={adminT("Original booking and billing recipient")}>
    <h2>{adminT("Original confirmation & billing recipient")}</h2>
    <p><strong>{adminT("Original reference:")}</strong> {legacy.original_booking_number} · <strong>{adminT("Source ID:")}</strong> {legacy.source_key}</p>
    <p><strong>{adminT("Booking contact:")}</strong> {legacy.booking_contact_name}</p>
    <p><strong>{adminT("Invoice recipient on original confirmation:")}</strong> {legacy.invoice_recipient_name} ({legacy.invoice_recipient_kind==="company"?adminT("Company"):adminT("Private person")})</p>
    {currentCorrection&&<p><strong>{adminT("Current invoice recipient:")}</strong> {currentCorrection.invoice_recipient_name} ({currentCorrection.invoice_recipient_kind==="company"?adminT("Company"):adminT("Private person")}{adminT(") · last corrected")} {new Date(currentCorrection.modified_at).toLocaleString(adminLocale)}</p>}
    <p><strong>{adminT("Issuing entity:")}</strong>  {adminT("Mase Estates SL")}</p>
    <p><strong>{adminT("Source file:")}</strong> {legacy.source_filename}  {adminT("· page 1")}</p>
    <p><strong>{adminT("Confirmation date:")}</strong> {legacy.confirmation_date||adminT("Not stated")}</p>
    <p><strong>{adminT("Contact address:")}</strong> {Object.values(legacy.source_address||{}).filter(Boolean).join(" · ")||adminT("Not stated")}</p>
    <p><strong>{adminT("Source billed days:")}</strong> {legacy.source_billed_days} · <strong>{adminT("Original nights:")}</strong> {legacy.source_nights} · <strong>{adminT("Current nights:")}</strong> {Math.round((Date.parse(b.check_out+"T00:00:00Z")-Date.parse(b.check_in+"T00:00:00Z"))/86400000)}</p>
    {legacy.source_billed_days!==legacy.source_nights&&<p style={{color:"#e3a995"}}>{adminT("The historical confirmation bills a different number of days than the date difference. The originally agreed total was preserved.")}</p>}
    <details><summary>{adminT("Original price components and special terms")}</summary>
      <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>{JSON.stringify(legacy.price_breakdown,null,2)}{"\n"}{JSON.stringify(legacy.source_terms,null,2)}</pre>
    </details>
    {correctionResult.error&&<p role="alert">{adminT("Historical correction information could not be loaded; editing is unavailable.")}</p>}
    {legacyResult.error&&<p role="alert">{adminT("Original confirmation metadata could not be loaded.")}</p>}
  </section>}
  {legacyResult.error&&<p role="alert" style={{color:"#e3a995"}}>{adminT("Historical billing metadata could not be loaded. Check the source record before issuing invoices.")}</p>}
  <section style={{...card,marginTop:20}}><h2>{adminT("Booking payments")}</h2>
    {!owner&&b.status==="confirmed"&&!b.is_test&&<div style={{border:"1px solid #514839",padding:14}}>
     <h3>{adminT("Administrative year allocation")}</h3>
     <p>{adminT("Allocation date:")} <strong>{bookingAllocation(b.check_in).allocationDate}</strong>  {adminT("· Arrival year:")} <strong>{bookingAllocation(b.check_in).allocationYear}</strong></p>
     <p>{adminT("This reporting date follows the start of the stay. It is not a payment date or invoice issue date. Unknown original payment dates remain unknown; invoice issue dates are retained separately.")}</p>
     <a href={"/admin/bookings/accountant-export?year="+bookingAllocation(b.check_in).allocationYear} style={{color:"#d5c09a"}}>{adminT("Download this arrival year's accountant overview →")}</a>
    </div>}
    <p>{adminT("Recorded booking value:")} <strong>{money(b.quoted_total_eur, adminLocale)}</strong></p>
    <p>{adminT("Receipts recorded against this booking:")} <strong>{receiptResult.error?adminT("Unavailable"):money(receiptTotal, adminLocale)}</strong></p>
    <p>{adminT("Remaining balance:")} <strong>{receiptResult.error||b.quoted_total_eur===null?adminT("Unavailable"):money(Number(b.quoted_total_eur)-receiptTotal, adminLocale)}</strong></p>
    {receipts.some(r=>r.receipt_type==="historical_settlement"&&!r.reversed_at)&&<p style={{color:"#bcb2a4"}}>{adminT("Historical payment confirmed by the owner and carried forward. The original payment date was not supplied; the registration date is not a bank transaction date.")}</p>}
    <p style={{color:"#bcb2a4"}}>{adminT("These are manually registered booking receipts, not issued invoices or verified bank-feed transactions. The balance is based on the recorded booking total and these receipts only; it is not added to the recurring lease-contract payment ledger.")}</p>
    {receiptResult.error&&<p role="alert">{adminT("Booking receipts could not be loaded. Do not rely on this balance.")}</p>}
    {receipts.length>0&&<div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}><thead><tr><th>{adminT("Actual payment date")}</th><th>{adminT("Amount")}</th><th>{adminT("Reference")}</th><th>{adminT("Notes")}</th><th>{adminT("Correction")}</th></tr></thead><tbody>{receipts.map(r=><tr key={r.id}><td>{r.received_on||adminT("Historical · date unknown")}</td><td>{money(r.amount, adminLocale)}</td><td>{r.reference}</td><td>{r.notes||"—"}{r.reversed_at&&<p style={{color:"#e8b29c"}}>{adminT("Reversed ·")} {new Date(r.reversed_at).toLocaleString(adminLocale)}<br/>{r.reversal_reason}</p>}</td><td>{r.reversed_at?adminT("Reversed"):<form action={reverseBookingReceipt} style={{display:"grid",gap:6}}><input type="hidden" name="receipt_id" value={r.id}/><input name="reason" required minLength={5} maxLength={500} placeholder={adminT("Reason for reversal")} aria-label={adminT("Reversal reason")} style={{padding:7}}/><button type="submit">{adminT("Reverse receipt")}</button></form>}</td></tr>)}</tbody></table></div>}
    {chargeable&&!receiptResult.error&&<form action={recordBookingReceipt} style={{marginTop:22,display:"grid",gap:12,maxWidth:420}}>
      <h3>{adminT("Record a received payment")}</h3>
      <input type="hidden" name="booking_id" value={id}/>
      <label>{adminT("Amount (€)")} <input style={{display:"block",padding:9,width:"100%"}} name="amount" type="number" min="0.01" step="0.01" required/></label>
      <label>{adminT("Date received")} <input style={{display:"block",padding:9,width:"100%"}} name="received_on" type="date" required/></label>
      <label>{adminT("Unique bank reference")} <input style={{display:"block",padding:9,width:"100%"}} name="reference" maxLength={200} required/></label>
      <label>{adminT("Internal notes")} <textarea style={{display:"block",padding:9,width:"100%"}} name="notes" maxLength={2000}/></label>
      <button type="submit" style={{padding:12,background:"#d5c09a",color:"#181410",fontWeight:600}}>{adminT("Record receipt")}</button>
      <small style={{color:"#bcb2a4"}}>{adminT("Record only actual cleared receipts. Use a unique reference to prevent accidental duplicate registration.")}</small>
    </form>}
    <p><Link href="/admin/group/estates/contracts?view=invoices" style={{color:"#d5c09a"}}>{adminT("Open recurring lease invoices & payments →")}</Link></p>
  </section>
  <section style={{...card,marginTop:20}}><h2>{adminT("Reservation invoicing")}</h2>
    {chargeable&&approvedInvoiceModel&&<div style={{padding:16,border:"1px solid #655944",marginBottom:18}}>
     <h3>{adminT("Trilingual invoice model · NL / EN / ES")}</h3>
     <p>{adminT("Includes the booking details, current payments, 50% deposit within 7 days of booking and remaining 50% due 14 days before arrival. A paid deposit is non-refundable on cancellation. Missing customer addresses are omitted.")}</p>
     <a href={"/admin/bookings/"+id+"/invoice/pdf"} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",padding:12,background:"#d5c09a",color:"#181410"}}>{adminT("Open invoice draft PDF ↗")}</a>
     <p style={{fontSize:12}}>{adminT("Preview only: no invoice number is assigned and no email is sent. Historical booking dates use the original confirmation date when available.")}</p>
    </div>}
    <p style={{color:"#bcb2a4"}}>{adminT("Invoice drafts only. No invoice number is consumed, no invoice is issued and no email is sent. The VAT rate must be verified by the administrator for the property, issuer and transaction.")}</p>
    {legacy&&<p style={{color:"#bcb2a4"}}>{adminT("The invoice recipient is prefilled from the current corrected historic booking. Changes to the invoice recipient must be saved in the booking dossier before starting an invoice draft.")}</p>}
    {(invoiceDraft.error||issuerList.error)&&<p role="alert">{adminT("Invoice configuration could not be loaded; draft creation is unavailable.")}</p>}
    {invoiceDraft.data?<div>
       <p><strong>{adminT("Draft registered")}</strong> · {new Date(invoiceDraft.data.created_at).toLocaleString(adminLocale)}</p>
       <p>{adminT("Recipient:")} {invoiceDraft.data.recipient_name}</p>
       <p>{adminT("Gross:")} {money(invoiceDraft.data.gross_total, adminLocale)}  {adminT("· VAT:")} {money(invoiceDraft.data.vat_total, adminLocale)}  {adminT("· Net:")} {money(invoiceDraft.data.net_total, adminLocale)}</p>
       <p>{adminT("VAT assessment:")} {invoiceDraft.data.tax_note}</p>
       <p>{adminT("Status:")} <strong>{adminT(invoiceDraft.data.review_status)}</strong>{invoiceDraft.data.reviewed_at&&" · reviewed "+new Date(invoiceDraft.data.reviewed_at).toLocaleString(adminLocale)}</p>
       {invoiceDraft.data.review_status==="draft"&&<details style={{border:"1px solid #514839",padding:14,margin:"18px 0"}}>
         <summary style={{cursor:"pointer",color:"#d5c09a"}}>{adminT("Edit draft details")}</summary>
         <form action={editBookingInvoiceDraft} style={{display:"grid",gap:12,marginTop:16,maxWidth:480}}>
           <input type="hidden" name="booking_id" value={id}/><input type="hidden" name="draft_id" value={invoiceDraft.data.id}/><input type="hidden" name="revision" value={invoiceDraft.data.revision}/>
           <label>{adminT("Issuing entity")}<select name="issuer_id" defaultValue={invoiceDraft.data.issuer_id} required style={{display:"block",padding:10,width:"100%"}}>{(issuerList.data||[]).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
           <label>{adminT("Recipient")}<input name="recipient_name" defaultValue={invoiceDraft.data.recipient_name} required maxLength={250} style={{display:"block",padding:10,width:"100%"}}/></label>
           <label>{adminT("Email")}<input type="email" name="recipient_email" defaultValue={invoiceDraft.data.recipient_email||""} maxLength={254} style={{display:"block",padding:10,width:"100%"}}/></label>
           <label>{adminT("VAT rate (%)")}<input type="number" name="vat_rate" defaultValue={Number(invoiceDraft.data.vat_rate)*100} min={0} max={100} step="0.0001" required style={{display:"block",padding:10,width:"100%"}}/></label>
           <label>{adminT("VAT explanation")}<textarea name="tax_note" defaultValue={invoiceDraft.data.tax_note} minLength={5} maxLength={1000} required style={{display:"block",padding:10,width:"100%"}}/></label>
           <label>{adminT("Reason for editing")}<textarea name="reason" minLength={5} maxLength={500} required style={{display:"block",padding:10,width:"100%"}}/></label>
           <button type="submit" style={{padding:12,background:"#d5c09a",color:"#181410"}}>{adminT("Save draft changes")}</button>
         </form>
       </details>}
       <form action={reviewBookingInvoiceDraft} style={{display:"grid",gap:12,maxWidth:480,marginTop:16}}>
        <input type="hidden" name="booking_id" value={id}/>
        <input type="hidden" name="draft_id" value={invoiceDraft.data.id}/>
        <input type="hidden" name="revision" value={invoiceDraft.data.revision}/>
        <label>{adminT("VAT review notes")} <textarea name="tax_note" defaultValue={invoiceDraft.data.tax_note} minLength={5} maxLength={1000} required style={{display:"block",padding:10,width:"100%"}}/></label>
        <label>{adminT("Review decision")} <select name="review_status" defaultValue={invoiceDraft.data.review_status} style={{display:"block",padding:10,width:"100%"}}><option value="draft">{adminT("Return to draft")}</option><option value="reviewed">{adminT("Mark reviewed")}</option></select></label>
        <button style={{padding:12,background:"#d5c09a",color:"#181410"}} type="submit">{adminT("Save review")}</button>
       </form>
       <small>{adminT("Issuer selection and totals are snapshotted in the draft. Issuance requires a separate approval workflow.")}</small>
    </div>:chargeable&&!invoiceDraft.error&&!issuerList.error?<form action={createBookingInvoiceDraft} style={{display:"grid",gap:12,maxWidth:480}}>
      <input type="hidden" name="booking_id" value={id}/>
      <label>{adminT("Issuing entity")} <select name="issuer_id" required defaultValue={legacy?.invoice_issuer_id||""} style={{display:"block",padding:10,width:"100%"}}><option value="" disabled>{adminT("Select issuing entity")}</option>{(issuerList.data||[]).map(i=><option key={i.id} value={i.id}>{i.name} · {i.prefix||adminT("No prefix")}</option>)}</select></label>
      {(issuerList.data||[]).length===0&&<p role="alert">{adminT("No issuing entity is configured. Create an issuer in Rental Contracts before drafting an invoice.")}</p>}
      <label>{adminT("Invoice recipient")} <input name="recipient_name" maxLength={250} required defaultValue={effectiveInvoiceRecipient||guest?.full_name||""} style={{display:"block",padding:10,width:"100%"}}/></label>
      <label>{adminT("Recipient email")} <input name="recipient_email" type="email" maxLength={254} defaultValue={effectiveContactEmail||guest?.email||""} style={{display:"block",padding:10,width:"100%"}}/></label>
      <label>{adminT("VAT rate (%)")} <input name="vat_rate" type="number" min="0" max="100" step="0.0001" required defaultValue={approvedInvoiceModel?0:undefined} placeholder={adminT("Enter verified rate")} style={{display:"block",padding:10,width:"100%"}}/></label>
      <label>{adminT("VAT / tax assessment notes")} <textarea name="tax_note" required minLength={5} maxLength={1000} defaultValue={approvedInvoiceModel?"Geen btw in rekening gebracht / No VAT charged / No se repercute IVA":undefined} placeholder={adminT("Explain the VAT rate or exemption after checking applicable treatment")} style={{display:"block",padding:10,width:"100%"}}/></label>
      <p>{adminT("Total including VAT:")} <strong>{money(b.quoted_total_eur, adminLocale)}</strong>{adminT(". The draft calculates net and VAT components from this existing total.")}</p>
      <button type="submit" disabled={(issuerList.data||[]).length===0} style={{padding:12,background:"#d5c09a",color:"#181410",fontWeight:600}}>{adminT("Save invoice draft")}</button>
    </form>:<p>{adminT("No invoice draft available for this booking type or status.")}</p>}
  </section>
  {legacy&&<section style={{...card,marginTop:20}}>
    <h2>{adminT("Historical reservation correction log")}</h2>
    {legacyAuditResult.error?<p role="alert">{adminT("Correction audit history could not be loaded.")}</p>:
      (legacyAuditResult.data||[]).length===0?<p>{adminT("No changes have been made since import. The original confirmation is still authoritative.")}</p>:
      (legacyAuditResult.data||[]).map(change=><div key={change.id} style={{padding:"12px 0",borderBottom:"1px solid #403b31"}}>
        <p><strong>{new Date(change.created_at).toLocaleString(adminLocale)}</strong> · {change.reason}</p>
        <details><summary>{adminT("Compare before and after")}</summary>
          <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>{JSON.stringify({beforeBooking:change.old_booking,afterBooking:change.new_booking,beforeContactAndBilling:change.old_override,afterContactAndBilling:change.new_override},null,2)}</pre>
        </details>
      </div>)}
  </section>}
  <section style={{...card,marginTop:20}}><h2>{adminT("Activity & audit history")}</h2>
    {(changes.error||prices.error||notifications.error)&&<p role="alert" style={{color:"#e3a995"}}>{adminT("Some audit or notification records could not be loaded. The activity history may be incomplete.")}</p>}
    <h3>{adminT("Reservation changes")}</h3>
    {(changes.data||[]).length===0?<p>{adminT("No administrator modification records.")}</p>:(changes.data||[]).map(x=><div key={x.id} style={{padding:"12px 0",borderBottom:"1px solid #443e34"}}><strong>{x.action}</strong> · {new Date(x.created_at).toLocaleString(adminLocale)}<p>{adminT("Reason:")} {x.reason||adminT("Not provided")}</p><details><summary>{adminT("Recorded before / after")}</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}}>{adminT("Before:")} {JSON.stringify(x.previous_values,null,2)}{adminT("\\n")}{adminT("After:")} {JSON.stringify(x.resulting_values,null,2)}</pre></details></div>)}
    <h3>{adminT("Price adjustments")}</h3>
    {(prices.data||[]).length===0?<p>{adminT("No separately audited price changes.")}</p>:(prices.data||[]).map(x=><p key={x.id}>{new Date(x.created_at).toLocaleString(adminLocale)} · {money(x.old_total, adminLocale)} → {money(x.new_total, adminLocale)} · {x.reason}</p>)}
    <h3>{adminT("Client notification activity")}</h3>
    {(notifications.data||[]).length===0?<p>{adminT("No modification or cancellation notification records.")}</p>:(notifications.data||[]).map(x=><p key={x.id}>{adminT(x.kind)} · {adminT(x.status)} · {new Date(x.created_at).toLocaleString(adminLocale)} · {x.attempts}  {adminT("attempts")}</p>)}
  </section>
 </main>;
}

