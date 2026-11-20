import Link from 'next/link';
import {requireContractAdmin} from '../../../../../lib/security/estate-contracts';
import {allRows} from '../../../../../lib/property-operations/staff-data';
import s from '../../../FinancialCockpit.module.css';

type Detail={contract_id:string;month_start:string;invoiced:number;scheduled_amount:number};
const euros=new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'});
const cents=(value:number)=>Math.round(Number(value)*100);
export default async function RentOutlook(){
 const {db}=await requireContractAdmin();
 const [rows,contracts]=await Promise.all([
  allRows<Detail>((from,to)=>db.rpc('mzs_cockpit_contract_rent_rows',{p_year:2027},{count:'exact'}).order('month_start').order('contract_id').range(from,to)),
  allRows<{id:string;tenant_name:string;title:string}>((from,to)=>db.from('mzs_lease_contracts').select('id,title,tenant_name',{count:'exact'}).order('id').range(from,to))
 ]);
 const byId=new Map(contracts.map(c=>[c.id,c]));
 const months=Array.from({length:12},(_,i)=>'2027-'+String(i+1).padStart(2,'0')+'-01');
 const total=(items:Detail[],key:'invoiced'|'scheduled_amount')=>items.reduce((n,r)=>n+cents(r[key]),0);
 return <section className={s.cockpit}><Link href="/admin/workspaces/group">Terug naar cockpit</Link><h1>Huurinkomsten 2027</h1>
 <p>Jaarbedrag <strong>{euros.format((total(rows,'invoiced')+total(rows,'scheduled_amount'))/100)}</strong> · inclusief voorschotten en btw</p>
 {months.map(month=>{const items=rows.filter(r=>r.month_start===month);const billed=total(items,'invoiced'),planned=total(items,'scheduled_amount');
 return <details key={month}><summary>{new Intl.DateTimeFormat('nl-NL',{month:'long',timeZone:'UTC'}).format(new Date(month))} · {euros.format((billed+planned)/100)}</summary>
 <div className={s.tableScroll}><table className={s.reportTable}><thead><tr><th>Huurder / contract</th><th>Gefactureerd</th><th>Nog te factureren</th></tr></thead>
 <tbody>{items.map(r=>{const c=byId.get(r.contract_id);return <tr key={r.contract_id}><td><Link href={'/admin/group/estates/contracts?contract='+r.contract_id}>{c?.tenant_name} · {c?.title}</Link></td><td>{euros.format(r.invoiced)}</td><td>{euros.format(r.scheduled_amount)}</td></tr>})}</tbody>
 <tfoot><tr><th>Maandtotaal</th><td>{euros.format(billed/100)}</td><td>{euros.format(planned/100)}</td></tr></tfoot></table></div></details>})}</section>;
}
