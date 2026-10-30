
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import {Suspense} from "react";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import OperationsActionCenter from "../../OperationsActionCenter";
import DailyOperations from "../../DailyOperations";
import FinancialCockpit from "../../FinancialCockpit";
import GroupActionCenter from "../../GroupActionCenter";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function GroupWorkspace(){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 const {db}=await requireEstateAdmin();
 return <>
  <h1 className={styles.cockpitHeading}>{adminT("Cockpit")}</h1>
  <p className={styles.actions}><a href="/admin/workspaces/estates/operations">{adminT("Operations")} · {adminT("Open operational action center →")}</a></p>
  <FinancialCockpit refreshVersion={0}/>
  <GroupActionCenter refreshVersion={0}/>
  <Suspense fallback={<p role="status">{adminT("Loading action list…")}</p>}><OperationsActionCenter db={db}/></Suspense>
  <DailyOperations/>
  <p className={styles.note}>{adminT("The central overview reports recorded and forecast figures separately. Booked rent and scheduled loan interest do not prove cash receipt. Account approvals and administrative settings are available from Relationships and System.")}</p>
 </>;
}
