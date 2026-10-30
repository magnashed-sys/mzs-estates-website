'use server';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {revalidateOperations} from '../../../../../lib/property-operations/revalidate';
import {revalidatePath} from 'next/cache';
export type WeekActionState={status:'idle'|'success'|'error';message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day=/^20\d{2}-\d{2}-\d{2}$/;
function fields(form:FormData){
 const profile=String(form.get('profile')??'');
 const week=String(form.get('week')??'');
 const note=String(form.get('note')??'').trim();
 const validWeek=day.test(week)&&!Number.isNaN(Date.parse(week+'T00:00:00Z'))&&
  new Date(week+'T00:00:00Z').toISOString().slice(0,10)===week&&
  new Date(week+'T00:00:00Z').getUTCDay()===1;
 if(!uuid.test(profile)||!validWeek||note.length<12||note.length>500||/[\u0000-\u001f\u007f]/u.test(note))return null;
 return {profile,week,note};
}
function refresh(){revalidateOperations();revalidatePath('/admin/workspaces/estates/weekly');revalidatePath('/staff');}
export async function approveSelectedWeekVisits(_prev:WeekActionState,form:FormData):Promise<WeekActionState>{
 requireStaffEnvironment();const {db}=await requireEstateAdmin();const f=fields(form);
 const ids=form.getAll('visit_id').map(x=>String(x));
 if(!f||ids.length<1||ids.length>100||new Set(ids).size!==ids.length||ids.some(x=>!uuid.test(x)))
  return {status:'error',message:'Select 1–100 pending visits and provide a reason of at least 12 characters.'};
 const {data,error}=await db.rpc('mzs_ops_approve_week_visits',{p_profile:f.profile,p_week_start:f.week,p_visit_ids:ids,p_note:f.note});
 if(error||typeof data!=='number'||data!==ids.length)return {status:'error',message:'Review failed: entries changed, have open corrections or the week is closed. Nothing was partially approved.'};
 refresh();return {status:'success',message:data+' visits approved and recorded in the audit history.'};
}
export async function closeStaffWeek(_prev:WeekActionState,form:FormData):Promise<WeekActionState>{
 requireStaffEnvironment();const {db}=await requireEstateAdmin();const f=fields(form);
 if(!f)return {status:'error',message:'Choose a Monday and provide a closure reason (at least 12 characters).'};
 const {data,error}=await db.rpc('mzs_ops_close_staff_week',{p_profile:f.profile,p_week_start:f.week,p_note:f.note});
 if(error||typeof data!=='string'||!uuid.test(data))return {status:'error',message:'Week not closed. Every entry must be approved and all corrections resolved; the week must have ended.'};
 refresh();return {status:'success',message:'Week closed. Its approved hours are preserved in a dated snapshot.'};
}
export async function reopenStaffWeek(_prev:WeekActionState,form:FormData):Promise<WeekActionState>{
 requireStaffEnvironment();const {db}=await requireEstateAdmin();const f=fields(form);
 if(!f)return {status:'error',message:'Enter a reason of at least 12 characters to reopen the week.'};
 const {data,error}=await db.rpc('mzs_ops_reopen_staff_week',{p_profile:f.profile,p_week_start:f.week,p_note:f.note});
 if(error||typeof data!=='string'||!uuid.test(data))return {status:'error',message:'Reopening denied. Verify closure state and whether Zorgbalans visits have already been invoiced.'};
 refresh();return {status:'success',message:'Week reopened with audit history; changes must be reviewed before it can be closed again.'};
}
