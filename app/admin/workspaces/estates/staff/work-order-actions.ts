'use server';
import {revalidateOperations} from '../../../../../lib/property-operations/revalidate';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {uuid,type WorkState} from '../../../../../lib/property-operations/staff-work';
import {euroCents} from '../../../../../lib/property-operations/sales-reconciliation';
const value=(form:FormData,key:string)=>String(form.get(key)??'').trim();
const valid=(s:string,min:number,max:number)=>s.length>=min&&s.length<=max&&!/[\u0000-\u001f\u007f]/u.test(s);
function result(error:unknown,message:string):WorkState{
 if(error)return {status:'error',message:"Not saved. Check the current status, cost bearer, quotation and amounts; refresh after a concurrent change."};
 revalidateOperations();return {status:'success',message};
}
export async function createInternalWorkOrder(_previous:WorkState,form:FormData):Promise<WorkState>{
 requireStaffEnvironment();const {db}=await requireEstateAdmin();
 const ticket_id=value(form,'ticket_id'),legal_entity_id=value(form,'legal_entity_id'),supplier_relationship_id=value(form,'supplier_relationship_id'),scope_of_work=value(form,'scope_of_work'),quotation_reference=value(form,'quotation_reference');
 let net:number,vat:number;try{net=euroCents(value(form,'net_eur').replace(',','.'));vat=euroCents(value(form,'vat_eur').replace(',','.'));}catch{return result(true,'');}
 if(![ticket_id,legal_entity_id,supplier_relationship_id].every(x=>uuid.test(x))||!valid(scope_of_work,10,2000)||!valid(quotation_reference,3,180)||net+vat<=0)return result(true,'');
 const {error}=await db.from('mzs_ops_maintenance_work_orders').insert({ticket_id,legal_entity_id,supplier_relationship_id,scope_of_work,quotation_reference,approved_budget_net_cents:net,approved_budget_vat_cents:vat});
 return result(error,"Draft work order recorded for internal budget review.");
}
export async function decideInternalWorkOrder(_previous:WorkState,form:FormData):Promise<WorkState>{
 requireStaffEnvironment();const {db}=await requireEstateAdmin();
 const work_order_id=value(form,'work_order_id'),decision=value(form,'decision'),reason=value(form,'reason'),expected_decision_id=value(form,'expected_decision_id')||null;
 if(!uuid.test(work_order_id)||(expected_decision_id&&!uuid.test(expected_decision_id))||!['authorized_internally','declined','cancelled'].includes(decision)||!valid(reason,8,1000))return result(true,'');
 const {error}=await db.from('mzs_ops_maintenance_work_order_decisions').insert({work_order_id,decision,reason,expected_decision_id});
 return result(error,"Internal budget decision recorded. The supplier has not been notified.");
}
export async function holdMaintenancePhoto(_previous:WorkState,form:FormData):Promise<WorkState>{
 requireStaffEnvironment();const {db}=await requireEstateAdmin();
 const photo_id=value(form,'photo_id'),reason=value(form,'reason');
 if(!uuid.test(photo_id)||!valid(reason,8,500))return result(true,'');
 const {error}=await db.from('mzs_ops_maintenance_photo_holds').insert({photo_id,reason});
 return result(error,"Photo hidden. The dossier and supporting evidence are preserved.");
}
