
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import Link from 'next/link';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {allRows,one,type Params} from '../../../../../lib/property-operations/staff-data';
import {uuid} from '../../../../../lib/property-operations/staff-work';
import {summarizeConceptCosts,type ConceptCost,type CostTotal} from '../../../../../lib/property-operations/cost-report';
import s from '../../../../staff/staff.module.css';
export const dynamic='force-dynamic';
const euro=(n:number, adminLocale = 'en-GB')=>new Intl.NumberFormat(adminLocale,{style:'currency',currency:'EUR'}).format(n/100);
export default async function Reports({searchParams}:{searchParams:Promise<Params>}){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 requireStaffEnvironment();const {db}=await requireEstateAdmin();const params=await searchParams;
 const rawYear=one(params.year)??String(new Date().getUTCFullYear()),entity=one(params.entity)??'',property=one(params.property)??'';
 if(!/^20\d{2}$/.test(rawYear)||(entity&&!uuid.test(entity))||(property&&!uuid.test(property)))return <main><h1>{adminT("Invalid report selection")}</h1><Link href="/admin/workspaces/estates/reports">{adminT("Clear filters")}</Link></main>;
 const year=Number(rawYear);
 const [issuers,properties,costs]=await Promise.all([
 allRows<{id:string;name:string}>((a,b)=>db.from('mzs_lease_issuers').select('id,name',{count:'exact'}).order('id').range(a,b)),
 allRows<{id:string;name:string}>((a,b)=>db.from('mzs_estate_properties').select('id,name',{count:'exact'}).order('id').range(a,b)),
 allRows<ConceptCost>((a,b)=>{let q=db.from('mzs_ops_expense_drafts').select('id,property_id,legal_entity_id,invoice_date,category,net_cents,vat_cents,gross_cents',{count:'exact'}).gte('invoice_date',year+'-01-01').lte('invoice_date',year+'-12-31');if(entity)q=q.eq('legal_entity_id',entity);if(property)q=q.eq('property_id',property);return q.order('id').range(a,b);})
 ]);
 if((entity&&!issuers.some(x=>x.id===entity))||(property&&!properties.some(x=>x.id===property)))return <main><h1>{adminT("Entity or property not found")}</h1><Link href="/admin/workspaces/estates/reports">{adminT("Clear filters")}</Link></main>;
 const report=summarizeConceptCosts(costs);
 const table=(label:string,rows:[string,CostTotal][])=> <section className={s.panel}><h2>{adminT(label)}</h2><div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Category")}</th><th>{adminT("Drafts")}</th><th>{adminT("Excl. VAT")}</th><th>{adminT("VAT as entered")}</th><th>{adminT("Incl. VAT")}</th></tr></thead><tbody>{rows.map(([name,t])=><tr key={name}><td>{name}</td><td>{t.count}</td><td>{euro(t.net, adminLocale)}</td><td>{euro(t.vat, adminLocale)}</td><td>{euro(t.gross, adminLocale)}</td></tr>)}</tbody></table></div>{!rows.length&&<p>{adminT("No expense drafts match this selection.")}</p>}</section>;
 return <main className={s.adminPage}><Link href="/admin/workspaces/accountancy">{adminT("← Accountancy")}</Link><h1>{adminT("Expense reporting & accountant export")}</h1><p><Link href="/admin/workspaces/estates/history">{adminT("Historical weekly statements and external invoices →")}</Link></p><form method="get" className={s.filter}><label>{adminT("Year")}<input type="number" name="year" min={2000} max={2099} required defaultValue={year}/></label><label>{adminT("Paying entity")}<select name="entity" defaultValue={entity}><option value="">{adminT("All entities")}</option>{issuers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>{adminT("Property")}<select name="property" defaultValue={property}><option value="">{adminT("All properties")}</option>{properties.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button>{adminT("Update report")}</button></form>
 <section className={s.panel}><h2>{adminT("Recorded expense drafts ·")} {year}</h2><p><strong>{euro(report.total.gross, adminLocale)}</strong>  {adminT("incl. VAT ·")} {report.total.count}  {adminT("drafts · by invoice date")}</p><p>{adminT("These are not yet approved purchase costs or paid amounts. Approval awaits the new document delivery process. These amounts are not deducted from the existing cashflow report.")}</p><Link href="/admin/workspaces/estates/expenses">{adminT("Open the expense register →")}</Link></section>
 {table("Expense drafts by month",report.months)}{table("Expense drafts by property",report.properties.map(([id,t])=>[properties.find(p=>p.id===id)?.name??id,t]))}{table("Expense drafts by category",report.categories)}
 <section className={s.panel}><h2>{adminT("Export for local accountants")}</h2><p>{adminT("Choose one legal entity and a year. The ZIP contains CSVs of issued rental and booking invoices, recorded external invoices, separately dated receipts, administrative reversals and exceptions.")}</p><form action="/admin/workspaces/estates/expenses/sales-export" method="get" className={s.filter}><label>{adminT("Issuing entity")}<select required name="entity" defaultValue={entity}><option value="" disabled>{adminT("Choose an entity")}</option>{issuers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>{adminT("Year")}<input required type="number" name="year" min={2000} max={2099} defaultValue={year}/></label><button>{adminT("Download accountant export (ZIP)")}</button></form><p>{adminT("The export covers the entire selected entity and does not follow the property filter above. Purchase drafts, uninvoiced bookings, unallocated receipts and Capital are outside this package. The ZIP explanation lists missing source data; this is not a complete set of accounts.")}</p></section>
 </main>;
}
