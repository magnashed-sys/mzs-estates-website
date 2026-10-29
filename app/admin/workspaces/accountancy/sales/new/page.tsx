
import {getAdminI18n} from '../../../../../../lib/admin/i18n-server';
import Link from 'next/link';import {randomUUID} from 'node:crypto';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {allRows} from '../../../../../../lib/property-operations/staff-data';
import {readRegister} from '../../../../../../lib/estates/read-register';
import {operationsDay} from '../../../../../../lib/property-operations/action-queues';
import {DraftForm} from './Forms';import s from '../sales.module.css';
export const dynamic='force-dynamic';
export default async function NewInvoice(){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();
const {db}=await requireEstateAdmin();const [issuers,customers,drafts,issued,cancelled]=await Promise.all([readRegister(db,'mzs_lease_issuers'),readRegister(db,'mzs_lease_relationships'),readRegister(db,'mzs_service_invoice_drafts'),readRegister(db,'mzs_service_invoices'),allRows<{draft_id:string}>((a,b)=>db.from('mzs_service_draft_cancellations').select('draft_id',{count:'exact'}).order('draft_id').range(a,b) as unknown as PromiseLike<{data:{draft_id:string}[]|null;error:unknown;count:number|null}>)]);const closed=new Set([...issued.map(i=>i.draft_id),...cancelled.map(i=>i.draft_id)]);return <section className={s.page}><Link href="/admin/workspaces/accountancy/sales">{adminT("← Invoices")}</Link><h1>{adminT("Create standalone invoice")}</h1><DraftForm issuers={issuers.map(i=>({id:i.id,name:i.name}))} customers={customers.map(c=>({id:c.id,name:c.name,address:c.address}))} requestId={randomUUID()} today={operationsDay()}/><h2>{adminT("Drafts awaiting review")}</h2>{drafts.filter(d=>!closed.has(d.id)).map(d=><p key={d.id}><Link href={'/admin/workspaces/accountancy/sales/drafts/'+d.id}>{d.payload.subject} · {d.payload.snapshot.tenant_name} · €{(d.gross_cents/100).toFixed(2)}</Link></p>)}</section>;}
