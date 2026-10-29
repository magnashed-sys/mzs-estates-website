'use client';
import {useAdminI18n} from '../../lib/admin/i18n';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {euros} from '../../lib/estates/rent';
type Summary={draftContracts:number;activeSchedules:number;toReview:number;endingSoon:number;received:number;outstanding:number;overdue:number;forecast:{month:string;total:number}[]};
export default function RentalSummary(){
 const {t:adminT,locale:adminLocale}=useAdminI18n();

 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState(false);
 useEffect(()=>{const ctrl=new AbortController();fetch('/api/admin/rental-summary',{signal:ctrl.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();return r.json()}).then(setData).catch(()=>{if(!ctrl.signal.aborted)setError(true)});return()=>ctrl.abort();},[]);
 return <section className="admin-panel"><h3 className="admin-subtitle">{adminT("Rental administration & cashflow")}</h3>{error?<p role="alert">{adminT("Rental totals could not be loaded. Open the register to verify.")}</p>:!data?<p>{adminT("Loading rental summary…")}</p>:<><p>{data.activeSchedules}  {adminT("active schedules ·")} {data.draftContracts}  {adminT("draft contracts ·")} {data.toReview}  {adminT("concepts awaiting issue ·")} {data.endingSoon}  {adminT("agreements ending within 90 days")}</p><p>{adminT("Outstanding:")} {euros(data.outstanding, adminLocale)}  {adminT("· Overdue:")} {euros(data.overdue, adminLocale)}  {adminT("· Recorded receipts:")} {euros(data.received, adminLocale)}</p><p className="admin-help">{adminT("Expected billing from active schedules (estimate including VAT; not received cash):")} {data.forecast.map(f=>`${f.month}: ${euros(f.total, adminLocale)}`).join(' · ')}</p></>}<Link className="admin-button" href="/admin/group/estates/contracts?view=billing">{adminT("Open invoices & cashflow →")}</Link></section>;
}
