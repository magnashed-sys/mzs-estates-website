'use server';
import {requirePropertyStaff} from '../../lib/security/property-staff';
import {revalidateOperations} from '../../lib/property-operations/revalidate';
import {revalidatePath} from 'next/cache';

type Result={status:'idle'|'success'|'error'|'warning';message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Append-only staff progress, never an admin maintenance-status change. */
export async function addMyMaintenanceProgress(_previous:Result,form:FormData):Promise<Result>{
 const {db,properties,user}=await requirePropertyStaff();
 const ticketId=String(form.get('ticket_id')??'');
 const noteKind=String(form.get('note_kind')??'');
 const note=String(form.get('note')??'').trim();
 if(!uuid.test(ticketId)||!['progress','blocked','ready_for_review'].includes(noteKind)||
    note.length<8||note.length>1500||/[\u0000-\u001f\u007f]/u.test(note))
  return {status:'error',message:'Check the report and enter a short progress note.'};
 const {data:ticket,error:ticketError}=await db.from('mzs_ops_current_tickets')
  .select('id,reported_by,property_id,status').eq('id',ticketId).maybeSingle();
 if(ticketError||!ticket||ticket.reported_by!==user.id||
    !properties.some(p=>p.id===ticket.property_id)||ticket.status==='closed')
  return {status:'error',message:'Maintenance report is not available for updating.'};
 const {error}=await db.from('mzs_ops_staff_ticket_notes')
  .insert({ticket_id:ticketId,note_kind:noteKind,note});
 if(error)return {status:'error',message:'Progress was not saved. Refresh the report and try again.'};
 revalidateOperations();
 revalidatePath('/admin/workspaces/estates/staff');
 return {status:'success',message:'Progress note saved for the administrator.'};
}
