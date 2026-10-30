'use client';
import {useActionState} from 'react';
import {saveHandover} from './actions';
import {handoverLabels,type Handover,type Question,type Result} from '../../../../../lib/accountancy/handover';
import s from './handover.module.css';
const initial:Result={status:'idle',message:''};
function Message({result,es}:{result:Result;es:boolean}){
 const messages:Record<string,[string,string]>={saved:['Saved.','Guardado.'],stale:['This record changed. Refresh before saving again.','El registro ha cambiado. Actualice antes de guardar.'],requirements:['Resolve open questions before completing. Reopen a completed handover before adding questions. Check the required delivery details.','Resuelva las preguntas antes de finalizar. Reabra la entrega finalizada antes de añadir preguntas. Compruebe los datos obligatorios.'],invalid:['Could not save. Check all fields, dates and your access, then retry.','No se pudo guardar. Compruebe campos, fechas y acceso e inténtelo de nuevo.']};
 return result.status==='idle'?null:<p role={result.status==='error'?'alert':'status'}>{messages[result.message]?.[es?1:0]}</p>;
}
export function HandoverForm({year,value,es,today}:{year:string;value?:Handover;es:boolean;today:string}){
 const [result,action,pending]=useActionState(saveHandover,initial),tr=(en:string,spanish:string)=>es?spanish:en;
 return <form action={action} className={s.form}><input type="hidden" name="year_id" value={year}/><input type="hidden" name="id" value={year}/><input type="hidden" name="kind" value="handover"/><input type="hidden" name="revision" value={value?.revision??0}/>
 <label>{tr('Status','Estado')}<select name="status" defaultValue={value?.status??'preparing'}>{Object.entries(handoverLabels).map(([key,label])=><option key={key} value={key}>{label[es?1:0]}</option>)}</select></label>
 <label>{tr('Accountant / office','Asesor / despacho')}<input name="accountant" maxLength={200} defaultValue={value?.accountant??''}/></label>
 <label>{tr('Actual handover date','Fecha real de entrega')}<input name="delivered_on" type="date" min="2000-01-01" max={today} defaultValue={value?.delivered_on??''}/></label>
 <label>{tr('Package / delivery reference','Referencia del paquete / entrega')}<input name="package_reference" maxLength={500} defaultValue={value?.package_reference??''}/></label>
 <label className={s.wide}>{tr('Progress note / explanation of outstanding items','Nota de progreso / explicación de asuntos pendientes')}<textarea name="note" required minLength={3} maxLength={2000} defaultValue={value?.note??''}/></label>
 <p className={s.wide}>{tr('Recording a handover does not send files. Enter the accountant, actual date and package or delivery reference after sharing the export yourself. Downloading alone does not mean delivered. Completion closes this handover, not the accounts or tax return.','Registrar una entrega no envía archivos. Indique asesor, fecha real y referencia después de compartir la exportación. Descargar no significa entregar. Finalizar cierra esta entrega, no las cuentas ni la declaración fiscal.')}</p>
 <button disabled={pending}>{pending?tr('Saving…','Guardando…'):tr('Save handover','Guardar entrega')}</button><Message result={result} es={es}/></form>;
}
export function QuestionForm({year,id,value,es}:{year:string;id:string;value?:Question;es:boolean}){
 const [result,action,pending]=useActionState(saveHandover,initial),tr=(en:string,spanish:string)=>es?spanish:en;
 return <form action={action} className={s.form}><input type="hidden" name="year_id" value={year}/><input type="hidden" name="id" value={id}/><input type="hidden" name="kind" value="question"/><input type="hidden" name="revision" value={value?.revision??0}/>
 <label className={s.wide}>{tr('Question / missing information','Pregunta / información pendiente')}<textarea name="question" required minLength={3} maxLength={2000} defaultValue={value?.question??''}/></label>
 <label>{tr('Status','Estado')}<select name="status" defaultValue={value?.status??'open'}><option value="open">{tr('Open','Abierta')}</option><option value="resolved">{tr('Resolved','Resuelta')}</option></select></label>
 <label>{tr('Follow-up date (optional)','Fecha de seguimiento (opcional)')}<input name="due_on" type="date" min="2000-01-01" max="2099-12-31" defaultValue={value?.due_on??''}/></label>
 <label className={s.wide}>{tr('Answer / resolution (required to resolve)','Respuesta / resolución (obligatoria para resolver)')}<textarea name="answer" maxLength={4000} defaultValue={value?.answer??''}/></label>
 <button disabled={pending}>{pending?tr('Saving…','Guardando…'):tr('Save question','Guardar pregunta')}</button><Message result={result} es={es}/></form>;
}
