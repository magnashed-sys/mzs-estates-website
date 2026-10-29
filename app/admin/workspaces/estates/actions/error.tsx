'use client';
import {useAdminI18n} from '../../../../../lib/admin/i18n';

export default function ActionsError({reset}:{reset:()=>void}){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 return <section role="alert"><h2>{adminT("Action list unavailable")}</h2><p>{adminT("The complete data could not be loaded. Please retry; an empty or partial overview will not be presented as a complete result.")}</p><button onClick={reset}>{adminT("Reload")}</button></section>;
}
