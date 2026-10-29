import Link from 'next/link';
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {archiveEntities} from '../../../../../lib/accountancy/archive-data';
import {allRows} from '../../../../../lib/property-operations/staff-data';
import {ADMINISTRATION_ROOT,type Year} from '../../../../../lib/accountancy/administration';
import {CreateYearForm} from './Forms';
import s from './administration.module.css';
export const dynamic='force-dynamic';
export default async function Administrations(){const {db}=await requireEstateAdmin(),{t}=await getAdminI18n();
 const [entities,years]=await Promise.all([archiveEntities(db),allRows<Year>((a,b)=>db.from('mzs_accountancy_years').select('*',{count:'exact'}).order('fiscal_year',{ascending:false}).order('id').range(a,b))]);
 return <section className={s.page}><Link href="/admin/workspaces/accountancy">← {t('Accountancy')}</Link><header className={s.heading}><div><h1>{t('Year administrations')}</h1><p>{t('Collect and review income, costs, projects and source documents for each entity and financial year.')}</p></div></header><div className={s.cards}>{years.map(y=><Link key={y.id} href={ADMINISTRATION_ROOT+'/'+y.id} className={s.card}><strong>{entities.find(e=>e.id===y.issuer_id)?.name??y.issuer_id}</strong><span>{y.fiscal_year} · {t(y.purpose==='reference'?'Historical reference':'Current administration')}</span><p>{Object.values(y.checks).filter(Boolean).length}/7 {t('checklist sections reviewed')}</p></Link>)}</div>{!years.length&&<p>{t('No year administrations yet.')}</p>}<CreateYearForm entities={entities}/><p className={s.notice}>{t('The platform prepares internal records and exports for the local accountant. It does not submit tax returns, calculate final tax or maintain a statutory general ledger.')}</p></section>;
}
