
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
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
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 // Fail closed before querying either database from the wrong deployment.
 const allowed=(process.env.VERCEL_ENV==="production" &&
   process.env.NEXT_PUBLIC_SUPABASE_URL==="https://ptrnjzmcehrhbsfxntgw.supabase.co") ||
  (process.env.VERCEL_ENV==="preview" &&
   process.env.NEXT_PUBLIC_SUPABASE_URL==="https://senonkpxdtlhyhrubicg.supabase.co");
 if(!allowed)notFound();
 const {db}=await requireEstateAdmin();
 let filters;
 try{filters=expenseFilters(await searchParams);}catch(error){return <main className={styles.main}><h1>{adminT("Property expenses")}</h1><p role="alert">{error instanceof Error?error.message:adminT("Invalid filters.")}</p><Link href="/admin/workspaces/estates/expenses">{adminT("Clear filters")}</Link></main>;}
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
 if(drafts.error||drafts.count===null||drafts.data===null)throw new Error("The expense register could not be loaded.");
 const pageCount=Math.max(1,Math.ceil(drafts.count/EXPENSE_PAGE_SIZE));
 if(filters.page>pageCount)redirect(expenseRegisterHref(filters,pageCount));
 if(drafts.data.length!==Math.min(EXPENSE_PAGE_SIZE,Math.max(0,drafts.count-offset)))throw new Error("The expense register was not fully loaded. Please retry.");
 const totals=expensePageTotals(drafts.data);
 const issuerNames=new Map((issuers.data??[]).map(x=>[x.id,x.name]));
 const propertyNames=new Map((properties.data??[]).map(x=>[x.id,x.name]));
 const supplierNames=new Map((suppliers.data??[]).map(x=>[x.id,x.name]));
 const payerLinks=(links.data??[]).filter(x=>x.relationship_type==="payer");
 const formatCents=(value:number)=>new Intl.NumberFormat(adminLocale,{style:"currency",currency:"EUR"}).format(value/100);
 return <main className={styles.main}>
  <Link href="/admin/workspaces/accountancy" className={styles.back}>{adminT("Back to Accountancy")}</Link>
  <header className={styles.heading}>
   <div>
    <p className={styles.kicker}>{adminT("MZS GROUP / ESTATES / EXPENSE ADMINISTRATION")}</p>
    <h1>{adminT("Property expenses & purchase drafts")}</h1>
    <p>{adminT("Calculate purchase expense allocation across a property or its units. Save only verified drafts for the correct legal cost bearer.")}</p>
   </div>
  </header>
  <section className={styles.panel} aria-label={adminT("Belangrijke beperkingen")}>
   <h2>{adminT("Draft stage — no financial posting")}</h2>
   <p>{adminT("This page does not yet record final supplier invoices, payments, VAT returns or recharges. A saved draft is immutable and receives an audit entry. Document delivery and verification will be connected in a later phase.")}</p>
   {payerLinks.length===0&&<p role="status" className={styles.notice}>
    {adminT("No verified cost bearer is available yet. You can calculate amounts, but saving remains blocked until the correct legal entity is associated with the property.")} <Link href="/admin/workspaces/estates/entities">{adminT("Open legal property associations")}</Link>.
   </p>}
  </section>
  <p><Link href="/admin/workspaces/estates/reports">{adminT("Open expense reporting and accountant export →")}</Link></p>
  <ExpenseCalculator
   issuers={issuers.data??[]}
   properties={properties.data??[]}
   units={units.data??[]}
   suppliers={suppliers.data??[]}
   payerLinks={payerLinks}
   canSaveDraft={true}
  />
  <section className={styles.panel} aria-label={adminT("Recorded expense drafts")} id="expense-register" style={{marginTop:22}}>
   <p className={styles.kicker}>{adminT("03 / INTERNAL REVIEW")}</p>
   <h2>{adminT("Purchase expense drafts (")}{drafts.count})</h2>
   <form method="get" action="/admin/workspaces/estates/expenses#expense-register" className={styles.registerFilters}>
    <label>{adminT("Search by reference or description")}<input name="q" defaultValue={filters.q} maxLength={100} placeholder={adminT("For example, maintenance")}/></label>
    <label>{adminT("Property")}<select name="property" defaultValue={filters.property}><option value="">{adminT("All properties")}</option>{properties.data!.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>{adminT("Paying entity")}<select name="entity" defaultValue={filters.entity}><option value="">{adminT("All entities")}</option>{issuers.data!.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>{adminT("Supplier")}<select name="supplier" defaultValue={filters.supplier}><option value="">{adminT("All suppliers")}</option>{suppliers.data!.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>{adminT("Invoice date from")}<input type="date" name="from" defaultValue={filters.from}/></label>
    <label>{adminT("Invoice date through")}<input type="date" name="until" defaultValue={filters.until}/></label>
    <div className={styles.registerActions}><button type="submit" className={styles.saveButton}>{adminT("Show results")}</button><Link href="/admin/workspaces/estates/expenses#expense-register">{adminT("Clear filters")}</Link></div>
   </form>
   <p className={styles.hint} role="status">{drafts.count}  {adminT("results · page")} {filters.page}  {adminT("of")} {pageCount}{adminT(". Maximum per page:")} {EXPENSE_PAGE_SIZE}  {adminT("drafts.")}</p>
   <div className={styles.importCards} aria-label={adminT("Totals on this page")}>
    <div><small>{adminT("Net · this page")}</small><strong>{formatCents(totals.net)}</strong></div>
    <div><small>{adminT("VAT · this page")}</small><strong>{formatCents(totals.vat)}</strong></div>
    <div><small>{adminT("Gross · this page")}</small><strong>{formatCents(totals.gross)}</strong></div>
   </div>
   {drafts.data.length===0?<p>{adminT("No expense drafts match this selection.")}</p>:
    <div className={styles.tableScroll} role="region" tabIndex={0} aria-label={adminT("Purchase expense drafts")}>
     <table>
      <thead><tr><th>{adminT("Date")}</th><th>{adminT("Property")}</th><th>{adminT("Paying entity")}</th><th>{adminT("Supplier")}</th><th>{adminT("Reference")}</th><th>{adminT("Amount")}</th><th>{adminT("Status")}</th></tr></thead>
      <tbody>{(drafts.data??[]).map(d=><tr key={d.id}>
       <td>{d.invoice_date}</td><td>{d.property_id?(propertyNames.get(d.property_id)??adminT("Unknown property")):adminT("Company-level costs")}</td>
       <td>{issuerNames.get(d.legal_entity_id)??adminT("Unknown entity")}</td>
       <td>{supplierNames.get(d.supplier_relationship_id)??adminT("Unknown relationship")}</td>
       <td>{d.supplier_invoice_number}</td><td>{formatCents(d.gross_cents)}</td>
       <td>{d.status==="draft"?adminT("Concept"):adminT(d.status)} · {d.source_document_status==="missing"?adminT("source missing"):d.source_document_status}
        <details><summary>{adminT("Details")}</summary><p className={styles.detailText}>{d.description}</p><p>{adminT("Category:")} {adminT(d.category)}</p><p>{adminT("Net")} {formatCents(d.net_cents)}  {adminT("· VAT")} {formatCents(d.vat_cents)}</p></details></td>
      </tr>)}</tbody>
     </table>
    </div>}
   <nav className={styles.registerActions} aria-label={adminT("Expense draft pages")}>
    {filters.page>1&&<Link href={expenseRegisterHref(filters,filters.page-1)}>{adminT("← Previous page")}</Link>}
    {filters.page<pageCount&&<Link href={expenseRegisterHref(filters,filters.page+1)}>{adminT("Next page →")}</Link>}
   </nav>
  </section>
  <p><Link href="/admin/workspaces/estates/history">{adminT("Open saved historical weekly statements and external invoices →")}</Link></p>
  <WeeklyCostsImport/>
 </main>;
}
