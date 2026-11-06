'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {useAdminI18n} from '../../../../../lib/admin/i18n';
import {effectiveLeaseLines,monthlyCents,nextIndexationReview,type Adjustment,type LeasePricing,type LineRole,type PricingBasis} from '../../../../../lib/estates/lease-pricing';
import {classifyLease,proposeLeaseAdjustment,decideLeaseAdjustment} from './pricing-actions';
import s from './contracts.module.css';

export default function LeasePricingPanel({contract:c,adjustments,today}:{contract:LeasePricing;adjustments:Adjustment[];today:string}){
 const {language,locale}=useAdminI18n(),l=(en:string,es:string)=>language==='es'?es:en,router=useRouter();
 const [busy,start]=useTransition(),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [basis,setBasis]=useState<PricingBasis>('separate'),[roles,setRoles]=useState<LineRole[]>(c.lines.map(()=> 'rent'));
 const [kind,setKind]=useState('indexation'),[method,setMethod]=useState('percentage');
 const money=(cents:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(cents/100);
 const current=effectiveLeaseLines(c,adjustments,today),next=nextIndexationReview(c,adjustments);
 function run(action:()=>Promise<{error?:string}>,success:string){setError('');setNotice('');start(async()=>{try{const r=await action();if(r.error)setError(r.error);else{setNotice(success);router.refresh();}}catch{setError(l('The result could not be verified. Refresh before retrying.','No se pudo verificar el resultado. Actualice antes de reintentar.'));}});}
 return <section className={s.panel} aria-label={l('Pricing and annual review','Precios y revisión anual')}>
  <h3>{l('Pricing and annual review','Precios y revisión anual')}</h3>
  {error&&<p className={s.error} role="alert">{error}</p>}{notice&&<p className={s.notice} role="status">{notice}</p>}
  <p>{l('Current monthly amount, excluding VAT','Importe mensual actual, sin IVA')}: <strong>{money(monthlyCents(current))}</strong></p>
  <p>{c.pricing_basis==='all_in'?l('All-in: included services have no separate advances.','Todo incluido: los servicios incluidos no generan anticipos separados.'):c.pricing_basis==='separate'?l('Basic rent and service advances are recorded separately.','La renta base y los anticipos se registran por separado.'):l('Confirm the pricing basis from the signed agreement before calculating adjustments.','Confirme el tipo de precio del contrato antes de calcular ajustes.')}</p>
  {c.pricing_basis==='unclassified'&&c.status!=='stopped'&&<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);run(()=>classifyLease(c.id,c.version,basis,basis==='all_in'?c.lines.map(()=> 'all_in'):roles,String(f.get('review')||''),String(f.get('clause')||'')),l('Pricing classified; original amounts are retained.','Precio clasificado; se conservan los importes originales.'));}}><fieldset disabled={busy} className={s.grid} style={{border:0,padding:0}}>
   <label className={s.field}>{l('Pricing basis','Tipo de precio')}<select value={basis} onChange={e=>setBasis(e.target.value as PricingBasis)}><option value="separate">{l('Basic rent + separate advances','Renta base + anticipos separados')}</option><option value="all_in">{l('All-in, without separate advances','Todo incluido, sin anticipos separados')}</option></select></label>
   {basis==='separate'&&c.lines.map((line,i)=><label className={s.field} key={i}>{line.description} · {money(Math.round(Number(line.amount)*100))}<select value={roles[i]} onChange={e=>setRoles(r=>r.map((v,n)=>n===i?e.target.value as LineRole:v))}><option value="rent">{l('Basic rent','Renta base')}</option><option value="advance">{l('Service advance','Anticipo de servicios')}</option><option value="other">{l('Other fixed amount','Otro importe fijo')}</option></select></label>)}
   {basis==='separate'&&<label className={s.field}>{l('Next annual review month','Mes de la próxima revisión anual')}<input name="review" type="date"/></label>}
   <label className={`${s.field} ${s.wide}`}>{l('Contract clause / source reference','Cláusula / referencia del contrato')}<textarea name="clause" maxLength={2000} required minLength={5}/></label>
   <button className={s.button}>{l('Confirm classification','Confirmar clasificación')}</button>
  </fieldset></form>}
  {c.pricing_basis==='separate'&&<p>{l('Next annual review','Próxima revisión anual')}: <strong>{next??l('Not recorded','Sin registrar')}</strong>{next&&next<=today?' · '+l('Review due','Revisión pendiente'):''}<br/>{c.indexation_clause}</p>}
  {c.pricing_basis==='separate'&&c.status==='active'&&<details><summary>{l('Calculate a new proposal','Calcular una nueva propuesta')}</summary>
   <p className={s.help}>{l('A calculation is saved as a proposal. Verify the contract, applicable limit and tenant notice before approving. Approval changes only future invoice drafts; it sends no message.','El cálculo se guarda como propuesta. Verifique el contrato, el límite aplicable y la notificación al inquilino antes de aprobar. La aprobación cambia solo futuros borradores de factura; no envía mensajes.')}</p>
   <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);run(()=>proposeLeaseAdjustment(f),l('Proposal saved for review.','Propuesta guardada para revisión.'));}}><fieldset disabled={busy} className={s.grid} style={{border:0,padding:0}}>
    <input type="hidden" name="contract_id" value={c.id}/>
    <label className={s.field}>{l('Adjustment','Ajuste')}<select name="kind" value={kind} onChange={e=>setKind(e.target.value)}><option value="indexation">{l('Annual basic-rent indexation','Actualización anual de la renta base')}</option>{c.line_roles.includes('advance')&&<option value="advance">{l('Recalculate service advance','Recalcular anticipo de servicios')}</option>}</select></label>
    <label className={s.field}>{l('Effective date (first of month)','Fecha de efecto (día 1 del mes)')}<input name="effective_on" type="date" min={today} required defaultValue={next&&next>=today?next:''}/></label>
    {kind==='indexation'?<>
     <label className={s.field}>{l('Calculation method','Método de cálculo')}<select name="method" value={method} onChange={e=>setMethod(e.target.value)}><option value="percentage">{l('Agreed percentage','Porcentaje acordado')}</option><option value="cpi">{l('CPI index ratio','Cociente de índices IPC')}</option></select></label>
     {method==='percentage'?<label className={s.field}>{l('Percentage','Porcentaje')}<input name="percentage" type="number" step="0.000001" min="-100" max="100" required/></label>:<><label className={s.field}>{l('Previous CPI index','Índice IPC anterior')}<input name="old_index" type="number" min="0.000001" step="0.000001" required/></label><label className={s.field}>{l('New CPI index (same series)','Nuevo índice IPC (misma serie)')}<input name="new_index" type="number" min="0.000001" step="0.000001" required/></label></>}
     <label className={s.field}>{l('Verified percentage ceiling (optional)','Límite porcentual verificado (opcional)')}<input name="ceiling" type="number" min="0" max="100" step="0.000001"/></label>
     <p className={s.help}>{l('Only basic-rent lines change. Advances and other fixed amounts remain the same. CPI periods, legal limits and the contractual clause must be checked for each proposal.','Solo cambian las líneas de renta base. Los anticipos y otros importes fijos se mantienen. Compruebe los periodos del IPC, los límites legales y la cláusula contractual en cada propuesta.')}</p>
    </>:<>
     <label className={s.field}>{l('Advance line','Línea de anticipo')}<select name="line_index" required>{c.lines.map((line,i)=>c.line_roles[i]==='advance'?<option key={i} value={i}>{line.description}</option>:null)}</select></label>
     <label className={s.field}>{l('Budget allocated to this contract (EUR)','Presupuesto asignado a este contrato (EUR)')}<input name="annual_budget" type="number" min="0" step="0.01" required/></label>
     <label className={s.field}>{l('Months covered by this budget','Meses cubiertos por el presupuesto')}<input name="months" type="number" min="1" max="12" defaultValue="12" required/></label>
     <p className={s.help}>{l('Monthly advance = allocated budget ÷ months, rounded to cents. Enter only this contract’s share. This is a forecast, not a service-charge settlement.','Anticipo mensual = presupuesto asignado ÷ meses, redondeado a céntimos. Introduzca solo la parte de este contrato. Es una previsión, no una liquidación de servicios.')}</p>
    </>}
    <label className={`${s.field} ${s.wide}`}>{l('Calculation evidence and contractual basis','Justificación del cálculo y base contractual')}<textarea name="evidence" required minLength={5} maxLength={2000}/></label>
    <button className={s.button}>{l('Save calculation for review','Guardar cálculo para revisión')}</button>
   </fieldset></form>
  </details>}
  {adjustments.length>0&&<h4>{l('Adjustment history','Historial de ajustes')}</h4>}
  {[...adjustments].sort((a,b)=>b.revision-a.revision).map(a=><details key={a.id} className={s.summary}>
   <summary>{a.effective_on} · {a.kind==='indexation'?l('Rent indexation','Actualización de renta'):l('Service advance','Anticipo')} · {a.status==='approved'?l('Approved','Aprobado'):a.status==='cancelled'?l('Cancelled','Cancelado'):l('For review','Por revisar')} · {money(monthlyCents(a.base_lines))} → {money(monthlyCents(a.new_lines))}</summary>
   <p>{a.evidence}</p><div className={s.tableWrap}><table className={s.table}><thead><tr><th>{l('Line','Línea')}</th><th>{l('Before','Anterior')}</th><th>{l('After','Nuevo')}</th></tr></thead><tbody>{a.new_lines.map((line,i)=><tr key={i}><td>{line.description}</td><td>{money(Math.round(Number(a.base_lines[i].amount)*100))}</td><td>{money(Math.round(Number(line.amount)*100))}</td></tr>)}</tbody></table></div>
   <p>{a.kind==='indexation'?l('Applied percentage','Porcentaje aplicado')+': '+a.calculation.applied_percentage+'%':`${a.calculation.annual_budget} / ${a.calculation.months}`}</p>
   {a.status==='proposed'&&<form onSubmit={e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form),button=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;const approve=(button?.value??'approve')==='approve';if(approve&&!f.has('checked')){setError(l('Confirm the contract, limits and tenant notice check.','Confirme la revisión del contrato, límites y aviso al inquilino.'));return;}run(()=>decideLeaseAdjustment(a.id,approve,String(f.get('note')||'')),l('Decision recorded.','Decisión registrada.'));}}><fieldset disabled={busy} style={{border:0,padding:0}}>
    <label className={s.field}>{l('Review / cancellation reference','Referencia de revisión / cancelación')}<textarea name="note" required minLength={5} maxLength={2000}/></label>
    <label className={s.check}><input name="checked" type="checkbox"/>{l('I checked the agreement, applicable limits, effective date and required tenant notice.','He comprobado el contrato, los límites aplicables, la fecha y el aviso necesario al inquilino.')}</label>
    <div className={s.toolbar}><button className={s.button} type="submit" value="approve">{l('Approve future amounts','Aprobar importes futuros')}</button><button className={s.secondary} type="submit" value="cancel">{l('Cancel proposal','Cancelar propuesta')}</button></div>
   </fieldset></form>}
  </details>)}
 </section>;
}
