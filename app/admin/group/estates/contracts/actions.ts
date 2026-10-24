'use server';

import { revalidatePath } from 'next/cache';
import { requireContractAdmin } from '../../../../../lib/security/estate-contracts';

const path = '/admin/group/estates/contracts';
export async function saveContract(input: Record<string, unknown>, id?: string, version?: number) {
  const { db } = await requireContractAdmin();
  const allowed = ['title','property_id','unit_ids','tenant_profile_id','tenant_name','tenant_address','tenant_email','issuer_name','issuer_address','issuer_iban','issuer_tax_id','contract_date','lease_start','lease_end','first_period','first_generation_date','max_terms','payment_days','payment_conditions','customer_reference','invoice_subject','invoice_language','planning_color','deposit','prorate','lines','notes'];
  const payload = Object.fromEntries(allowed.filter(key => key in input).map(key => [key,input[key]]));
  const q = id ? db.from('mzs_lease_contracts').update(payload).eq('id',id).eq('version',version).eq('status','draft') : db.from('mzs_lease_contracts').insert(payload);
  const { data,error } = await q.select('id').maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error:'This contract has changed. Refresh the page before editing.' };
  revalidatePath(path); return { id:data.id as string };
}
export async function setContractStatus(id: string, version: number, status: 'active'|'stopped') {
  const { db } = await requireContractAdmin();
  if (!['active','stopped'].includes(status)) return { error:'Invalid status.' };
  const { data,error } = await db.from('mzs_lease_contracts').update({status}).eq('id',id).eq('version',version).select('id').maybeSingle();
  if (error || !data) return { error:error?.message || 'This contract has changed. Refresh the page.' };
  revalidatePath(path); return { ok:true };
}
export async function generateDrafts() {
  const { db } = await requireContractAdmin();
  const { data,error } = await db.rpc('mzs_generate_lease_drafts');
  if (error) return { error:error.message };
  revalidatePath(path); return { count:Number(data) };
}
export async function reviewInvoice(id: string, checked: boolean, note: string) {
  const { db } = await requireContractAdmin();
  const { data,error } = await db.from('mzs_lease_invoice_drafts').update({review_status:checked?'checked':'pending',review_note:note}).eq('id',id).select('id').maybeSingle();
  if (error || !data) return { error:error?.message || 'Draft unavailable.' };
  revalidatePath(path); return { ok:true };
}
export async function leaseDocuments(id: string) {
  const { db } = await requireContractAdmin();
  const { data:contract } = await db.from('mzs_lease_contracts').select('id').eq('id',id).maybeSingle();
  if (!contract) return { error:'Contract unavailable.' };
  const { data,error } = await db.storage.from('mzs-lease-documents').list(id,{limit:100,sortBy:{column:'created_at',order:'desc'}});
  if(error) return { error:error.message };
  const documents = await Promise.all((data || []).filter(x=>x.id).map(async file => {
    const {data:signed}=await db.storage.from('mzs-lease-documents').createSignedUrl(`${id}/${file.name}`,60);
    return {name:file.name.replace(/^[0-9a-f-]{36}-/,''),url:signed?.signedUrl || ''};
  }));
  return { documents };
}
