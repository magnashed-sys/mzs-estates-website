
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
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
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 requireStaffEnvironment();const {db}=await requireEstateAdmin();const params=await searchParams;
 const key=queueKey(one(params.queue)??'overdue');
 if(!key)return <main><h1>{adminT("Unknown action list")}</h1><Link href={queueHref('overdue')}>{adminT("Open the action list")}</Link></main>;
 const today=operationsDay(),requestedPage=pageNumber(one(params.page));
 const result=await loadQueuePage(db,key,requestedPage,today),queue=queues.find(q=>q.key===key)!;
 if(result.page!==requestedPage)redirect(queueHref(key,result.page));
 return <main className={s.adminPage}>
  <Link href="/admin/workspaces/estates">{adminT("← Property operations")}</Link><h1>{adminT("Property operations action list")}</h1>
  <p className={a.notice}>{adminT("As of")} {today}  {adminT("(Europe/Madrid). Use Refresh to retrieve the latest status.")}</p>
  <form method="get" className={a.refresh}><input type="hidden" name="queue" value={key}/><input type="hidden" name="page" value={result.page}/><button>{adminT("Refresh")}</button></form>
  <nav className={a.tabs} aria-label={adminT("Soort actie")}>{queues.map(q=><Link href={queueHref(q.key)} key={q.key} aria-current={q.key===key?'page':undefined} prefetch={false}>{adminT(q.label)}</Link>)}</nav>
  <section className={s.panel}><h2>{adminT(queue.label)} · {result.total}</h2><p>{adminT(queue.description)}</p>
   {key==='budgets'&&<p>{adminT("An internal budget is not an incurred or paid expense. Review the work order in the maintenance dossier.")}</p>}
   {!result.total?<p>{adminT("No open actions in this list.")}</p>:<div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Property / action")}</th><th>{key==='budgets'?adminT("Created"):key==='visits'||key==='corrections'?adminT("Work date"):adminT("Planning")}</th>{key!=='budgets'&&<th>{key==='visits'||key==='corrections'?adminT("Staff member"):adminT("Assignee")}</th>}<th>{adminT("Dossier")}</th></tr></thead><tbody>{result.items.map(item=><tr key={item.id}><td><strong>{item.property}</strong><br/>{key==='visits'||key==='corrections'?adminT(item.title):item.title}{item.urgent&&<span className={a.urgent}>{adminT("Urgent")}</span>}{item.detail&&<p className={a.detail}>{item.detail}</p>}</td><td>{item.date}</td>{key!=='budgets'&&<td>{item.person}</td>}<td><Link href={item.href} prefetch={false}>{adminT("Open dossier →")}</Link></td></tr>)}</tbody></table></div>}
   <nav className={s.pagination} aria-label={adminT("Actiepagina’s")}>{result.page>1&&<Link href={queueHref(key,result.page-1)} prefetch={false}>{adminT("← Previous")}</Link>}<span>{adminT("Page")} {result.page}  {adminT("of")} {result.pages} · {result.total}  {adminT("actions")}</span>{result.page<result.pages&&<Link href={queueHref(key,result.page+1)} prefetch={false}>{adminT("Next →")}</Link>}</nav>
  </section>
 </main>;
}
