'use server';
import {revalidateOperations} from '../../lib/property-operations/revalidate';
import {requirePropertyStaff} from '../../lib/security/property-staff';
import {uuid,type WorkState} from '../../lib/property-operations/staff-work';
export async function requestVisitCorrection(_previous:WorkState,form:FormData):Promise<WorkState>{
 const {db}=await requirePropertyStaff();
 const visit_id=String(form.get('visit_id')??''),proposed_minutes=Number(form.get('proposed_minutes')),reason=String(form.get('reason')??'').trim();
 if(!uuid.test(visit_id)||!Number.isInteger(proposed_minutes)||proposed_minutes<1||proposed_minutes>960||reason.length<10||reason.length>1000||/[\u0000-\u001f\u007f]/u.test(reason))return {status:'error',message:'Vul 1–960 minuten en een duidelijke reden van minimaal 10 tekens in.'};
 const {error}=await db.from('mzs_ops_visit_correction_requests').insert({visit_id,proposed_minutes,reason});
 if(error)return {status:'error',message:'Correctie niet ingediend. Controleer of de minuten veranderen en er nog een verzoek openstaat.'};
 revalidateOperations();
 return {status:'success',message:'Correctieverzoek ingediend. Je oorspronkelijke registratie blijft bewaard.'};
}
