import {dateInput,optionalUuid} from '../property-operations/task-input';
import {taskUuid,taskStatuses} from '../property-operations/property-tasks';
import type {CompletenessItem} from './completeness';
export type Followup={id:string;year_id:string;item_key:string;title:string;assigned_profile_id:string|null;due_on:string|null;status:string;note:string;revision:number;updated_at:string};
export type Assignee={id:string;full_name:string|null};
export type FollowupResult={status:'idle'|'success'|'error';message:string;count?:number};
export function followupInput(form:FormData){
 const year=String(form.get('year_id')??'');
 const keys=form.getAll('item_key');
 if(!taskUuid.test(year)||keys.length<1||keys.length>50||keys.some(k=>typeof k!=='string'||k.length>60)||new Set(keys).size!==keys.length)throw Error('selection');
 const assignee=optionalUuid(String(form.get('assigned_profile_id')??''));
 const due=String(form.get('due_on')??'');if(due&&!dateInput(due))throw Error('date');
 return {year,keys:keys as string[],assignee,due:due||null};
}
export function selectedFollowups(keys:string[],items:CompletenessItem[]){
 const byId=new Map(items.map(i=>[i.id,i]));
 return keys.map(id=>{const item=byId.get(id);if(!item)throw Error('Refresh changed source');return {id,label:item.label.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,240)};});
}
export function followupUpdate(form:FormData){
 const id=String(form.get('id')??''),revision=Number(form.get('revision')),status=String(form.get('status')??''),note=String(form.get('note')??'').trim();
 if(!taskUuid.test(id)||!Number.isSafeInteger(revision)||revision<1||!taskStatuses.includes(status as any)||note.length<3||note.length>1500||/[\u0000-\u001f\u007f]/.test(note))throw Error('update');
 return {id,revision,status,note};
}
export function followupSource(task:Followup){
 const root='/admin/workspaces/accountancy/administrations/'+task.year_id;
 const [kind,id]=task.item_key.split(':');
 return kind==='document'?'/admin/workspaces/accountancy/documents/'+id:kind==='cost'?root+'?draft='+id+'#costs':kind==='supplier'?'/admin/relationships':root;
}
