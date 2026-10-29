/** Shared nonfinancial task input validation. Database checks remain authoritative. */
import {taskPriorities,taskStatuses,taskUuid} from './property-tasks';
export const isoDate=/^20\d\d-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
export function dateInput(value:string):boolean{
 if(!isoDate.test(value))return false;
 const test=new Date(value+'T00:00:00.000Z');
 return !Number.isNaN(test.valueOf())&&test.toISOString().slice(0,10)===value;
}
export function field(form:FormData,key:string,max:number){
 const value=form.get(key);
 if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw Error('Invalid '+key);
 return value.trim();
}
export function optionalUuid(value:string):string|null{
 if(!value)return null;
 if(!taskUuid.test(value))throw Error('Invalid ID');
 return value;
}
export function taskInput(form:FormData){
 const property_id=field(form,'property_id',36);
 if(!taskUuid.test(property_id))throw Error('Invalid property');
 const unit_id=optionalUuid(field(form,'unit_id',36));
 const assigned_profile_id=optionalUuid(field(form,'assigned_profile_id',36));
 const title=field(form,'title',160),description=field(form,'description',2000);
 const priority=field(form,'priority',10),due_on=field(form,'due_on',10);
 const source_reference=field(form,'source_reference',250);
 if(title.length<5||!taskPriorities.includes(priority as any)||due_on&&!dateInput(due_on))throw Error('Invalid task fields');
 return {property_id,unit_id,assigned_profile_id,title,description,priority,
  due_on:due_on||null,source_reference};
}
export function taskUpdateInput(form:FormData){
 const task_id=field(form,'task_id',36),status=field(form,'status',20),note=field(form,'note',1500);
 if(!taskUuid.test(task_id)||!taskStatuses.includes(status as any)||note.length<3)throw Error('Invalid update');
 return {task_id,status,note};
}
