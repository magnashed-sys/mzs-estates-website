'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {euros} from '../../lib/estates/rent';
type Summary={draftContracts:number;activeSchedules:number;toReview:number;endingSoon:number;received:number;outstanding:number;overdue:number;forecast:{month:string;total:number}[]};
export default function RentalSummary(){
 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState(false);
 useEffect(()=>{const ctrl=new AbortController();fetch('/api/admin/rental-summary',{signal:ctrl.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();return r.json()}).then(setData).catch(()=>{if(!ctrl.signal.aborted)setError(true)});return()=>ctrl.abort();},[]);
 return <section className="admin-panel"><h3 className="admin-subtitle">Rental administration &amp; cashflow</h3>{error?<p role="alert">Rental totals could not be loaded. Open the register to verify.</p>:!data?<p>Loading rental summary…</p>:<><p>{data.activeSchedules} active schedules · {data.draftContracts} draft contracts · {data.toReview} concepts awaiting issue · {data.endingSoon} agreements ending within 90 days</p><p>Outstanding: {euros(data.outstanding)} · Overdue: {euros(data.overdue)} · Recorded receipts: {euros(data.received)}</p><p className="admin-help">Expected billing from active schedules (estimate including VAT; not received cash): {data.forecast.map(f=>`${f.month}: ${euros(f.total)}`).join(' · ')}</p></>}<Link className="admin-button" href="/admin/group/estates/contracts?view=billing">Open invoices &amp; cashflow →</Link></section>;
}
