import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../../../../../lib/admin/i18n-server';
import {ADMINISTRATION_ROOT,uuid} from '../../../../../../../lib/accountancy/administration';
import {bankSource} from '../../../../../../../lib/accountancy/bank/data';
import BankWorkspace from './Workspace';
import s from '../../administration.module.css';
export const dynamic='force-dynamic';
export default async function BankPage({params}:{params:Promise<{id:string}>}){
 const {db}=await requireEstateAdmin(),{language}=await getAdminI18n(),{id}=await params;if(!uuid.test(id))notFound();
 const source=await bankSource(db,id);const {data:entity,error}=await db.from('mzs_lease_issuers').select('name').eq('id',source.issuer_id).single();if(error||!entity)throw Error('Entity unavailable');
 return <section className={s.page}><Link href={ADMINISTRATION_ROOT+'/'+id}>← {language==='es'?'Administración anual':'Year administration'}</Link><header className={s.heading}><div><h1>{language==='es'?'Bancos y cuenta corriente':'Bank & current account'}</h1><p>{entity.name} · {source.year} · EUR</p></div></header><BankWorkspace yearId={id} source={source} language={language}/></section>;
}
