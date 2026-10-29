'use client';
import {useAdminI18n} from '../../../../../lib/admin/i18n';

export default function TimeReportError({reset}:{reset:()=>void}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 return <section role="alert"><h2>{adminT("Time report unavailable")}</h2><p>{adminT("The source data could not be fully loaded. Retry or choose a shorter period, one property or one staff member. No incomplete totals are shown.")}</p><button onClick={reset}>{adminT("Reload")}</button><p><a href="/admin/workspaces/estates/time-report">{adminT("Back to the current month")}</a></p></section>;
}
