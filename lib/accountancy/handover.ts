import {uuid,dateValue,textField} from './administration';
export const HANDOVER_ROOT='/admin/workspaces/accountancy/handovers';
export const handoverLabels={preparing:['Preparing','En preparación'],ready:['Ready for handover','Listo para entregar'],delivered:['Handed over','Entregado'],questions:['Questions outstanding','Preguntas pendientes'],completed:['Handover completed','Entrega finalizada']} as const;
export type Handover={year_id:string;status:keyof typeof handoverLabels;accountant:string;delivered_on:string|null;package_reference:string;note:string;revision:number;updated_at:string;updated_by:string};
export type Question={id:string;year_id:string;question:string;answer:string;status:'open'|'resolved';due_on:string|null;revision:number;updated_at:string;updated_by:string};
export type HandoverEvent={id:number;kind:'handover'|'question';record_id:string;before_record:Record<string,unknown>|null;after_record:Record<string,unknown>;created_at:string;actor_id:string};
export type Result={status:'idle'|'success'|'error';message:string};
export function handoverInput(f:FormData){
 const year=textField(f,'year_id',36),id=textField(f,'id',36),kind=textField(f,'kind',10),revision=Number(textField(f,'revision',10,1));
 if(!uuid.test(year)||!uuid.test(id)||!['handover','question'].includes(kind)||!Number.isSafeInteger(revision)||revision<0)throw Error('invalid');
 const status=textField(f,'status',20),dateKey=kind==='handover'?'delivered_on':'due_on',raw=textField(f,dateKey,10),date=raw?dateValue(raw):null;
 if(date&&(date<'2000-01-01'||date>'2099-12-31'))throw Error('invalid');
 let data:Record<string,unknown>;
 if(kind==='handover'){
  if(id!==year||!Object.hasOwn(handoverLabels,status))throw Error('invalid');
  const accountant=textField(f,'accountant',200),reference=textField(f,'package_reference',500),note=textField(f,'note',2000,3);
  if(['delivered','questions','completed'].includes(status)&&(!date||accountant.length<2||reference.length<3))throw Error('invalid');
  data={status,accountant,package_reference:reference,note,delivered_on:date};
 }else{
  const question=textField(f,'question',2000,3),answer=textField(f,'answer',4000);
  if(!['open','resolved'].includes(status)||status==='resolved'&&answer.length<3)throw Error('invalid');
  data={status,question,answer,due_on:date};
 }
 return {year,id,kind,revision,data};
}
