import Link from "next/link";
import {notFound} from "next/navigation";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";
import ExpenseCalculator from "./ExpenseCalculator";
import ExpenseEvidenceReview from "./ExpenseEvidenceReview";
import {scannerIsExplicitlyEnabled} from "../../../../../lib/property-operations/scanner/cloudmersive-advanced";
import styles from "./expenses.module.css";
export const dynamic="force-dynamic";

/** Admin-only supplier expense concepts, never issued invoices or financial postings. */
export default async function PropertyExpenseConceptsPage(){
 // Fail closed before querying either database from the wrong deployment.
 const allowed=(process.env.VERCEL_ENV==="production" &&
   process.env.NEXT_PUBLIC_SUPABASE_URL==="https://ptrnjzmcehrhbsfxntgw.supabase.co") ||
  (process.env.VERCEL_ENV==="preview" &&
   process.env.NEXT_PUBLIC_SUPABASE_URL==="https://senonkpxdtlhyhrubicg.supabase.co");
 if(!allowed)notFound();
 const {db}=await requireEstateAdmin();
 const [issuers,properties,units,suppliers,links,drafts]=await Promise.all([
  db.from("mzs_lease_issuers").select("id,name,kind,prefix",{count:"exact"}).order("name").limit(200),
  db.from("mzs_estate_properties").select("id,name,address,country_code",{count:"exact"}).order("name").limit(200),
  db.from("mzs_estate_units").select("id,property_id,address",{count:"exact"}).order("address").limit(300),
  db.from("mzs_lease_relationships").select("id,name,kind",{count:"exact"}).order("name").limit(300),
  db.from("mzs_ops_property_entity_links").select("property_id,legal_entity_id,relationship_type,effective_from,effective_until",{count:"exact"}).limit(300),
  db.from("mzs_ops_expense_drafts")
   .select("id,property_id,legal_entity_id,supplier_relationship_id,supplier_invoice_number,invoice_date,category,description,net_cents,vat_cents,gross_cents,source_document_status,status,created_at",{count:"exact"})
   .order("created_at",{ascending:false}).limit(200)
 ]);
 const registers=[issuers,properties,units,suppliers,links,drafts];
 if(registers.some(x=>x.error||x.count===null||x.data===null||x.data.length!==x.count))notFound();
 const issuerNames=new Map((issuers.data??[]).map(x=>[x.id,x.name]));
 const propertyNames=new Map((properties.data??[]).map(x=>[x.id,x.name]));
 const supplierNames=new Map((suppliers.data??[]).map(x=>[x.id,x.name]));
 // Staging-only evidence registers are never queried from Production.
 const stagingEvidence=process.env.VERCEL_ENV==="preview" &&
   process.env.NEXT_PUBLIC_SUPABASE_URL==="https://senonkpxdtlhyhrubicg.supabase.co";
 const [documents,reviews,scans]=stagingEvidence?await Promise.all([
  db.from("mzs_ops_expense_documents")
   .select("id,draft_id,sha256,mime_type,file_size",{count:"exact"})
   .order("created_at",{ascending:false}).limit(200),
  db.from("mzs_ops_expense_review_events")
   .select("draft_id,sequence_no,action,created_at",{count:"exact"})
   .order("created_at",{ascending:false}).limit(300),
  db.from("mzs_ops_expense_document_scan_events")
   .select("document_id,verdict,observed_sha256,id",{count:"exact"})
   .order("id",{ascending:false}).limit(300)
 ]):[null,null,null];
 const evidenceComplete=!!documents&&!!reviews&&!!scans&&
   [documents,reviews,scans].every(x=>!x.error&&x.count!==null&&x.data!==null&&x.data.length===x.count);
 const scannerAvailable=stagingEvidence && scannerIsExplicitlyEnabled({
  environment:process.env.VERCEL_ENV,
  supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,
  enabled:process.env.MZS_OPS_AV_SCAN_ENABLED,
  processorApproved:process.env.MZS_OPS_AV_PROCESSOR_APPROVED,
  apiKey:process.env.MZS_OPS_CLOUDMERSIVE_API_KEY
 })&&Boolean(process.env.MZS_OPS_STAGING_SCANNER_SERVICE_ROLE_KEY?.length);
 const payerLinks=(links.data??[]).filter(x=>x.relationship_type==="payer");
 const formatCents=(value:number)=>new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"}).format(value/100);
 return <main className={styles.main}>
  <Link href="/admin/workspaces/estates" className={styles.back}>Terug naar Estates</Link>
  <header className={styles.heading}>
   <div>
    <p className={styles.kicker}>MZS GROUP / ESTATES / KOSTENADMINISTRATIE</p>
    <h1>Objectkosten &amp; inkoopconcepten</h1>
    <p>Bereken de verdeling van inkoopkosten over een object of over de bijbehorende units. Bewaar alleen gecontroleerde concepten voor de juiste juridische kostendrager.</p>
   </div>
  </header>
  <section className={styles.panel} aria-label="Belangrijke beperkingen">
   <h2>Conceptfase — geen financiële boeking</h2>
   <p>Deze pagina registreert nog geen definitieve inkoopfacturen, betalingen, btw-aangiften of doorbelastingen. Een opgeslagen concept is onveranderbaar en wordt voorzien van een auditregistratie. Het originele leveranciersdocument moet in een volgende fase worden toegevoegd en gecontroleerd.</p>
   {payerLinks.length===0&&<p role="status" className={styles.notice}>
    Er is nog geen geverifieerde kostendrager. Je kunt alvast bedragen berekenen, maar opslaan blijft geblokkeerd totdat de juiste juridische entiteit aan het object is gekoppeld. <Link href="/admin/workspaces/estates/entities">Open de juridische objectkoppelingen</Link>.
   </p>}
  </section>
  <ExpenseCalculator
   issuers={issuers.data??[]}
   properties={properties.data??[]}
   units={units.data??[]}
   suppliers={suppliers.data??[]}
   payerLinks={payerLinks}
   canSaveDraft={true}
  />
  <section className={styles.panel} aria-label="Vastgelegde kostenconcepten">
   <p className={styles.kicker}>03 / INTERNE CONTROLE</p>
   <h2>Inkoopkostenconcepten ({drafts.count})</h2>
   {(drafts.data??[]).length===0?<p>Er zijn nog geen concepten opgeslagen. Kosten worden niet automatisch geïmporteerd.</p>:
    <div className={styles.tableScroll} role="region" tabIndex={0} aria-label="Inkoopkostenconcepten">
     <table>
      <thead><tr><th>Datum</th><th>Object</th><th>Betalende entiteit</th><th>Leverancier</th><th>Referentie</th><th>Bedrag</th><th>Status</th></tr></thead>
      <tbody>{(drafts.data??[]).map(d=><tr key={d.id}>
       <td>{d.invoice_date}</td><td>{propertyNames.get(d.property_id)??"Onbekend object"}</td>
       <td>{issuerNames.get(d.legal_entity_id)??"Onbekende entiteit"}</td>
       <td>{supplierNames.get(d.supplier_relationship_id)??"Onbekende relatie"}</td>
       <td>{d.supplier_invoice_number}</td><td>{formatCents(d.gross_cents)}</td>
       <td>Concept · bron ontbreekt</td>
      </tr>)}</tbody>
     </table>
    </div>}
  </section>
  {stagingEvidence&&<ExpenseEvidenceReview
   drafts={(drafts.data??[]).map(d=>({id:d.id,supplier_invoice_number:d.supplier_invoice_number,invoice_date:d.invoice_date,status:d.status}))}
   documents={evidenceComplete?documents!.data??[]:[]}
   events={evidenceComplete?reviews!.data??[]:[]}
   scanEvents={evidenceComplete?scans!.data??[]:[]}
   scannerAvailable={scannerAvailable}
   enabled={evidenceComplete}
  />}
 </main>;
}
