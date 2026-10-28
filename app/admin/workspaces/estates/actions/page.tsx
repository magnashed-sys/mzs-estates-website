import Link from 'next/link';
import {redirect} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {loadQueuePage,operationsDay,queues,queueKey,queueHref} from '../../../../../lib/property-operations/action-queues';
import {one,type Params} from '../../../../../lib/property-operations/staff-data';
import {pageNumber} from '../../../../../lib/property-operations/staff-work';
import s from '../../../../staff/staff.module.css';
import a from '../../../operations-actions.module.css';
export const dynamic='force-dynamic';

export default async function OperationsActions({searchParams}:{searchParams:Promise<Params>}){
 requireStaffEnvironment();const {db}=await requireEstateAdmin();const params=await searchParams;
 const key=queueKey(one(params.queue)??'overdue');
 if(!key)return <main><h1>Onbekende actielijst</h1><Link href={queueHref('overdue')}>Open de actielijst</Link></main>;
 const today=operationsDay(),requestedPage=pageNumber(one(params.page));
 const result=await loadQueuePage(db,key,requestedPage,today),queue=queues.find(q=>q.key===key)!;
 if(result.page!==requestedPage)redirect(queueHref(key,result.page));
 return <main className={s.adminPage}>
  <Link href="/admin/workspaces/estates">← Vastgoedbeheer</Link><h1>Actielijst vastgoedbeheer</h1>
  <p className={a.notice}>Peildatum {today} (Europe/Madrid). Gebruik Vernieuwen om de actuele stand op te halen.</p>
  <form method="get" className={a.refresh}><input type="hidden" name="queue" value={key}/><input type="hidden" name="page" value={result.page}/><button>Vernieuwen</button></form>
  <nav className={a.tabs} aria-label="Soort actie">{queues.map(q=><Link href={queueHref(q.key)} key={q.key} aria-current={q.key===key?'page':undefined} prefetch={false}>{q.label}</Link>)}</nav>
  <section className={s.panel}><h2>{queue.label} · {result.total}</h2><p>{queue.description}</p>
   {key==='budgets'&&<p>Een intern budget is geen gemaakte of betaalde kostenpost. Beoordeel de werkopdracht in het onderhoudsdossier.</p>}
   {!result.total?<p>Geen open acties in deze lijst.</p>:<div className={s.tableWrap}><table className={s.table}><thead><tr><th>Object / actie</th><th>{key==='budgets'?'Aangemaakt':key==='visits'||key==='corrections'?'Werkdatum':'Planning'}</th>{key!=='budgets'&&<th>{key==='visits'||key==='corrections'?'Medewerker':'Verantwoordelijke'}</th>}<th>Dossier</th></tr></thead><tbody>{result.items.map(item=><tr key={item.id}><td><strong>{item.property}</strong><br/>{item.title}{item.urgent&&<span className={a.urgent}>Dringend</span>}{item.detail&&<p className={a.detail}>{item.detail}</p>}</td><td>{item.date}</td>{key!=='budgets'&&<td>{item.person}</td>}<td><Link href={item.href} prefetch={false}>Open dossier →</Link></td></tr>)}</tbody></table></div>}
   <nav className={s.pagination} aria-label="Actiepagina’s">{result.page>1&&<Link href={queueHref(key,result.page-1)} prefetch={false}>← Vorige</Link>}<span>Pagina {result.page} van {result.pages} · {result.total} acties</span>{result.page<result.pages&&<Link href={queueHref(key,result.page+1)} prefetch={false}>Volgende →</Link>}</nav>
  </section>
 </main>;
}
