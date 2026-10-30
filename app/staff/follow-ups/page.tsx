import Link from 'next/link';
import {cookies} from 'next/headers';
import {requirePropertyStaff} from '../../../lib/security/property-staff';
import {allRows} from '../../../lib/property-operations/staff-data';
import {safeStaffLanguage} from '../../../lib/property-operations/staff-copy';
import type {Followup} from '../../../lib/accountancy/followups';
import FollowupTasks from '../../components/FollowupTasks';
import s from '../staff.module.css';
export const dynamic='force-dynamic';
export default async function Followups(){
 const {db,user}=await requirePropertyStaff();
 const language=safeStaffLanguage((await cookies()).get('mzs_staff_language')?.value);
 const tasks=await allRows<Followup>((a,b)=>db.from('mzs_accountancy_followups').select('*',{count:'exact'}).eq('assigned_profile_id',user.id).order('due_on',{nullsFirst:false}).order('id').range(a,b));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return <main className={s.page}><Link href="/staff">← Property Manager</Link><h1>{language==='nl'?'Mijn opvolgtaken':language==='es'?'Mis tareas de seguimiento':'My follow-up tasks'}</h1><FollowupTasks tasks={tasks} userId={user.id} language={language} today={today}/></main>;
}
