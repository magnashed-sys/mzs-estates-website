import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import WeeklyCostsImport from "./WeeklyCostsImport";
import {expenseFilters,expenseRegisterHref,expensePageTotals,EXPENSE_PAGE_SIZE} from "../../../../../lib/property-operations/expense-register";
import {requireEstateAdmin} from "../../../../../lib/security/estate-properties";
import ExpenseCalculator from "./ExpenseCalculator";
import styles from "./expenses.module.css";
export const dynamic="force-dynamic";

/** Admin-only supplier expense concepts, never issued invoices or financial postings. */
export default async function PropertyExpenseConceptsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 // Fail closed before querying either database from the wrong deployment.
 const allowed=(process.env.VERCEL_ENV==="production" &&
   process.env.NEXT_PUBLIC_SUPABASE_URL==="https://ptrnjzmcehrhbsfxntgw.supabase.co") ||
  (process.env.VERCEL_ENV==="preview" &&
   process.env.NEXT_PUBLIC_SUPABASE_URL==="https://senonkpxdtlhyhrubicg.supabase.co");
 if(!allowed)notFound();
 const {db}=await requireEstateAdmin();
 let filters;
 try{filters=expenseFilters(await searchParams);}catch(error){return <main className={styles.main}><h1>Objectkosten</h1><p role="alert">{error instanceof Error?error.message:"Ongeldige filters."}</p><Link href="/admin/workspaces/estates/expenses">Wis filters</Link></main>;}
 let draftQuery=db.from("mzs_ops_expense_drafts")
  .select("id,property_id,legal_entity_id,supplier_relationship_id,supplier_invoice_number,invoice_date,category,description,net_cents,vat_cents,gross_cents,source_document_status,status,created_at",{count:"exact"})
  .order("created_at",{ascending:false}).order("id",{ascending:false});
 if(filters.property)draftQuery=draftQuery.eq("property_id",filters.property);
 if(filters.entity)draftQuery=draftQuery.eq("legal_entity_id",filters.entity);
 if(filters.supplier)draftQuery=draftQuery.eq("supplier_relationship_id",filters.supplier);
 if(filters.from)draftQuery=draftQuery.gte("invoice_date",filters.from);
 if(filters.until)draftQuery=draftQuery.lte("invoice_date",filters.until);
 if(filters.q)draftQuery=draftQuery.or(`supplier_invoice_number.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
 const offset=(filters.page-1)*EXPENSE_PAGE_SIZE;
 const [issuers,properties,units,suppliers,links,drafts]=await Promise.all([
  db.from("mzs_lease_issuers").select("id,name,kind,prefix",{count:"exact"}).order("name").limit(200),
  db.from("mzs_estate_properties").select("id,name,address,country_code",{count:"exact"}).order("name").limit(200),
  db.from("mzs_estate_units").select("id,property_id,address",{count:"exact"}).order("address").limit(300),
  db.from("mzs_lease_relationships").select("id,name,kind",{count:"exact"}).order("name").limit(300),
  db.from("mzs_ops_property_entity_links").select("property_id,legal_entity_id,relationship_type,effective_from,effective_until",{count:"exact"}).limit(300),
  draftQuery.range(offset,offset+EXPENSE_PAGE_SIZE-1)
 ]);
 const registers=[issuers,properties,units,suppliers,links];
 if(registers.some(x=>x.error||x.count===null||x.data===null||x.data.length!==x.count))notFound();
 // PostgREST returns HTTP 416 without count/data for an offset past the end.
 // Re-read a single row with the same filters to find the last page safely.
 if(drafts.error?.code==="PGRST103"&&filters.page>1){
  const first=await draftQuery.range(0,0);
  if(!first.error&&first.count!==null)redirect(expenseRegisterHref(filters,Math.max(1,Math.ceil(first.count/EXPENSE_PAGE_SIZE))));
 }
 if(drafts.error||drafts.count===null||drafts.data===null)throw new Error("Het kostenregister kon niet worden geladen.");
 const pageCount=Math.max(1,Math.ceil(drafts.count/EXPENSE_PAGE_SIZE));
 if(filters.page>pageCount)redirect(expenseRegisterHref(filters,pageCount));
 if(drafts.data.length!==Math.min(EXPENSE_PAGE_SIZE,Math.max(0,drafts.count-offset)))throw new Error("Het kostenregister is onvolledig geladen. Probeer opnieuw.");
 const totals=expensePageTotals(drafts.data);
 const issuerNames=new Map((issuers.data??[]).map(x=>[x.id,x.name]));
 const propertyNames=new Map((properties.data??[]).map(x=>[x.id,x.name]));
 const supplierNames=new Map((suppliers.data??[]).map(x=>[x.id,x.name]));
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
   <p>Deze pagina registreert nog geen definitieve inkoopfacturen, betalingen, btw-aangiften of doorbelastingen. Een opgeslagen concept is onveranderbaar en wordt voorzien van een auditregistratie. Documentaanlevering en controle worden in een volgende fase aangesloten.</p>
   {payerLinks.length===0&&<p role="status" className={styles.notice}>
    Er is nog geen geverifieerde kostendrager. Je kunt alvast bedragen berekenen, maar opslaan blijft geblokkeerd totdat de juiste juridische entiteit aan het object is gekoppeld. <Link href="/admin/workspaces/estates/entities">Open de juridische objectkoppelingen</Link>.
   </p>}
  </section>
  <p><Link href="/admin/workspaces/estates/reports">Kostenrapportage en accountants-export openen →</Link></p>
  <ExpenseCalculator
   issuers={issuers.data??[]}
   properties={properties.data??[]}
   units={units.data??[]}
   suppliers={suppliers.data??[]}
   payerLinks={payerLinks}
   canSaveDraft={true}
  />
  <section className={styles.panel} aria-label="Vastgelegde kostenconcepten" id="expense-register" style={{marginTop:22}}>
   <p className={styles.kicker}>03 / INTERNE CONTROLE</p>
   <h2>Inkoopkostenconcepten ({drafts.count})</h2>
   <form method="get" action="/admin/workspaces/estates/expenses#expense-register" className={styles.registerFilters}>
    <label>Zoeken op referentie of omschrijving<input name="q" defaultValue={filters.q} maxLength={100} placeholder="Bijvoorbeeld onderhoud"/></label>
    <label>Object<select name="property" defaultValue={filters.property}><option value="">Alle objecten</option>{properties.data!.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Betalende entiteit<select name="entity" defaultValue={filters.entity}><option value="">Alle entiteiten</option>{issuers.data!.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Leverancier<select name="supplier" defaultValue={filters.supplier}><option value="">Alle leveranciers</option>{suppliers.data!.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Factuurdatum vanaf<input type="date" name="from" defaultValue={filters.from}/></label>
    <label>Factuurdatum tot en met<input type="date" name="until" defaultValue={filters.until}/></label>
    <div className={styles.registerActions}><button type="submit" className={styles.saveButton}>Toon resultaten</button><Link href="/admin/workspaces/estates/expenses#expense-register">Wis filters</Link></div>
   </form>
   <p className={styles.hint} role="status">{drafts.count} resultaten · pagina {filters.page} van {pageCount}. Per pagina maximaal {EXPENSE_PAGE_SIZE} concepten.</p>
   <div className={styles.importCards} aria-label="Totalen op deze pagina">
    <div><small>Netto · deze pagina</small><strong>{formatCents(totals.net)}</strong></div>
    <div><small>Btw · deze pagina</small><strong>{formatCents(totals.vat)}</strong></div>
    <div><small>Bruto · deze pagina</small><strong>{formatCents(totals.gross)}</strong></div>
   </div>
   {drafts.data.length===0?<p>Geen kostenconcepten gevonden voor deze selectie.</p>:
    <div className={styles.tableScroll} role="region" tabIndex={0} aria-label="Inkoopkostenconcepten">
     <table>
      <thead><tr><th>Datum</th><th>Object</th><th>Betalende entiteit</th><th>Leverancier</th><th>Referentie</th><th>Bedrag</th><th>Status</th></tr></thead>
      <tbody>{(drafts.data??[]).map(d=><tr key={d.id}>
       <td>{d.invoice_date}</td><td>{propertyNames.get(d.property_id)??"Onbekend object"}</td>
       <td>{issuerNames.get(d.legal_entity_id)??"Onbekende entiteit"}</td>
       <td>{supplierNames.get(d.supplier_relationship_id)??"Onbekende relatie"}</td>
       <td>{d.supplier_invoice_number}</td><td>{formatCents(d.gross_cents)}</td>
       <td>{d.status==="draft"?"Concept":d.status} · {d.source_document_status==="missing"?"bron ontbreekt":d.source_document_status}
        <details><summary>Details</summary><p className={styles.detailText}>{d.description}</p><p>Categorie: {d.category}</p><p>Netto {formatCents(d.net_cents)} · btw {formatCents(d.vat_cents)}</p></details></td>
      </tr>)}</tbody>
     </table>
    </div>}
   <nav className={styles.registerActions} aria-label="Pagina's met kostenconcepten">
    {filters.page>1&&<Link href={expenseRegisterHref(filters,filters.page-1)}>← Vorige pagina</Link>}
    {filters.page<pageCount&&<Link href={expenseRegisterHref(filters,filters.page+1)}>Volgende pagina →</Link>}
   </nav>
  </section>
  <WeeklyCostsImport/>
 </main>;
}
