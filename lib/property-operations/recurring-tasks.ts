import {dateInput,field,optionalUuid} from './task-input';
import {taskPriorities,taskUuid} from './property-tasks';
export type RecurringPlan={id:string;property_id:string|null;work_area_id:string|null;unit_id:string|null;assigned_profile_id:string;title:string;description:string;priority:string;frequency:string;every_n:number;start_on:string;end_on:string|null;lead_days:number;is_active:boolean;next_on:string;occurrence_no:number;revision:number;skipped_on_resume:number;last_error:string|null;last_generated_at:string|null};
export function recurrenceDate(start:string,frequency:string,every:number,index:number):string{
 if(!dateInput(start)||!['daily','weekly','monthly'].includes(frequency)||!Number.isInteger(every)||every<1||every>365||!Number.isInteger(index)||index<0||index>40000)throw Error('Invalid recurrence');
 const [y,m,d]=start.split('-').map(Number);let value:Date;
 if(frequency==='monthly'){
  const first=new Date(Date.UTC(y,m-1+every*index,1));
  const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  value=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(d,last)));
 }else value=new Date(Date.UTC(y,m-1,d+every*index*(frequency==='weekly'?7:1)));
 return value.toISOString().slice(0,10);
}
export function firstRecurrenceIndex(start:string,frequency:string,every:number,today:string):number{
 recurrenceDate(start,frequency,every,0);if(!dateInput(today))throw Error('Invalid date');
 if(frequency==='monthly'){
  const [y,m]=start.split('-').map(Number),[ty,tm]=today.split('-').map(Number);
  let n=Math.max(0,Math.floor(((ty-y)*12+tm-m)/every));if(recurrenceDate(start,frequency,every,n)<today)n++;return n;
 }
 return Math.max(0,Math.ceil((Date.parse(today+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/(86400000*every*(frequency==='weekly'?7:1))));
}
export function recurringInput(form:FormData){
 const id=field(form,'id',36),revision=Number(field(form,'revision',10));
 if(!taskUuid.test(id)||!Number.isSafeInteger(revision)||revision<0)throw Error('Invalid revision');
 const property_id=optionalUuid(field(form,'property_id',36)),work_area_id=field(form,'work_area_id',80)||null,unit_id=optionalUuid(field(form,'unit_id',36));
 const assigned_profile_id=field(form,'assigned_profile_id',36);
 if(!taskUuid.test(assigned_profile_id)||(property_id===null)===(work_area_id===null)||(work_area_id&&unit_id))throw Error('Invalid assignment');
 const title=field(form,'title',160),description=field(form,'description',2000),priority=field(form,'priority',10),frequency=field(form,'frequency',10);
 const every_n=Number(field(form,'every_n',3)),lead_days=Number(field(form,'lead_days',2));
 const start_on=field(form,'start_on',10),end_on=field(form,'end_on',10)||null;
 if(title.length<5||!taskPriorities.includes(priority as typeof taskPriorities[number])||!Number.isInteger(lead_days)||lead_days<0||lead_days>30||!dateInput(start_on)||(end_on&&(!dateInput(end_on)||end_on<start_on)))throw Error('Invalid plan details');
 recurrenceDate(start_on,frequency,every_n,0);
 return {id,revision,data:{property_id,work_area_id,unit_id,assigned_profile_id,title,description,priority,frequency,every_n,start_on,end_on,lead_days,is_active:form.get('is_active')==='on'}};
}
