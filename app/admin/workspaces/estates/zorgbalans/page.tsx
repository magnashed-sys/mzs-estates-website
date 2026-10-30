import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {allRows} from '../../../../../lib/property-operations/staff-data';
import {operationsDay} from '../../../../../lib/property-operations/action-queues';
import {DraftForm,ConfirmSent,type Visit,type Invoice} from './BillingControls';
import s from './zorgbalans.module.css';
export const dynamic='force-dynamic';
export default async function ZorgbalansBilling(){
 requireStaffEnvironment();const {db}=await requireEstateAdmin();
 const [visits,invoices,people]=await Promise.all([
  allRows<Visit>((a,b)=>db.from('mzs_ops_zorgbalans_billable_visits').select('id,worked_on,profile_id,effective_minutes,description,invoiced_hours,net_cents',{count:'exact'}).order('worked_on').order('id').range(a,b)),
  allRows<Invoice>((a,b)=>db.from('mzs_ops_zorgbalans_invoices').select('id,invoice_number,issued_on,due_on,period_from,period_until,hours,net_cents,vat_cents,gross_cents,status,confirmation_note',{count:'exact'}).order('issued_on',{ascending:false}).order('id').range(a,b)),
  allRows<{id:string;full_name:string|null}>((a,b)=>db.from('profiles').select('id,full_name',{count:'exact'}).order('id').range(a,b))
 ]);
 const euro=(c:number)=>(c/100).toLocaleString('nl-NL',{style:'currency',currency:'EUR'});
 const hours=visits.reduce((n,v)=>n+v.invoiced_hours,0),net=visits.reduce((n,v)=>n+v.net_cents,0);
 return <main className={s.page}>
  <Link href="/admin/workspaces/estates/operations">← Operations Cockpit</Link>
  <p className={s.kicker}>PRIVÉFACTURATIE · ZORGBALANS</p>
  <h1>Zorgbalans · Uren & doorfacturatie</h1>
  <p className={s.intro}>Gewerkte tijd van Catherine wordt geregistreerd in het Property Manager Dashboard. Alleen gecontroleerde en goedgekeurde registraties komen hier in aanmerking voor facturatie.</p>
  <div className={s.stats}><div><small>Factuurgereed</small><strong>{visits.length} bezoeken</strong></div>
   <div><small>Factuururen</small><strong>{hours} uur</strong></div>
   <div><small>Excl. btw</small><strong>{euro(net)}</strong></div>
   <div><small>Incl. 21% btw</small><strong>{euro(net+Math.round(net*.21))}</strong></div></div>
  <p className={s.muted}>Historische factuur 7113 (26 uur, €650 excl. btw, 28 oktober 2026) blijft in het bestaande archief. Nieuwe dagelijkse registraties vóór 26 oktober 2026 worden hier niet opnieuw gefactureerd.</p>
  <DraftForm visits={visits} people={people} today={operationsDay()}/>
  <section className={s.card}><h2>Concepten en extern verzonden facturen</h2>
   {invoices.length?<div className={s.invoiceList}>{invoices.map(i=><article key={i.id} className={s.invoice}>
    <div><strong>Factuur {i.invoice_number}</strong><p>{i.period_from} t/m {i.period_until} · {i.hours} uur · {euro(i.net_cents)} excl. btw · {euro(i.gross_cents)} incl. btw</p>
     <p>Factuurdatum {i.issued_on} · vervaldatum {i.due_on} · {i.status==='concept'?'Concept / nog niet verzonden':'Extern verzonden'}</p></div>
    <a href={'/api/admin/zorgbalans/invoices/'+encodeURIComponent(i.id)+'/pdf'}>PDF {i.status==='concept'?'concept':'factuur'} downloaden</a>
    {i.status==='concept'?<ConfirmSent invoice={i}/>:<p className={s.muted}>Verzending bevestigd: {i.confirmation_note}</p>}
   </article>)}</div>:<p>Er zijn nog geen nieuwe Zorgbalans-facturen opgesteld.</p>}
  </section>
  <p className={s.muted}>Deze workflow maakt geen MZS Group-factuur. De privéfacturen bevatten uitsluitend gegevens van Magdy Nashed en Zorgbalans. Er vindt geen automatische e-mailverzending of betaling plaats.</p>
 </main>;
}
