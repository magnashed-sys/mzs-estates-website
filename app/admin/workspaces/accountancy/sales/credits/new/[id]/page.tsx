import Link from 'next/link';import {notFound} from 'next/navigation';import {randomUUID} from 'node:crypto';
import {requireEstateAdmin} from '../../../../../../../../lib/security/estate-properties';
import {allRows} from '../../../../../../../../lib/property-operations/staff-data';
import {euroCents} from '../../../../../../../../lib/property-operations/sales-reconciliation';
import {CreditForm} from '../../Forms';import s from '../../../sales.module.css';
export const dynamic='force-dynamic';
export default async function NewCredit({params}:{params:Promise<{id:string}>}){
 const {db}=await requireEstateAdmin(),{id}=await params;if(!/^[a-f0-9-]{36}$/i.test(id))notFound();
 const {data:i,error}=await db.from('mzs_service_invoices').select('*').eq('id',id).maybeSingle();if(error)throw Error('Invoice unavailable');if(!i)notFound();
 const credits=await allRows<{id:string;lines:{index:number;net_cents:number}[]}>((a,b)=>db.from('mzs_service_credit_notes').select('id,lines',{count:'exact'}).eq('invoice_id',id).order('id').range(a,b));
 const drafts=await allRows<{id:string;preview:{reason:string}}> ((a,b)=>db.from('mzs_service_credit_drafts').select('id,preview',{count:'exact'}).eq('invoice_id',id).order('id').range(a,b));
 const lines=i.payload.lines.map((l:{description:string;net:number},index:number)=>({description:l.description,remaining:euroCents(l.net)-credits.reduce((a,c)=>a+c.lines.filter(l=>l.index===index).reduce((n,l)=>n+l.net_cents,0),0)}));
 return <section className={s.page}><Link href={'/admin/workspaces/accountancy/sales/issued/'+id}>← Original invoice</Link><header className={s.heading}><div><h1>Create credit note</h1><p>{i.number} · {i.payload.snapshot.tenant_name}</p></div></header><p>Credit the original invoice in full or enter a partial net amount per line. Issued credits cannot be edited or deleted. No email or bank refund is created.</p><CreditForm invoiceId={id} requestId={randomUUID()} lines={lines}/><h2>Unissued previews</h2>{drafts.filter(d=>!credits.some(c=>c.id===d.id)).map(d=><p key={d.id}><Link href={'/admin/workspaces/accountancy/sales/credits/drafts/'+d.id}>{d.preview.reason} →</Link></p>)}</section>;
}
