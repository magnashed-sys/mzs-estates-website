import Link from 'next/link';
import type {createClient} from '../../lib/supabase/server';
import {staffEnvironmentAvailable} from '../../lib/security/property-staff';
import {loadQueueCounts,operationsDay,queueHref} from '../../lib/property-operations/action-queues';
import s from './operations-actions.module.css';

export default async function OperationsActionCenter({db}:{db:Awaited<ReturnType<typeof createClient>>}){
 if(!staffEnvironmentAvailable())return null;
 const today=operationsDay(),counts=await loadQueueCounts(db,today);
 return <section className={s.panel} aria-labelledby="operations-actions-heading">
  <p className={s.kicker}>DAGELIJKS VASTGOEDBEHEER</p><h2 id="operations-actions-heading">Acties voor medewerkers &amp; onderhoud</h2>
  <p>Open de actielijst om uren, meldingen en budgetten op te volgen. Planning wordt beoordeeld op {today} (Europe/Madrid).</p>
  <form method="get" className={s.refresh}><button>Vernieuwen</button></form>
  <div className={s.cards}>{counts.map(q=><Link className={s.card} key={q.key} href={queueHref(q.key)} prefetch={false}><strong>{q.count===null?'Niet beschikbaar':q.count}</strong><span>{q.label}</span></Link>)}</div>
  {counts.some(q=>q.count===null)&&<p role="alert">Niet alle aantallen konden worden geladen. Onbekende aantallen worden niet als nul getoond.</p>}
 </section>;
}
