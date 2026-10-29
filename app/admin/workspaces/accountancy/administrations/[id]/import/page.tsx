import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../../../../../lib/admin/i18n-server';
import {allRows} from '../../../../../../../lib/property-operations/staff-data';
import {ADMINISTRATION_ROOT,uuid} from '../../../../../../../lib/accountancy/administration';
import type {Reference,ImportContext} from '../../../../../../../lib/accountancy/import-preview';
import ImportPreview from './ImportPreview';
import s from '../../administration.module.css';
export const dynamic='force-dynamic';
export default async function ImportPage({params}:{params:Promise<{id:string}>}){
 const {db}=await requireEstateAdmin(),{t}=await getAdminI18n(),{id}=await params;if(!uuid.test(id))notFound();
 const {data:year,error}=await db.from('mzs_accountancy_years').select('issuer_id,fiscal_year,purpose').eq('id',id).maybeSingle();
 if(error)throw Error('Administration unavailable');if(!year)notFound();
 const {data:entity,error:entityError}=await db.from('mzs_lease_issuers').select('id,name,tax_id').eq('id',year.issuer_id).single();
 if(entityError||!entity)throw Error('Entity unavailable');
 const [suppliers,properties,existing]=await Promise.all([
  allRows<Reference>((a,b)=>db.from('mzs_lease_relationships').select('id,name',{count:'exact'}).order('id').range(a,b)),
  allRows<Reference>((a,b)=>db.from('mzs_estate_properties').select('id,name',{count:'exact'}).order('id').range(a,b)),
  allRows<ImportContext['existing'][number]>((a,b)=>db.from('mzs_ops_expense_drafts').select('supplier_relationship_id,supplier_invoice_number',{count:'exact'}).eq('legal_entity_id',year.issuer_id).order('id').range(a,b))
 ]);
 return <section className={s.page}><Link href={ADMINISTRATION_ROOT+'/'+id}>← {t('Year administrations')}</Link><header className={s.heading}><div><h1>{t('Prepare a cost import')}</h1><p>{entity.name} · {year.fiscal_year}</p></div></header><ImportPreview context={{year:year.fiscal_year,entity,suppliers,properties,existing}}/></section>;
}
