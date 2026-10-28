'use server';
import {revalidateOperations} from '../../../../../lib/property-operations/revalidate';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {uuid,validDate,type WorkState} from '../../../../../lib/property-operations/staff-work';

function result(error:unknown):WorkState{
 if(error)return {status:'error',message:"Not saved. Check the current status, assignment and inputs; refresh the page if these have changed."};
 revalidateOperations();
 return {status:'success',message:"Decision recorded in the history."};
}
const text=(form:FormData,key:string)=>String(form.get(key)??'').trim();
const reasonValid=(v:string)=>v.length>=8&&v.length<=1000&&!/[\u0000-\u001f\u007f]/u.test(v);
export async function reviewActualVisit(_previous:WorkState,form:FormData):Promise<WorkState>{
 requireStaffEnvironment();const {db}=await requireEstateAdmin();
 const visit_id=text(form,'visit_id'),correction_id=text(form,'correction_id')||null,decision=text(form,'decision'),reason=text(form,'reason'),recharge_class=text(form,'recharge_class');
 const candidate=decision==='approved'&&recharge_class==='review_candidate';
 const minimum_minutes=candidate?Number(text(form,'minimum_minutes')):null,increment_minutes=candidate?Number(text(form,'increment_minutes')):null;
 if(!uuid.test(visit_id)||(correction_id&&!uuid.test(correction_id))||!['approved','rejected'].includes(decision)||!reasonValid(reason)||!['not_billable','review_candidate'].includes(recharge_class)||(decision==='rejected'&&recharge_class!=='not_billable')||(candidate&&(!text(form,'minimum_minutes')||!text(form,'increment_minutes')||!Number.isInteger(minimum_minutes)||!Number.isInteger(increment_minutes)||minimum_minutes!<0||minimum_minutes!>960||increment_minutes!<1||increment_minutes!>960)))return result(true);
 const {error}=await db.from('mzs_ops_visit_reviews').insert({visit_id,correction_id,decision,reason,recharge_class,minimum_minutes,increment_minutes});return result(error);
}
export async function decideCorrection(_previous:WorkState,form:FormData):Promise<WorkState>{
 requireStaffEnvironment();const {db}=await requireEstateAdmin();
 const correction_id=text(form,'correction_id'),decision=text(form,'decision'),reason=text(form,'reason');
 if(!uuid.test(correction_id)||!['approved','rejected'].includes(decision)||!reasonValid(reason))return result(true);
 const {error}=await db.from('mzs_ops_visit_correction_decisions').insert({correction_id,decision,reason});return result(error);
}
export async function recordTicketProgress(_previous:WorkState,form:FormData):Promise<WorkState>{
 requireStaffEnvironment();const {db}=await requireEstateAdmin();
 const expected_event_id=text(form,'expected_event_id')||null;
 const ticket_id=text(form,'ticket_id'),action=text(form,'action'),note=text(form,'note'),responsible_profile_id=text(form,'responsible_profile_id')||null,scheduled_for=text(form,'scheduled_for')||null;
 if((expected_event_id&&!uuid.test(expected_event_id))||!uuid.test(ticket_id)||!['triaged','scheduled','in_progress','resolved','reopened','closed'].includes(action)||!reasonValid(note)||(responsible_profile_id&&!uuid.test(responsible_profile_id))||(scheduled_for&&!validDate(scheduled_for))||(['scheduled','in_progress'].includes(action)&&!responsible_profile_id)||(action==='scheduled'&&!scheduled_for))return result(true);
 const {error}=await db.from('mzs_ops_maintenance_events').insert({ticket_id,action,note,responsible_profile_id,scheduled_for,expected_event_id});return result(error);
}
