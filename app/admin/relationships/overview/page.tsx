import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {requireEstateAdmin} from '../../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import {overviewTarget} from '../../../../lib/relationships/overview';
import {loadRelationshipOverview} from '../../../../lib/relationships/overview-data';
import RelationshipOverview from './RelationshipOverview';
import s from '../../workspaces/accountancy/administrations/administration.module.css';
export const dynamic='force-dynamic';
export default async function Overview({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {db}=await requireEstateAdmin();
 const target=overviewTarget(await searchParams);if(!target)notFound();
 const {language}=await getAdminI18n(),l=(en:string,es:string)=>language==='es'?es:en;
 let data:Awaited<ReturnType<typeof loadRelationshipOverview>>;
 try{data=await loadRelationshipOverview(db,target);}catch{return <main className={s.page}><Link href="/admin/relationships">← {l('Relationships','Relaciones')}</Link><h1>Relationship 360°</h1><p role="alert">{l('The relationship identity could not be verified. Refresh to retry; no overview is available.','No se pudo verificar la identidad de la relación. Actualice para reintentar; no hay resumen disponible.')}</p></main>;}
 if(!data)notFound();if('redirect' in data)redirect(data.redirect);
 return <main className={s.page}>
 <Link href="/admin/relationships">← {l('Relationships','Relaciones')}</Link>
 <header className={s.heading}><div><p>Relationship 360°</p><h1>{data.name}</h1><p>{data.email}</p>{data.profile&&<span className={s.badge}>{data.profile.is_active?l('Active account','Cuenta activa'):l('Inactive account','Cuenta inactiva')}</span>}</div><div className={s.links}>
 {data.profile?<Link className={s.button} href={'/admin/relationships/'+data.profile.id}>{l('Account & contact details','Cuenta y datos de contacto')}</Link>:<Link className={s.button} href={'/admin/relationships?edit='+data.selected!.id}>{l('Edit CRM details','Editar datos CRM')}</Link>}
 {data.selected?.profile_id&&<Link href={'/admin/relationships/overview?profile='+data.selected.profile_id}>{l('Linked contact account →','Cuenta de contacto vinculada →')}</Link>}
 </div></header>
 <p className={s.notice}>{data.profile?l('Account overview, including CRM records explicitly linked to this account. A company contact link is not proof of ownership.','Resumen de cuenta, incluidos los registros CRM vinculados explícitamente. Un vínculo de contacto empresarial no acredita propiedad.'):l('This overview is limited to this CRM record. Financial records of its contact account or other companies are not included.','Este resumen se limita a este registro CRM. No incluye datos financieros de su cuenta de contacto ni de otras empresas.')}</p>
 <RelationshipOverview sections={data.sections} language={language}/>
 <p className={s.notice}>{l('Only recorded links are shown; names and email addresses are not used to infer matches. Missing links are not proof that no relationship exists. Contract PDFs remain available inside the contract dossier. Amounts and current payment balances are shown in the original invoice or loan dossier. Permissions and records are unchanged.','Solo se muestran vínculos registrados; no se deducen coincidencias por nombre o correo. La falta de vínculos no demuestra que no exista relación. Los PDF contractuales siguen en el expediente del contrato. Los importes y saldos actuales se consultan en la factura o préstamo original. No se modifican permisos ni registros.')}</p>
 </main>;
}
