import Link from "next/link";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";
import ExpenseCalculator from "./ExpenseCalculator";
import WeeklyCostsImport from "./WeeklyCostsImport";
import PropertyEntityLinks from "./PropertyEntityLinks";
import ExpenseEvidenceReview from "./ExpenseEvidenceReview";
import ExpenseCorrections from "./ExpenseCorrections";
import styles from "./expenses.module.css";

export const dynamic = "force-dynamic";

/**
 * Guarded administrative PREVIEW. Data is read through the existing active
 * administrator RLS scope. No purchase-expense tables are installed or written.
 * The object -> legal entity linkage must be verified before persistence.
 */
export default async function PropertyExpensesPage() {
  const {db} = await requireEstateAdmin();
  const [issuerResult, propertyResult, unitResult, supplierResult] = await Promise.all([
    db.from("mzs_lease_issuers").select("id,name,kind,prefix",{count:"exact"}).order("name").limit(500),
    db.from("mzs_estate_properties").select("id,name,address,country_code",{count:"exact"}).order("name").limit(500),
    db.from("mzs_estate_units").select("id,property_id,address",{count:"exact"}).order("address").limit(500),
    db.from("mzs_lease_relationships").select("id,name,kind",{count:"exact"}).order("name").limit(500),
  ]);

  const registers = [
    {label:"juridische entiteiten",value:issuerResult},
    {label:"objecten",value:propertyResult},
    {label:"units",value:unitResult},
    {label:"relaties",value:supplierResult},
  ];
  const incomplete = registers.filter(({value}) =>
    value.error || value.count === null || value.data === null || value.data.length !== value.count
  );
  const stagingEnabled = process.env.VERCEL_ENV === "preview" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL === "https://senonkpxdtlhyhrubicg.supabase.co";
  const linkResult = stagingEnabled ? await db.from("mzs_ops_property_entity_links")
    .select("id,property_id,legal_entity_id,relationship_type,effective_from,effective_until,verified_at,evidence_reference",{count:"exact"})
    .order("verified_at",{ascending:false}).limit(500) : null;
  const linksComplete = !!linkResult && !linkResult.error && linkResult.count !== null &&
    linkResult.data !== null && linkResult.data.length === linkResult.count;
  const draftResult = stagingEnabled ? await db.from("mzs_ops_expense_drafts")
    .select("id,property_id,legal_entity_id,supplier_invoice_number,invoice_date,category,description,net_cents,vat_cents,gross_cents,allocations,status,source_document_status",{count:"exact"})
    .order("created_at",{ascending:false}).limit(200) : null;
  const draftsComplete = !!draftResult && !draftResult.error && draftResult.count !== null &&
    draftResult.data !== null && draftResult.data.length === draftResult.count;
  const [documentResult, reviewResult] = stagingEnabled && draftsComplete ? await Promise.all([
    db.from("mzs_ops_expense_documents").select("id,draft_id,sha256,mime_type,file_size",{count:"exact"}).order("created_at",{ascending:false}).limit(200),
    db.from("mzs_ops_expense_review_events").select("draft_id,sequence_no,action,created_at",{count:"exact"}).order("created_at",{ascending:false}).limit(500)
  ]) : [null,null];
  const evidenceComplete = !!documentResult && !!reviewResult &&
    !documentResult.error && !reviewResult.error &&
    documentResult.count !== null && reviewResult.count !== null &&
    documentResult.data !== null && reviewResult.data !== null &&
    documentResult.data.length === documentResult.count &&
    reviewResult.data.length === reviewResult.count;
  const correctionResult = stagingEnabled && draftsComplete ? await db.from("mzs_ops_expense_correction_requests")
    .select("id,draft_id,reason,created_at",{count:"exact"})
    .order("created_at",{ascending:false}).limit(200) : null;
  const correctionsComplete = !!correctionResult && !correctionResult.error &&
    correctionResult.count !== null && correctionResult.data !== null &&
    correctionResult.data.length === correctionResult.count;
  return (
    <section className={styles.main}>
      <Link className={styles.back} href="/admin/workspaces/estates">← Terug naar Estates</Link>
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>PROPERTY OPERATIONS / FASE 1</p>
          <h1>Objectkosten &amp; inkoopfacturen</h1>
          <p>Controleer de verdeling van leverancierskosten per object en unit en bereid de administratie per juridische entiteit voor.</p>
        </div>
        <span className={styles.previewPill}>Staging · gecontroleerd</span>
      </div>
      <div className={styles.notice} role="status">
        <strong>Voorbeeldomgeving, uitsluitend lezen en berekenen.</strong>
        <p>Deze pagina maakt geen uitgaande facturen of betalingen aan. Er is nog geen geverifieerde
        juridische koppeling tussen objecten en entiteiten. Een hier gekozen combinatie is daarom
        alleen een concept. Kostenconcepten, originele bestanden en administratieve controles worden uitsluitend op Staging geregistreerd; doorfactureren, betalen en accountantsexport blijven uitgeschakeld.</p>
      </div>

      {incomplete.length > 0 ? (
        <p className={styles.error} role="alert">Het register is niet volledig beschikbaar:
          {" "}{incomplete.map(r=>r.label).join(", ")}. Om onjuiste toerekening te voorkomen,
          is de kostenberekening uitgeschakeld.</p>
      ) : issuerResult.data!.length === 0 || propertyResult.data!.length === 0 ? (
        <p className={styles.error} role="alert">
          Registreer eerst minimaal één facturerende entiteit en één vastgoedobject in de bestaande administratie.
        </p>
      ) : (
        <ExpenseCalculator
          issuers={issuerResult.data!}
          properties={propertyResult.data!}
          units={unitResult.data!}
          suppliers={supplierResult.data!}
          payerLinks={linksComplete ? linkResult!.data!.filter(x=>x.relationship_type==="payer").map(x=>({
            property_id:x.property_id,legal_entity_id:x.legal_entity_id,
            effective_from:x.effective_from,effective_until:x.effective_until
          })) : []}
          canSaveDraft={draftsComplete}
        />
      )}

      <WeeklyCostsImport />
      {stagingEnabled && <ExpenseCorrections
        drafts={draftsComplete ? draftResult!.data!.map(d=>({id:d.id,
          supplier_invoice_number:d.supplier_invoice_number,description:d.description,
          property_id:d.property_id,net_cents:d.net_cents,vat_cents:d.vat_cents,
          allocations:d.allocations})) : []}
        events={evidenceComplete ? reviewResult!.data! : []}
        requests={correctionsComplete ? correctionResult!.data! : []}
        enabled={draftsComplete && evidenceComplete && correctionsComplete}
      />}
      {stagingEnabled && incomplete.length === 0 && <section className={styles.panel} style={{marginTop:22}}>
        <p className={styles.kicker}>09 / VERKOOPFACTUREN EN ONTVANGSTEN – PROEFEXPORT</p>
        <h2>Uitgereikte facturen en betaalregistraties</h2>
        <p className={styles.hint}>Afzonderlijke ZIP-proefexport voor huurcontracten en vakantieboekingen. Ontvangsten worden aan uitgegeven facturen gekoppeld; administratieve terugboekingen en ongedateerde historische ontvangsten blijven apart. Dit is geen sluitende bankafstemming, fiscale aangifte of volledige boekhouding.</p>
        <form action="/admin/workspaces/estates/expenses/sales-export" method="GET" className={styles.fields} style={{marginTop:16}}>
          <div className={styles.twoFields}>
            <label>Juridische entiteit
              <select name="entity" required defaultValue="">
                <option disabled value="">Selecteer een entiteit</option>
                {(issuerResult.data??[]).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label>Jaar (factuurdatum of ontvangstdatum)
              <select name="year" defaultValue="2026" required>
                {[2025,2026,2027,2028].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
          <button type="submit" className={styles.saveButton}>Download aanvullende verkoop- en ontvangstenproefexport (ZIP)</button>
        </form>
      </section>}
      {stagingEnabled && incomplete.length === 0 && <section className={styles.panel} style={{marginTop:22}}>
        <p className={styles.kicker}>08 / ACCOUNTANT – PROEFEXPORT</p>
        <h2>Export per juridische entiteit</h2>
        <p className={styles.hint}>Een beveiligd ZIP-proefpakket met goedgekeurde inkoopkosten, originele documenten, kostenverdelingen en uitzonderingen. Dit is nog geen volledige boekhouding of belastingexport: verkoopfacturen, betalingen en kapitaaldossiers zijn niet opgenomen.</p>
        <form method="GET" action="/admin/workspaces/estates/expenses/accountant-export" className={styles.fields} style={{marginTop:16}}>
          <div className={styles.twoFields}>
            <label>Juridische entiteit
              <select required name="entity" defaultValue="">
                <option value="" disabled>Selecteer juridische entiteit</option>
                {(issuerResult.data??[]).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label>Boekjaar (factuurdatum)
              <select required name="year" defaultValue="2026">
                {[2025,2026,2027,2028].map(year=><option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          </div>
          <button className={styles.saveButton} type="submit" disabled={!correctionsComplete || !evidenceComplete || !draftsComplete}>Download gecontroleerde proefexport (ZIP)</button>
        </form>
      </section>}

      {stagingEnabled && <ExpenseEvidenceReview
        drafts={draftsComplete ? draftResult!.data!.map(d=>({
          id:d.id,supplier_invoice_number:d.supplier_invoice_number,
          invoice_date:d.invoice_date,status:d.status
        })) : []}
        documents={evidenceComplete ? documentResult!.data! : []}
        events={evidenceComplete ? reviewResult!.data! : []}
        enabled={draftsComplete && evidenceComplete}
      />}
      {draftsComplete ? <section className={styles.panel} style={{marginTop:22}}>
        <p className={styles.kicker}>05 / INKOOPCONCEPTEN</p>
        <h2>Vastgelegde kostenconcepten ({draftResult!.count})</h2>
        <p className={styles.hint}>Kostenconcepten zijn geen betaalde kosten; afzonderlijke brondocumenten en controlebeslissingen worden verderop getoond.</p>
        {draftResult!.data!.length===0 ? <p className={styles.hint}>Nog geen kostenconcepten vastgelegd op Staging.</p> :
          <div className={styles.tableScroll}><table>
            <thead><tr><th>Factuurreferentie</th><th>Factuurdatum</th><th>Kostensoort</th><th>Excl. btw</th><th>Btw</th><th>Totaal</th><th>Status</th></tr></thead>
            <tbody>{draftResult!.data!.map(row=><tr key={row.id}>
              <td>{row.supplier_invoice_number}</td><td>{row.invoice_date}</td><td>{row.category}</td>
              <td>{(Number(row.net_cents)/100).toFixed(2)}</td><td>{(Number(row.vat_cents)/100).toFixed(2)}</td>
              <td>{(Number(row.gross_cents)/100).toFixed(2)}</td><td>{row.status} · document {row.source_document_status}</td>
            </tr>)}</tbody>
          </table></div>}
      </section> : stagingEnabled && <p className={styles.error} role="alert">De kostenconcepten konden niet volledig worden geladen. Opslaan is daarom uitgeschakeld.</p>}
      {incomplete.length === 0 && issuerResult.data && propertyResult.data && <PropertyEntityLinks
        issuers={issuerResult.data.map(({id,name})=>({id,name}))}
        properties={propertyResult.data.map(({id,name})=>({id,name}))}
        links={linksComplete ? linkResult!.data! : []}
        enabled={linksComplete}
      />}

      <div className={styles.nextSteps}>
        <h2>Voorbereid voor de volgende fase</h2>
        <div className={styles.nextGrid}>
          <article><strong>Inkoopfactuur en brondocument</strong><p>PDF of foto, leverancier, factuurdatum, kostenperiode en goedkeuringshistorie.</p></article>
          <article><strong>Gecontroleerde entiteitskoppeling</strong><p>Een expliciet geverifieerde eigenaar, betaler en beheerder per object.</p></article>
          <article><strong>Accountants-export</strong><p>Een compleet exportpakket per entiteit en boekjaar, met bronstukken en verschillen.</p></article>
        </div>
      </div>
    </section>
  );
}
