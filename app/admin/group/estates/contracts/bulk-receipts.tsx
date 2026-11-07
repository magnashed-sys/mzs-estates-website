'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {useAdminI18n} from '../../../../../lib/admin/i18n';
import {invoiceBalance} from '../../../../../lib/estates/lease-cashflow';
import {euros} from '../../../../../lib/estates/rent';
import {recordPayment} from './actions';
import type {Issued,Payment} from './billing';
import s from './contracts.module.css';
type Item={invoice:string;key:string;amount:string;number:string};
type Batch={items:Item[];date:string;reference:string};
export default function BulkReceipts({issued,payments,today}:{issued:Issued[];payments:Payment[];today:string}){
 const {t,locale}=useAdminI18n(),router=useRouter();
 const [chosen,setChosen]=useState<string[]>([]),[batch,setBatch]=useState<Batch|null>(null);
 const [busy,start]=useTransition(),[message,setMessage]=useState('');
 const open=issued.filter(i=>invoiceBalance(i,payments)>0);
 const selected=open.filter(i=>chosen.includes(i.id));
 const total=selected.reduce((n,i)=>n+Math.round(invoiceBalance(i,payments)*100),0)/100;
 async function submit(next:Batch){
  setBatch(next);setMessage('');
  let remaining=[...next.items],done=0;
  try{
   for(const item of next.items){
    const r=await recordPayment(item.invoice,item.key,item.amount,next.date,next.reference);
    if(r.error)throw new Error(item.number+': '+r.error);
    remaining=remaining.slice(1);done++;
    setBatch(remaining.length?{...next,items:remaining}:null);
    setChosen(ids=>ids.filter(id=>id!==item.invoice));
   }
   setMessage(t('Payments recorded: {p0}',{p0:done}));
  }catch(error){
   setBatch({...next,items:remaining});
   setMessage(t('Payments recorded: {p0}',{p0:done})+' · '+(error instanceof Error?error.message:t('The result could not be confirmed. Refresh before retrying.')));
  }finally{router.refresh();}
 }
 if(!open.length&&!batch)return null;
 return <details className={s.panel}><summary>{t('Record multiple payments')}</summary>
 <p>{t('Select invoices to settle their outstanding balances in full. Enter the receipt date and bank reference from your bank statement. No money is transferred.')}</p>
 <form onSubmit={e=>{e.preventDefault();if(batch){start(()=>submit(batch));return;}const f=new FormData(e.currentTarget);
 const next={items:selected.map(i=>({invoice:i.id,key:crypto.randomUUID(),number:i.number,amount:invoiceBalance(i,payments).toFixed(2)})),date:String(f.get('date')),reference:String(f.get('reference'))};
 if(next.items.length&&window.confirm(t('Record {p0} payments totalling {p1}?',{p0:next.items.length,p1:euros(total,locale)})))start(()=>submit(next));
 }}>
 <fieldset disabled={busy||!!batch}>
 <button type="button" className={s.secondary} onClick={()=>setChosen(open.map(i=>i.id))}>{t('Select all visible outstanding invoices')}</button>
 <button type="button" className={s.secondary} onClick={()=>setChosen([])}>{t('Clear selection')}</button>
 {open.map(i=><label className={s.check} key={i.id}><input type="checkbox" checked={chosen.includes(i.id)} onChange={e=>setChosen(ids=>e.target.checked?[...ids,i.id]:ids.filter(id=>id!==i.id))}/>{i.number} · {i.payload.snapshot.tenant_name} · {euros(invoiceBalance(i,payments),locale)}</label>)}
 <p>{t('Selected: {p0} · Total: {p1}',{p0:selected.length,p1:euros(total,locale)})}</p>
 <div className={s.grid}><label className={s.field}>{t('Received on')}<input name="date" type="date" required max={today} defaultValue={today}/></label><label className={s.field}>{t('Bank reference')}<input name="reference" required maxLength={500}/></label></div>
 </fieldset>
 {batch&&<p>{t('Unconfirmed payments: {p0}. Retry uses the same payment identifiers to prevent duplicate entries.',{p0:batch.items.length})}</p>}
 <button className={s.button} disabled={busy||(!batch&&!selected.length)}>{t(batch?'Retry remaining payments':'Record selected payments')}</button>
 </form>{message&&<p role="status">{message}</p>}</details>;
}
