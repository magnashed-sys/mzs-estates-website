'use client';
import {useActionState,useState} from 'react';
import {prepareZorgbalansInvoice,confirmZorgbalansInvoice} from './actions';
import {billingSelection,billingVisits,MAX_BILLING_VISITS,type BillableVisit} from '../../../../../lib/property-operations/zorgbalans-billing';
import s from './zorgbalans.module.css';
type Result={status:'idle'|'success'|'error';message:string};
const initial:Result={status:'idle',message:''};
export type Visit=BillableVisit;
export type Invoice={id:string;invoice_number:string;issued_on:string;due_on:string;period_from:string;
 period_until:string;hours:number;net_cents:number;vat_cents:number;gross_cents:number;status:string;
 confirmation_note:string|null};
export function DraftForm({visits,people,today,language}:{visits:Visit[];people:{id:string;full_name:string|null}[];today:string;language:'en'|'es'}){
 const [result,action,pending]=useActionState(prepareZorgbalansInvoice,initial);
 const [ids,setIds]=useState<string[]>([]),[from,setFrom]=useState(''),[until,setUntil]=useState(''),[profile,setProfile]=useState('');
 const tr=(en:string,es:string)=>language==='es'?es:en;
 const euro=(c:number)=>(c/100).toLocaleString(language==='es'?'es-ES':'en-GB',{style:'currency',currency:'EUR'});
 const visible=billingVisits(visits,from,until,profile),selected=billingSelection(visible,ids);
 const chosen=new Set(selected.rows.map(v=>v.id)),names=new Map(people.map(p=>[p.id,p.full_name]));
 const invalidPeriod=Boolean(from&&until&&from>until);
 return <form className={s.card} action={action}>
  <h2>{tr('New private invoice draft','Nuevo borrador de factura privada')}</h2>
  <p>{tr('Select the approved visits to include. Each visit is rounded up to whole hours, with a minimum of one hour. Rate: €25 per hour, 21% VAT.','Seleccione las visitas aprobadas que desea incluir. Cada visita se redondea al alza a horas completas, con un mínimo de una hora. Tarifa: 25 € por hora, IVA del 21 %.')}</p>
  <fieldset disabled={pending} className={s.selectionFields}>
   <div className={s.fields}>
    <label>{tr('Work date from','Fecha de trabajo desde')}<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setIds([]);}}/></label>
    <label>{tr('Work date through','Fecha de trabajo hasta')}<input type="date" value={until} onChange={e=>{setUntil(e.target.value);setIds([]);}}/></label>
    <label>{tr('Staff member','Empleado')}<select value={profile} onChange={e=>{setProfile(e.target.value);setIds([]);}}><option value="">{tr('All staff','Todos los empleados')}</option>{people.filter(p=>visits.some(v=>v.profile_id===p.id)).map(p=><option key={p.id} value={p.id}>{p.full_name??tr('Staff member','Empleado')}</option>)}</select></label>
   </div>
   {invalidPeriod&&<p className={s.error} role="alert">{tr('The end date must be on or after the start date.','La fecha final debe ser igual o posterior a la inicial.')}</p>}
   <div className={s.selectionActions}><button type="button" disabled={!visible.length||invalidPeriod} onClick={()=>setIds(visible.slice(0,MAX_BILLING_VISITS).map(v=>v.id))}>{visible.length>MAX_BILLING_VISITS?tr('Select first 100 shown','Seleccionar las primeras 100'):tr('Select all shown','Seleccionar todas las visibles')}</button><button type="button" disabled={!selected.count} onClick={()=>setIds([])}>{tr('Clear selection','Borrar selección')}</button></div>
   <p className={s.muted}>{tr('Up to 100 visits per draft. Changing a filter clears the selection.','Hasta 100 visitas por borrador. Cambiar un filtro borra la selección.')}</p>
   {visible.length?<div className={s.tableWrap}><table><thead><tr><th>{tr('Include','Incluir')}</th><th>{tr('Date / work','Fecha / trabajo')}</th><th>{tr('Staff member','Empleado')}</th><th>{tr('Approved time','Tiempo aprobado')}</th><th>{tr('Invoice hours','Horas facturadas')}</th><th>{tr('Excl. VAT','Sin IVA')}</th></tr></thead><tbody>
   {visible.map(v=><tr key={v.id}>
    <td data-label={tr('Include','Incluir')}><label className={s.check}><input type="checkbox" name="visit_id" value={v.id} checked={chosen.has(v.id)} disabled={!chosen.has(v.id)&&selected.count>=MAX_BILLING_VISITS} aria-label={tr('Include visit','Incluir visita')+' '+v.worked_on+' · '+(names.get(v.profile_id)??tr('Staff member','Empleado'))+' · '+v.description} onChange={e=>setIds(e.target.checked?[...chosen,v.id]:[...chosen].filter(id=>id!==v.id))}/></label></td>
    <td data-label={tr('Date / work','Fecha / trabajo')}><strong>{v.worked_on}</strong><p className={s.description}>{v.description}</p></td><td data-label={tr('Staff member','Empleado')}>{names.get(v.profile_id)??tr('Staff member','Empleado')}</td>
    <td data-label={tr('Approved time','Tiempo aprobado')}>{v.effective_minutes} min</td><td data-label={tr('Invoice hours','Horas facturadas')}>{v.invoiced_hours} h</td><td data-label={tr('Excl. VAT','Sin IVA')}>{euro(v.net_cents)}</td></tr>)}
   </tbody></table></div>:<p>{tr('No approved, uninvoiced visits match these filters.','Ninguna visita aprobada y sin facturar coincide con estos filtros.')}</p>}
   <section className={s.selectionSummary} aria-live="polite" aria-atomic="true"><h3>{tr('Selected for this draft','Seleccionado para este borrador')}</h3><p>{selected.count} {tr('visits','visitas')} · {selected.minutes} {tr('approved minutes','minutos aprobados')} · {selected.hours} {tr('invoice hours','horas facturadas')}</p><dl><div><dt>{tr('Excl. VAT','Sin IVA')}</dt><dd>{euro(selected.net)}</dd></div><div><dt>{tr('VAT 21%','IVA 21 %')}</dt><dd>{euro(selected.vat)}</dd></div><div><dt>{tr('Total incl. VAT','Total con IVA')}</dt><dd>{euro(selected.gross)}</dd></div></dl></section>
   <div className={s.fields}><label>{tr('Private invoice number','Número de factura privada')}<input required name="invoice_number" pattern="[0-9]{3,16}" inputMode="numeric" placeholder={tr('For example 7114','Por ejemplo 7114')}/></label>
    <label>{tr('Issue date','Fecha de emisión')}<input type="date" name="issued_on" required min="2026-10-26" defaultValue={today}/></label></div>
   <p>{tr('Issuer: Magdy Nashed (private) · Customer: Stichting Zorgbalans · Cost centre 652001 Prettig Thuis IJmuiden.','Emisor: Magdy Nashed (particular) · Cliente: Stichting Zorgbalans · Centro de costes 652001 Prettig Thuis IJmuiden.')}</p>
   <button disabled={pending||!selected.count||selected.count>MAX_BILLING_VISITS||invalidPeriod} type="submit">{pending?tr('Checking…','Comprobando…'):tr('Create invoice draft','Crear borrador de factura')}</button>
  </fieldset>
  {result.message&&<p className={result.status==='error'?s.error:s.success} role="status">{result.message}</p>}
  <p className={s.muted}>{tr('Review the PDF before sending it yourself. This action creates a draft and does not send email. Historical invoice 7113 is not recalculated.','Revise el PDF antes de enviarlo por su cuenta. Esta acción crea un borrador y no envía correos. No se recalcula la factura histórica 7113.')}</p>
 </form>;
}
export function ConfirmSent({invoice,language}:{invoice:Invoice;language:'en'|'es'}){
 const [result,action,pending]=useActionState(confirmZorgbalansInvoice,initial);
 const tr=(en:string,es:string)=>language==='es'?es:en;
 return <form action={action} className={s.confirm}>
  <input type="hidden" name="invoice_id" value={invoice.id}/>
  <label>{tr('Delivery evidence / administrative reference','Justificante de envío / referencia administrativa')}<input name="confirmation_note" required minLength={8} maxLength={500} placeholder={tr('For example: emailed on 06-11-2026','Por ejemplo: enviada por correo el 06-11-2026')}/></label>
  <button type="submit" disabled={pending}>{pending?tr('Recording…','Registrando…'):tr('Record external delivery','Registrar envío externo')}</button>
  {result.message&&<p role="status" className={result.status==='error'?s.error:s.success}>{result.message}</p>}
 </form>;
}
