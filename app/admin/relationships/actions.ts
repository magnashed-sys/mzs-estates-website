'use server';
import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../lib/security/estate-properties';
import {normalizeRelationship, normalizedEmail} from '../../../lib/relationships/model';

export async function saveRelationship(input: Record<string, unknown>, id?: string, version?: number) {
  const {db} = await requireEstateAdmin();
  let payload;
  try { payload = normalizeRelationship(input); }
  catch (error) { return {error: error instanceof Error ? error.message : 'Invalid relationship details.'}; }
  if (id && (!Number.isInteger(version) || version! < 1)) return {error: 'Refresh the relationship before editing.'};
  if (payload.profile_id) {
    const {data, error} = await db.from('profiles').select('id').eq('id', payload.profile_id).in('role', ['client', 'partner']).maybeSingle();
    if (error || !data) return {error: 'The selected client or partner account is unavailable.'};
  }
  // Reuse the person behind an existing login; companies may share a contact account.
  if (payload.kind === 'person') {
    if (payload.profile_id) {
      let check = db.from('mzs_lease_relationships').select('id').eq('kind', 'person').eq('profile_id', payload.profile_id);
      if (id) check = check.neq('id', id);
      const {data, error} = await check.limit(1);
      if (error) return {error: 'Could not check existing relationships. Please try again.'};
      if (data?.length) return {error: 'This account already has a relationship. Open that record to extend it.', existingId: data[0].id};
    }
    if (payload.email) {
      // Use exact normalized equality, never a LIKE pattern supplied by a user.
      let check = db.from('mzs_lease_relationships').select('id').eq('kind', 'person').eq('email_normalized', normalizedEmail(payload.email));
      if (id) check = check.neq('id', id);
      const {data, error} = await check.limit(1);
      if (error) return {error: 'Could not check existing relationships. Please try again.'};
      if (data?.length) return {error: 'A person with this email already exists. Open that relationship.', existingId: data[0].id};
    }
  }
  const query = id
    ? db.from('mzs_lease_relationships').update(payload).eq('id', id).eq('version', version)
    : db.from('mzs_lease_relationships').insert(payload);
  const {data, error} = await query.select('id').maybeSingle();
  if (error) return {error: error.code === '23505' ? 'This person or account already exists. Refresh the register and open the existing relationship.' : 'The relationship could not be saved. Check the details and try again.'};
  if (!data) return {error: 'This relationship has changed. Refresh before editing.'};
  revalidatePath('/admin/relationships');
  revalidatePath('/admin/group/estates/contracts');
  revalidatePath('/admin');
  return {id: data.id as string};
}

function validDeletionTarget(kind: string, id: string) {
  return ['account','relationship'].includes(kind) && typeof id==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
}
export async function getRelationshipDeletionPlan(kind: string, id: string) {
  const {db} = await requireEstateAdmin();
  if(!validDeletionTarget(kind,id)) return {error:'Invalid deletion target.'};
  const {data,error}=await db.rpc('mzs_relationship_deletion_plan',{p_kind:kind,p_id:id});
  if(error) return {error:error.code==='P0002'?'This relationship no longer exists. Refresh the register.':'The deletion check could not be completed. No records were removed.'};
  return {plan:data as import('../../../lib/relationships/deletion').DeletionPlan};
}
export async function deleteRelationship(kind: string, id: string, revision: string, confirmation: string) {
  const {db} = await requireEstateAdmin();
  if(!validDeletionTarget(kind,id) || typeof revision!=='string' || !/^[a-f0-9]{32}$/.test(revision) || typeof confirmation!=='string' || !confirmation || confirmation.length>254) return {error:'Run the deletion check and confirm the exact name or email.'};
  const {error}=await db.rpc('mzs_delete_relationship',{p_kind:kind,p_id:id,p_revision:revision,p_confirmation:confirmation});
  if(error) return {error:error.code==='23503'?'Linked records prevent deletion. Run the check again to see what must be retained.':error.code==='40001'?'This relationship changed. Close this dialog and run the deletion check again.':error.code==='22023'?'The confirmation does not match.':error.code==='P0002'?'This relationship no longer exists. Refresh the register.':'Deletion could not be confirmed. Refresh the register before trying again.'};
  revalidatePath('/admin/relationships');revalidatePath('/admin');revalidatePath('/admin/group/estates/contracts');revalidatePath(`/admin/relationships/${id}`);
  return {success:true};
}
