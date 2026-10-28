import Link from 'next/link';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {allRows,one,type Params} from '../../../../../lib/property-operations/staff-data';
import {uuid} from '../../../../../lib/property-operations/staff-work';
import {summarizeConceptCosts,type ConceptCost,type CostTotal} from '../../../../../lib/property-operations/cost-report';
import s from '../../../../staff/staff.module.css';
export const dynamic='force-dynamic';
const euro=(n:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(n/100);
export default async function Reports({searchParams}:{searchParams:Promise<Params>}){
 requireStaffEnvironment();const {db}=await requireEstateAdmin();const params=await searchParams;
 const rawYear=one(params.year)??String(new Date().getUTCFullYear()),entity=one(params.entity)??'',property=one(params.property)??'';
 if(!/^20\d{2}$/.test(rawYear)||(entity&&!uuid.test(entity))||(property&&!uuid.test(property)))return <main><h1>Ongeldige rapportselectie</h1><Link href="/admin/workspaces/estates/reports">Wis filters</Link></main>;
 const year=Number(rawYear);
 const [issuers,properties,costs]=await Promise.all([
 allRows<{id:string;name:string}>((a,b)=>db.from('mzs_lease_issuers').select('id,name',{count:'exact'}).order('id').range(a,b)),
 allRows<{id:string;name:string}>((a,b)=>db.from('mzs_estate_properties').select('id,name',{count:'exact'}).order('id').range(a,b)),
 allRows<ConceptCost>((a,b)=>{let q=db.from('mzs_ops_expense_drafts').select('id,property_id,legal_entity_id,invoice_date,category,net_cents,vat_cents,gross_cents',{count:'exact'}).gte('invoice_date',year+'-01-01').lte('invoice_date',year+'-12-31');if(entity)q=q.eq('legal_entity_id',entity);if(property)q=q.eq('property_id',property);return q.order('id').range(a,b);})
 ]);
 if((entity&&!issuers.some(x=>x.id===entity))||(property&&!properties.some(x=>x.id===property)))return <main><h1>Entiteit of object niet gevonden</h1><Link href="/admin/workspaces/estates/reports">Wis filters</Link></main>;
 const report=summarizeConceptCosts(costs);
 const table=(label:string,rows:[string,CostTotal][])=> <section className={s.panel}><h2>{label}</h2><div className={s.tableWrap}><table className={s.table}><thead><tr><th>Onderdeel</th><th>Concepten</th><th>Excl. btw</th><th>Btw volgens invoer</th><th>Incl. btw</th></tr></thead><tbody>{rows.map(([name,t])=><tr key={name}><td>{name}</td><td>{t.count}</td><td>{euro(t.net)}</td><td>{euro(t.vat)}</td><td>{euro(t.gross)}</td></tr>)}</tbody></table></div>{!rows.length&&<p>Geen kostenconcepten voor deze selectie.</p>}</section>;
 return <main className={s.adminPage}><Link href="/admin/workspaces/estates">← Vastgoedbeheer</Link><h1>Kostenrapportage &amp; accountants-export</h1><p><Link href="/admin/workspaces/estates/history">Historische weekopgaven en externe facturen →</Link></p><form method="get" className={s.filter}><label>Jaar<input type="number" name="year" min={2000} max={2099} required defaultValue={year}/></label><label>Betalende entiteit<select name="entity" defaultValue={entity}><option value="">Alle entiteiten</option>{issuers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Object<select name="property" defaultValue={property}><option value="">Alle objecten</option>{properties.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button>Rapport bijwerken</button></form>
 <section className={s.panel}><h2>Geregistreerde kostenconcepten · {year}</h2><p><strong>{euro(report.total.gross)}</strong> incl. btw · {report.total.count} concepten · op factuurdatum</p><p>Dit zijn nog geen goedgekeurde inkoopkosten of betaalde bedragen. Goedkeuring wacht op de nieuwe documentaanlevering. Deze bedragen worden niet afgetrokken van de bestaande kasstroomrapportage.</p><Link href="/admin/workspaces/estates/expenses">Open het kostenregister →</Link></section>
 {table('Kostenconcepten per maand',report.months)}{table('Kostenconcepten per object',report.properties.map(([id,t])=>[properties.find(p=>p.id===id)?.name??id,t]))}{table('Kostenconcepten per categorie',report.categories)}
 <section className={s.panel}><h2>Export voor lokale accountants</h2><p>Kies één juridische entiteit en een jaar. Het ZIP-bestand bevat CSV’s van uitgegeven huur- en boekingsfacturen, geregistreerde externe facturen, afzonderlijk gedateerde ontvangsten, administratieve tegenboekingen en uitzonderingen.</p><form action="/admin/workspaces/estates/expenses/sales-export" method="get" className={s.filter}><label>Uitgevende entiteit<select required name="entity" defaultValue={entity}><option value="" disabled>Kies een entiteit</option>{issuers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Jaar<input required type="number" name="year" min={2000} max={2099} defaultValue={year}/></label><button>Download accountants-export (ZIP)</button></form><p>De export geldt voor de gehele geselecteerde entiteit en volgt niet het objectfilter hierboven. Inkoopconcepten, nog niet gefactureerde boekingen, onverdeelde ontvangsten en Capital vallen buiten dit pakket. De toelichting in het ZIP vermeldt ontbrekende brongegevens; het is geen volledige boekhouding.</p></section>
 </main>;
}
