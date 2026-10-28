import Link from 'next/link';
import type {createClient} from '../../lib/supabase/server';
import {staffEnvironmentAvailable} from '../../lib/security/property-staff';
import {loadQueueCounts,operationsDay,queueHref} from '../../lib/property-operations/action-queues';
import s from './operations-actions.module.css';

export default async function OperationsActionCenter({db,scope="all"}:{db:Awaited<ReturnType<typeof createClient>>;scope?:"all"|"maintenance"}){
 if(!staffEnvironmentAvailable())return null;
 const today=operationsDay(),counts=(await loadQueueCounts(db,today)).filter(q=>scope==="all"||!["visits","corrections"].includes(q.key));
 return <section className={s.panel} aria-labelledby="operations-actions-heading">
  <p className={s.kicker}>DAILY PROPERTY OPERATIONS</p><h2 id="operations-actions-heading">Staff &amp; maintenance actions</h2>
  <p>Open the action list to follow up on time entries, maintenance and budgets. Planning is assessed as of {today} (Europe/Madrid).</p>
  {scope==="all"&&<p><Link href="/admin/workspaces/estates/time-report" prefetch={false}>Time report by period →</Link></p>}
  <form method="get" className={s.refresh}><button>Refresh</button></form>
  <div className={s.cards}>{counts.map(q=><Link className={s.card} key={q.key} href={queueHref(q.key)} prefetch={false}><strong>{q.count===null?"Unavailable":q.count}</strong><span>{q.label}</span></Link>)}</div>
  {counts.some(q=>q.count===null)&&<p role="alert">Some counts could not be loaded. Unknown counts are not displayed as zero.</p>}
 </section>;
}
