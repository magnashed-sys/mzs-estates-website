import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import {allRows} from '../../../../../lib/property-operations/staff-data';
import {annualSource} from '../../../../../lib/accountancy/administration-data';
import {archiveEntities} from '../../../../../lib/accountancy/archive-data';
import {completenessItems,completenessLabels} from '../../../../../lib/accountancy/completeness';
import {purchaseReviewItems,purchaseReviewCounts,type PurchaseReviewGroup} from '../../../../../lib/accountancy/purchase-review';
import {uuid,type Year} from '../../../../../lib/accountancy/administration';
import s from './purchase-inbox.module.css';

export const dynamic='force-dynamic';
type Search=Record<string,string|string[]|undefined>;
const groups:PurchaseReviewGroup[]=['originals','duplicates','suppliers','review'];

export default async function PurchaseReviewInbox({searchParams}:{searchParams:Promise<Search>}){
 const {db}=await requireEstateAdmin();
 const {language}=await getAdminI18n(),l=(en:string,es:string)=>language==='es'?es:en;
 const q=await searchParams;
 const yearId=typeof q.administration==='string'?q.administration:'';
 const group=typeof q.group==='string'?q.group:'';
 const search=typeof q.q==='string'?q.q.trim():'';
 const rawPage=typeof q.page==='string'&&/^[1-9]\d{0,4}$/.test(q.page)?Number(q.page):1;
 if((yearId&&!uuid.test(yearId))||(group&&!groups.includes(group as PurchaseReviewGroup))||search.length>100)notFound();
 const [years,entities]=await Promise.all([
  allRows<Year>((a,b)=>db.from('mzs_accountancy_years').select('*',{count:'exact'}).order('fiscal_year',{ascending:false}).order('id').range(a,b)),
  archiveEntities(db)
 ]);
 const chosen=years.find(y=>y.id===yearId);
 if(yearId&&!chosen)notFound();

 let items:ReturnType<typeof purchaseReviewItems>=[],failed=false;
 if(chosen)try{
  const [source,suppliers]=await Promise.all([
   annualSource(db,chosen.id),
   allRows<{id:string;name:string;kind:string;company_details:unknown}>((a,b)=>db.from('mzs_lease_relationships')
    .select('id,name,kind,company_details',{count:'exact'}).order('id').range(a,b))
  ]);
  items=purchaseReviewItems(completenessItems(source,suppliers));
 }catch{failed=true;}
 const counts=purchaseReviewCounts(items);
 const filtered=items.filter(i=>(!group||i.category===group)&&(!search||[i.label,...i.issues].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase())));
 const perPage=25,pages=Math.max(1,Math.ceil(filtered.length/perPage)),page=Math.min(rawPage,pages);
 const href=(nextGroup:string,p=1)=>{
  const params=new URLSearchParams();
  if(chosen)params.set('administration',chosen.id);
  if(nextGroup)params.set('group',nextGroup);
  if(search)params.set('q',search);
  if(p>1)params.set('page',String(p));
  return '/admin/workspaces/accountancy/purchase-inbox'+(params.size?'?'+params.toString():'');
 };
 const name=(g:string)=>g==='originals'?l('Original PDFs','PDF originales'):g==='duplicates'?l('Possible duplicates','Posibles duplicados'):g==='suppliers'?l('Supplier records','Proveedores'):l('Other reviews','Otras revisiones');
 return <main className={s.page}>
  <Link href="/admin/workspaces/accountancy" className={s.back}>{l('← Accountancy','← Contabilidad')}</Link>
  <header className={s.heading}>
   <p className={s.kicker}>{l('MZS GROUP / ACCOUNTANCY','MZS GROUP / CONTABILIDAD')}</p>
   <h1>{l('Purchase review inbox','Bandeja de revisión de compras')}</h1>
   <p>{l('One worklist for original purchase PDFs, possible duplicates, supplier checks and drafts requiring review. Existing source records stay in their own administration.','Una lista para PDF originales, posibles duplicados, comprobaciones de proveedores y borradores pendientes de revisión. Los registros originales permanecen en su administración.')}</p>
  </header>
  <form method="get" className={s.filters}>
   <label>{l('Entity and financial year','Entidad y ejercicio')}
    <select name="administration" defaultValue={chosen?.id??''} required>
     <option value="" disabled>{l('Select an administration','Seleccione una administración')}</option>
     {years.map(y=><option key={y.id} value={y.id}>{entities.find(e=>e.id===y.issuer_id)?.name??y.issuer_id} · {y.fiscal_year}</option>)}
    </select>
   </label>
   <label>{l('Search','Buscar')}<input type="search" name="q" maxLength={100} defaultValue={search} placeholder={l('Supplier, invoice or check','Proveedor, factura o control')}/></label>
   <label>{l('Priority','Prioridad')}<select name="group" defaultValue={group}>
    <option value="">{l('All checks','Todos los controles')}</option>
    {groups.map(g=><option key={g} value={g}>{name(g)}</option>)}
   </select></label>
   <button>{l('Open inbox','Abrir bandeja')}</button>
  </form>
  {!chosen&&<p role="status">{l('Select an entity and financial year to inspect its purchase register. No cross-entity totals are assumed.','Seleccione una entidad y ejercicio para revisar su registro de compras. No se presuponen totales entre entidades.')}</p>}
  {failed&&<p role="alert" className={s.error}>{l('Purchase controls could not be verified completely. No incomplete counts are shown.','No se han podido verificar todos los controles. No se muestran recuentos incompletos.')}</p>}
  {chosen&&!failed&&<>
   <nav className={s.quick} aria-label={l('Purchase review queues','Colas de revisión de compras')}>
    <Link href={href('')} aria-current={!group?'page':undefined}>{l('All issues','Todas las incidencias')} <strong>{counts.total}</strong></Link>
    {groups.map(g=><Link key={g} href={href(g)} aria-current={group===g?'page':undefined}>{name(g)} <strong>{counts[g]}</strong></Link>)}
   </nav>
   <p className={s.note}>{l('Items are counted once by their highest review priority. They are signals for administrator review, not posted costs, proof of duplicates or validated supplier matches.','Los elementos se cuentan una vez por su prioridad principal. Son indicios para revisión, no costes contabilizados, duplicados confirmados ni vínculos validados.')}</p>
   <section className={s.panel} aria-label={l('Purchase tasks','Tareas de compras')}>
    <div className={s.panelHeading}>
     <h2>{l('Actionable source records','Registros pendientes de revisión')}</h2>
     <span>{filtered.length} {l('matches','resultados')} · {page}/{pages}</span>
    </div>
    {!filtered.length&&<p>{l('No open issues found in these checks. This does not certify the accounting as complete.','No hay incidencias en estos controles. Esto no certifica que la contabilidad esté completa.')}</p>}
    <div className={s.list}>{filtered.slice((page-1)*perPage,page*perPage).map(item=><article className={s.item} key={item.id}>
     <div><span className={s.category}>{name(item.category)}</span><h3>{item.label}</h3>
      {item.issues.map(issue=><p key={issue} className={s.issue}>{completenessLabels[issue]?.[language==='es'?1:0]??issue}</p>)}
     </div>
     <Link href={item.href}>{l('Open source dossier →','Abrir expediente →')}</Link>
    </article>)}</div>
    {pages>1&&<nav className={s.pagination} aria-label={l('Inbox pages','Páginas de la bandeja')}>
     {page>1&&<Link href={href(group,page-1)}>{l('← Previous','← Anterior')}</Link>}
     <span>{l('Page','Página')} {page}/{pages}</span>
     {page<pages&&<Link href={href(group,page+1)}>{l('Next →','Siguiente →')}</Link>}
    </nav>}
   </section>
   <nav className={s.sourceLinks} aria-label={l('Purchase source modules','Módulos de origen de compras')}>
    <Link href={'/admin/workspaces/accountancy/completeness?administration='+chosen.id}>{l('Full completeness center','Centro de integridad completo')} →</Link>
    <Link href={'/admin/workspaces/accountancy/administrations/'+chosen.id+'#costs'}>{l('Annual purchase administration','Administración anual de compras')} →</Link>
    <Link href={'/admin/workspaces/estates/expenses?'+new URLSearchParams({entity:chosen.issuer_id,from:String(chosen.fiscal_year)+'-01-01',until:String(chosen.fiscal_year)+'-12-31'})+'#expense-register'}>{l('Property purchase draft register','Registro de gastos de inmuebles')} →</Link>
   </nav>
  </>}
  <p className={s.note}>{l('No invoice is approved, paid, booked, imported or deleted from this inbox. Only existing checks and their verified source links are shown.','Esta bandeja no aprueba, paga, contabiliza, importa ni elimina facturas. Solo muestra controles existentes y sus enlaces de origen verificados.')}</p>
 </main>;
}
