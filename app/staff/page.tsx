import Link from 'next/link';
import {requirePropertyStaff} from '../../lib/security/property-staff';
import {loadRegisters,allRows,type Params} from '../../lib/property-operations/staff-data';
import StaffForms from './StaffForms';
import WorkRegisters from './WorkRegisters';
import s from './staff.module.css';
export const dynamic='force-dynamic';
export default async function StaffPage({searchParams}:{searchParams:Promise<Params>}){
 const {db,properties}=await requirePropertyStaff();const params=await searchParams;
 const [data,units]=await Promise.all([loadRegisters(db,params),allRows<{id:string;property_id:string;address:string}>((a,b)=>db.from('mzs_ops_staff_unit_directory').select('id,property_id,address',{count:'exact'}).order('id').range(a,b))]);
 return <main className={s.page}><Link href="/private">← Mijn omgeving</Link><h1>Werkbezoeken &amp; onderhoud</h1><p>Registreer je werkzaamheden en volg de beoordeling en opvolging. Alleen jouw toegewezen objecten zijn beschikbaar.</p><StaffForms properties={properties} units={units}/><WorkRegisters data={data} params={params} properties={properties}/></main>;
}
