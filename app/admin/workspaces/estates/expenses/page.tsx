import Link from "next/link";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";
import ExpenseCalculator from "./ExpenseCalculator";
import WeeklyCostsImport from "./WeeklyCostsImport";
import PropertyEntityLinks from "./PropertyEntityLinks";
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
    .select("id,property_id,legal_entity_id,relationship_type,effective_from,verified_at,evidence_reference",{count:"exact"})
    .order("verified_at",{ascending:false}).limit(500) : null;
  const linksComplete = !!linkResult && !linkResult.error && linkResult.count !== null &&
    linkResult.data !== null && linkResult.data.length === linkResult.count;
  return (
    <section className={styles.main}>
      <Link className={styles.back} href="/admin/workspaces/estates">← Terug naar Estates</Link>
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>PROPERTY OPERATIONS / FASE 1</p>
          <h1>Objectkosten &amp; inkoopfacturen</h1>
          <p>Controleer de verdeling van leverancierskosten per object en unit en bereid de administratie per juridische entiteit voor.</p>
        </div>
        <span className={styles.previewPill}>Niet opslaan · concept</span>
      </div>
      <div className={styles.notice} role="status">
        <strong>Voorbeeldomgeving, uitsluitend lezen en berekenen.</strong>
        <p>Deze pagina maakt nog geen inkoopfacturen of boekingen aan. Er is nog geen geverifieerde
        juridische koppeling tussen objecten en entiteiten. Een hier gekozen combinatie is daarom
        alleen een concept. Bestanden uploaden, goedkeuren, doorfactureren en accountantsexport
        worden pas geactiveerd nadat de database en toegangsrechten afzonderlijk zijn getest.</p>
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
        />
      )}

      <WeeklyCostsImport />
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
