'use client';
import {useAdminI18n} from '../../../../../lib/admin/i18n';

export default function ReportError({reset}:{reset:()=>void}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();
return <section><h1>{adminT("The complete report could not be loaded")}</h1><p>{adminT("No incomplete totals are shown. Refresh the selection and retry.")}</p><button onClick={reset}>{adminT("Reload")}</button></section>;}
