import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {allRows} from '../../../../../lib/property-operations/staff-data';
import {annualSource} from '../../../../../lib/accountancy/administration-data';
import {uuid,type Year} from '../../../../../lib/accountancy/administration';
import {propertyFinancialReport} from '../../../../../lib/accountancy/property-financial-report';
import s from './performance.module.css';

export const dynamic='force-dynamic';
type Params=Record<string,string|string[]|undefined>;
const get=(params:Params,key:string)=>typeof params[key]==='string'?params[key] as string:'';

export default async function PropertyFinancialPerformance({searchParams}:{searchParams:Promise<Params>}){
 const {db}=await requireEstateAdmin();
 const {locale:locale,language}=await getAdminI18n();
 const l=(en:string,es:string)=>language==='es'?es:en;
 const params=await searchParams;
 const yearId=get(params,'administration'),property=get(params,'property'),project=get(params,'project');
 if((yearId&&!uuid.test(yearId))||(property&&!uuid.test(property))||(project&&!uuid.test(project)))notFound();
 const [years,issuers,properties]=await Promise.all([
  allRows<Year>((a,b)=>db.from('mzs_accountancy_years').select('*',{count:'exact'}).order('fiscal_year',{ascending:false}).order('id').range(a,b)),
  allRows<{id:string;name:string}>((a,b)=>db.from('mzs_lease_issuers').select('id,name',{count:'exact'}).order('name').order('id').range(a,b)),
  allRows<{id:string;name:string;address:string|null}>((a,b)=>db.from('mzs_estate_properties').select('id,name,address',{count:'exact'}).order('address').order('id').range(a,b)),
 ]);
 const chosen=yearId?years.find(x=>x.id===yearId):(years.find(x=>x.purpose==='current')??years[0]);
 if(yearId&&!chosen)notFound();
 const knownProperties=new Map(properties.map(x=>[x.id,x]));
 if(property&&!knownProperties.has(property))notFound();
 let source:Awaited<ReturnType<typeof annualSource>>|null=null;
 let report:ReturnType<typeof propertyFinancialReport>|null=null;
 let failed=false;
 if(chosen)try{
  source=await annualSource(db,chosen.id);
  if(project&&!source.projects.some(x=>x.id===project))notFound();
  report=propertyFinancialReport(source,{propertyId:property||undefined,projectId:project||undefined});
 }catch{failed=true;source=null;report=null;}
 const money=(value:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100);
 const counts=report?.totals;
 const projects=(source?.projects??[]).filter(p=>!property||p.property_id===property);
 const issuer=issuers.find(x=>x.id===chosen?.issuer_id)?.name??l('Unknown entity','Entidad no disponible');
 const filters=(newProperty:string,newProject:string)=>{
  const q=new URLSearchParams();
  if(chosen)q.set('administration',chosen.id);
  if(newProperty)q.set('property',newProperty);
  if(newProject)q.set('project',newProject);
  return '/admin/workspaces/accountancy/performance'+(q.size?'?'+q.toString():'');
 };
 const purchase=new URLSearchParams({entity:chosen?.issuer_id??'',from:String(chosen?.fiscal_year??'')+'-01-01',until:String(chosen?.fiscal_year??'')+'-12-31'});
 if(property)purchase.set('property',property);
 const sales=new URLSearchParams({entity:chosen?.issuer_id??'',year:String(chosen?.fiscal_year??'')});
 return <main className={s.page}>
  <Link href="/admin/workspaces/accountancy" className={s.back}>{l('← Accountancy','← Contabilidad')}</Link>
  <header className={s.heading}>
   <div><p className={s.kicker}>MZS GROUP · REAL ESTATE FINANCE</p>
    <h1>{l('Property & project reporting','Informes por inmueble y proyecto')}</h1>
    <p>{l('Contract invoicing and purchase concepts by verified administrative allocation. Source-backed figures, with no assumed attribution or bank receipt.','Facturación y borradores de compra según asignaciones administrativas verificadas. Cifras basadas en registros, sin atribuciones ni cobros bancarios supuestos.')}</p>
   </div>
  </header>
  <form method="get" className={s.filters}>
   <label>{l('Entity & financial year','Entidad y ejercicio')}
    <select name="administration" defaultValue={chosen?.id??''} required>
     <option value="" disabled>{l('Select an administration','Seleccione una administración')}</option>
     {years.map(y=><option key={y.id} value={y.id}>{issuers.find(e=>e.id===y.issuer_id)?.name??y.issuer_id} · {y.fiscal_year}{y.purpose==='reference'?' · '+l('Reference','Referencia'):''}</option>)}
    </select>
   </label>
   <label>{l('Property','Inmueble')}<select name="property" defaultValue={property}>
    <option value="">{l('All properties / company level','Todos los inmuebles / empresa')}</option>
    {properties.map(p=><option key={p.id} value={p.id}>{p.address||p.name}</option>)}
   </select></label>
   <label>{l('Project','Proyecto')}<select name="project" defaultValue={project}>
    <option value="">{l('All projects and ordinary costs','Todos los proyectos y costes ordinarios')}</option>
    {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
   </select></label>
   <button>{l('Update report','Actualizar informe')}</button>
  </form>
  {source&&chosen&&<p className={s.scope}>{issuer} · {chosen.fiscal_year} {property?' · '+(knownProperties.get(property)?.address||knownProperties.get(property)?.name):''}{project?' · '+(source.projects.find(x=>x.id===project)?.name??''):''}</p>}
  {!chosen&&<p role="status">{l('Choose an administration. No figures are available without verified source records.','Seleccione una administración. No se muestran cifras sin registros verificados.')}</p>}
  {failed&&<p role="alert" className={s.error}>{l('The full source register could not be verified. No partial financial totals are shown.','No se pudo verificar el registro completo. No se muestran totales financieros parciales.')}</p>}
  {counts&&source&&chosen&&<>
   <section className={s.metrics} aria-label={l('Administrative financial overview','Resumen financiero administrativo')}>
    <div><span>{l('Issued invoices incl. VAT','Facturas emitidas incl. IVA')}</span><strong>{money(counts.invoicedGross)}</strong><small>{counts.invoiceCount} {l('invoices, by issue date','facturas, por fecha de emisión')}</small></div>
    <div><span>{l('Credit notes incl. VAT','Abonos incl. IVA')}</span><strong>{money(counts.creditsGross)}</strong><small>{counts.creditCount} {l('credits, shown separately','abonos, por separado')}</small></div>
    <div><span>{l('Reviewed purchase concepts incl. VAT','Borradores revisados incl. IVA')}</span><strong>{money(counts.reviewedCostGross)}</strong><small>{l('Reviewed does not mean paid or posted','Revisado no significa pagado ni contabilizado')}</small></div>
    <div><span>{l('Purchase concepts pending review','Borradores pendientes de revisión')}</span><strong>{money(counts.pendingCostGross)}</strong><small>{l('Not posted expenses','No son gastos contabilizados')}</small></div>
    <div><span>{l('Excluded purchase concepts','Borradores excluidos')}</span><strong>{money(counts.excludedCostGross)}</strong><small>{l('Excluded from active cost totals','Excluidos de los costes activos')}</small></div>
    <div><span>{l('Income without property allocation','Ingresos sin asignación a inmueble')}</span><strong>{money(counts.unallocatedIncomeGross)}</strong><small>{counts.unallocatedInvoiceCount} {l('invoices awaiting explicit attribution','facturas pendientes de asignación explícita')}</small></div>
   </section>
   <p className={s.disclaimer}>{l('All money amounts shown here are gross source values including recorded VAT. Invoices, approved credits, reviewed purchase concepts and pending concepts are separate administrative measures. These figures are NOT profit, taxable income, bank cash received, approved expenses or a reconciled accounting statement. Historical imported archives and unbilled forecasts are not included.','Todos los importes son valores brutos de origen con IVA registrado. Facturas, abonos, borradores revisados y pendientes son medidas administrativas distintas. Estas cifras NO representan beneficios, renta imponible, cobros bancarios, gastos aprobados ni una contabilidad conciliada. No se incluyen archivos históricos importados ni previsiones sin facturar.')}</p>
   <section className={s.panel} aria-label={l('Monthly comparison','Comparación mensual')}>
    <div className={s.sectionHead}><div><p className={s.kicker}>{chosen.fiscal_year}</p><h2>{l('Month-by-month source comparison','Comparación mensual de registros')}</h2></div>
      <span>{l('Invoice and purchase document dates','Fechas de facturas emitidas y de compras')}</span></div>
    <div className={s.scroll} role="region" tabIndex={0} aria-label={l('Monthly source values table','Tabla mensual de importes')}>
     <table><thead><tr><th>{l('Month','Mes')}</th><th>{l('Invoiced','Facturado')}</th><th>{l('Credits','Abonos')}</th><th>{l('Reviewed concepts','Borradores revisados')}</th><th>{l('Pending concepts','Borradores pendientes')}</th><th>{l('Maintenance concepts','Borradores mantenimiento')}</th><th>{l('Renovation concepts','Borradores reformas')}</th></tr></thead>
      <tbody>{report.months.map(row=><tr key={row.month}>
       <th scope="row">{new Intl.DateTimeFormat(locale,{timeZone:'UTC',month:'short',year:'numeric'}).format(new Date(row.month+'-01T12:00:00Z'))}</th>
       <td>{money(row.invoicedGross)}</td><td>{money(row.creditsGross)}</td><td>{money(row.reviewedCostGross)}</td><td>{money(row.pendingCostGross)}</td><td>{money(row.maintenanceGross)}</td><td>{money(row.renovationGross)}</td>
      </tr>)}</tbody>
      <tfoot><tr><th>{l('Year total','Total anual')}</th><td>{money(counts.invoicedGross)}</td><td>{money(counts.creditsGross)}</td><td>{money(counts.reviewedCostGross)}</td><td>{money(counts.pendingCostGross)}</td><td>{money(counts.maintenanceGross)}</td><td>{money(counts.renovationGross)}</td></tr></tfoot>
     </table>
    </div>
    <p className={s.caption}>{l('Maintenance and renovation categories include both reviewed and pending concepts, but exclude rejected concepts; these categories overlap with the cost review columns and must not be added to them.','Las categorías de mantenimiento y reformas incluyen borradores revisados y pendientes, pero no los excluidos. Se solapan con las columnas de revisión y no deben sumarse a ellas.')}</p>
   </section>
   <section className={s.panel} aria-label={l('Projects and source records','Proyectos y registros de origen')}>
    <h2>{l('Projects and verified allocation','Proyectos y asignaciones verificadas')}</h2>
    <p>{l('Choose a project to display only records explicitly linked to it. Records assigned to the property but not a specific project remain at property level.','Seleccione un proyecto para ver solo registros vinculados explícitamente. Los documentos del inmueble sin proyecto siguen a nivel de inmueble.')}</p>
    <div className={s.projectLinks}>
     {projects.map(p=><Link key={p.id} href={filters(p.property_id??'',p.id)} aria-current={project===p.id?'page':undefined}>{p.name} · {p.property_id?(knownProperties.get(p.property_id)?.name??l('Property','Inmueble')):l('Entity level','Nivel empresa')}</Link>)}
     {!projects.length&&<p>{l('No registered projects for this selected administration and property.','No hay proyectos registrados para esta administración e inmueble.')}</p>}
    </div>
    <nav className={s.actions} aria-label={l('Related finance registers','Registros financieros relacionados')}>
     <Link href={'/admin/workspaces/accountancy/administrations/'+chosen.id+'#cost-centers'}>{l('Review income allocations','Revisar asignaciones de ingresos')} →</Link>
     <Link href={'/admin/workspaces/estates/expenses?'+purchase.toString()+'#expense-register'}>{l('Open matching purchase drafts','Abrir borradores de compra coincidentes')} →</Link>
     <Link href={'/admin/workspaces/accountancy/sales?'+sales.toString()}>{l('Issued invoices by entity / year','Facturas emitidas por entidad / año')} →</Link>
     <Link href={'/admin/workspaces/accountancy/administrations/'+chosen.id+'/bank'}>{l('Check bank allocations separately','Comprobar conciliación bancaria por separado')} →</Link>
    </nav>
    <p className={s.caption}>{l('The sales link above is scoped to entity and year, not to the property or project. Review explicit allocations in the annual administration before attributing revenue.','El enlace de ventas solo aplica entidad y año, no inmueble ni proyecto. Compruebe las asignaciones explícitas en la administración anual antes de atribuir ingresos.')}</p>
   </section>
  </>}
 </main>;
}
