import {useLocale} from 'next-intl';
import {adminI18n} from './translation';
export function useAdminI18n(){return adminI18n(useLocale());}
