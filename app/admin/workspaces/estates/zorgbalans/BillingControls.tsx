'use client';
import {useActionState} from 'react';
import {prepareZorgbalansInvoice,confirmZorgbalansInvoice} from './actions';
import s from './zorgbalans.module.css';
type Result={status:'idle'|'success'|'error';message:string};
const initial:Result={status:'idle',message:''};
export type Visit={id:string;worked_on:string;profile_id:string;effective_minutes:number;
 description:string;invoiced_hours:number;net_cents:number};
export type Invoice={id:string;invoice_number:string;issued_on:string;due_on:string;period_from:string;
 period_until:string;hours:number;net_cents:number;vat_cents:number;gross_cents:number;status:string;
 confirmation_note:string|null};
export function DraftForm({visits,people,today}:{visits:Visit[];people:{id:string;full_name:string|null}[];today:string}){
 const [result,action,pending]=useActionState(prepareZorgbalansInvoice,initial);
 const euro=(c:number)=>(c/100).toLocaleString('nl-NL',{style:'currency',currency:'EUR'});
 return <form className={s.card} action={action}>
  <h2>Nieuwe privé-conceptfactuur</h2>
  <p>Selecteer alleen gecontroleerde, goedgekeurde bezoeken. Per bezoek wordt minimaal één uur en vervolgens naar boven op hele uren afgerond. Tarief €25 per uur, 21% btw.</p>
  {visits.length?<div className={s.tableWrap}><table><thead><tr><th>Opnemen</th><th>Datum</th><th>Medewerker</th><th>Werkelijk</th><th>Factuururen</th><th>Excl. btw</th></tr></thead><tbody>
  {visits.map(v=><tr key={v.id}><td><label className={s.check}><input type="checkbox" name="visit_id" value={v.id} defaultChecked/></label></td>
   <td>{v.worked_on}</td><td>{people.find(p=>p.id===v.profile_id)?.full_name??'Medewerker'}</td>
   <td>{v.effective_minutes} min</td><td>{v.invoiced_hours} u</td><td>{euro(v.net_cents)}</td></tr>)}
  </tbody></table></div>:<p>Er zijn momenteel geen goedgekeurde Zorgbalans-uren die op een nieuwe factuur kunnen worden opgenomen.</p>}
  <div className={s.fields}><label>Privéfactuurnummer<input required name="invoice_number" pattern="[0-9]{3,16}" placeholder="Bijvoorbeeld 7114"/></label>
   <label>Factuurdatum<input type="date" name="issued_on" required defaultValue={today}/></label></div>
  <p>Afzender: <strong>Magdy Nashed (privé)</strong> · Ontvanger: Stichting Zorgbalans · Kostenplaats 652001 Prettig Thuis IJmuiden.</p>
  <button disabled={pending||!visits.length} type="submit">{pending?'Controleren…':'Conceptfactuur aanmaken'}</button>
  {result.message&&<p className={result.status==='error'?s.error:s.success} role="status">{result.message}</p>}
  <p className={s.muted}>Er wordt geen factuur gemaild. Controleer het PDF-concept en verstuur het zelf. De bestaande factuur 7113 wordt niet opnieuw berekend.</p>
 </form>;
}
export function ConfirmSent({invoice}:{invoice:Invoice}){
 const [result,action,pending]=useActionState(confirmZorgbalansInvoice,initial);
 return <form action={action} className={s.confirm}>
  <input type="hidden" name="invoice_id" value={invoice.id}/>
  <label>Verzendbewijs / administratieve referentie<input name="confirmation_note" required minLength={8} maxLength={500} placeholder="Bijvoorbeeld per e-mail verzonden op 30-10-2026"/></label>
  <button type="submit" disabled={pending}>{pending?'Registreren…':'Bevestig externe verzending'}</button>
  {result.message&&<p role="status" className={result.status==='error'?s.error:s.success}>{result.message}</p>}
 </form>;
}
