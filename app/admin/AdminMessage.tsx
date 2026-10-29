import {useAdminI18n} from '../../lib/admin/i18n';
/** For module-level loading fallbacks that cannot call a hook themselves. */
export default function AdminMessage({text}:{text:string}){const {t}=useAdminI18n();return t(text);}
