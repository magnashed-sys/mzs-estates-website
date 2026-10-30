import Link from 'next/link';
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import {Suspense} from "react";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import OperationsActionCenter from "../../OperationsActionCenter";
import DailyOperations from "../../DailyOperations";
import FinancialCockpit from "../../FinancialCockpit";
import GroupActionCenter from "../../GroupActionCenter";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function GroupWorkspace({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {t:adminT,language}=await getAdminI18n();
 const {db}=await requireEstateAdmin();
 const q=await searchParams,view=q.view==='actions'||q.view==='planning'?q.view:'finance',tr=(en:string,es:string)=>language==='es'?es:en;
 return <>
  <h1 className={styles.cockpitHeading}>{adminT("Cockpit")}</h1>
  <nav className={styles.cockpitTabs} aria-label={tr('Cockpit sections','Secciones del panel')}>
   {([['finance','Financial overview','Resumen financiero'],['actions','Requests & tasks','Solicitudes y tareas'],['planning','Arrivals & planning','Llegadas y planificación']] as const).map(([key,en,es])=><Link key={key} href={'/admin/workspaces/group?view='+key} prefetch={false} aria-current={view===key?'page':undefined}>{tr(en,es)}</Link>)}
  </nav>
  {view==='finance'&&<FinancialCockpit refreshVersion={0}/>}
  {view==='actions'&&<><GroupActionCenter refreshVersion={0}/><Suspense fallback={<p role="status">{adminT("Loading action list…")}</p>}><OperationsActionCenter db={db} cockpitView="actions"/></Suspense></>}
  {view==='planning'&&<DailyOperations/>}
  <p className={styles.note}>{adminT("The central overview reports recorded and forecast figures separately. Booked rent and scheduled loan interest do not prove cash receipt. Account approvals and administrative settings are available from Relationships and System.")}</p>
 </>;
}
