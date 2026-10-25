'use server';
import {normalizeIssuer,normalizeInvoicePrefix,issuerSaveError} from '../../../../../lib/estates/issuer-profile';

import { revalidatePath } from 'next/cache';
import { requireContractAdmin } from '../../../../../lib/security/estate-contracts';
import {readIssuerPerson} from '../../../../../lib/estates/read-issuer-person';

export async function importIssuerPerson(source:string) {
 const {db,user}=await requireContractAdmin();
 return readIssuerPerson(db,user.id,source);
}

const path = '/admin/group/estates/contracts';
export async function saveContract(input: Record<string, unknown>, id?: string, version?: number) {
  const { db } = await requireContractAdmin();
  const allowed = ['title','property_id','unit_ids','tenant_profile_id','tenant_relationship_id','tenant_name','tenant_address','tenant_email','issuer_id','issuer_name','issuer_address','issuer_iban','issuer_tax_id','contract_date','lease_start','lease_end','first_period','first_generation_date','max_terms','payment_days','payment_conditions','customer_reference','invoice_subject','invoice_language','planning_color','deposit','prorate','lines','notes'];
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


export async function saveIssuer(input:Record<string,unknown>,id?:string,version?:number){
 const {db}=await requireContractAdmin();
 let normalized,prefix;try{normalized=normalizeIssuer(input);if(!id)prefix=normalizeInvoicePrefix(input.prefix);}catch(e){return {error:e instanceof Error?e.message:'Invalid issuer details.'};}
 if(normalized.details.logo){try{const {PDFDocument}=await import('pdf-lib');const doc=await PDFDocument.create();const value=normalized.details.logo;const bytes=Buffer.from(value.split(',')[1], 'base64');const png=value.startsWith('data:image/png;');if(bytes.length>200000||(png&&(bytes.length<24||bytes.readUInt32BE(16)>2000||bytes.readUInt32BE(20)>2000)))throw new Error();const logo=png?await doc.embedPng(bytes):await doc.embedJpg(bytes);if(logo.width>2000||logo.height>2000)throw new Error();}catch{return {error:'Use a valid PNG/JPEG logo up to 200 KB and 2000 × 2000 pixels.'};}}
 const payload={...normalized,relationship_id:input.relationship_id||null,source_company_id:input.source_company_id||null,...(!id?{prefix}:{})};
 const q=id?db.from('mzs_lease_issuers').update(payload).eq('id',id).eq('version',version):db.from('mzs_lease_issuers').insert(payload);
 const {data,error}=await q.select('id').maybeSingle();if(error||!data)return {error:error?issuerSaveError(error):'Issuer changed. Refresh before editing.'};revalidatePath(path);return {id:data.id};
}
export async function issueInvoice(id:string){const {db}=await requireContractAdmin();const {data,error}=await db.rpc('mzs_issue_lease_invoice',{p_draft:id});if(error)return {error:error.message};revalidatePath(path);return {id:data as string};}
export async function sendInvoice(id:string){
 const {db}=await requireContractAdmin();const {data,error}=await db.from('mzs_lease_invoices').select('*').eq('id',id).single();if(error||!data)return {error:'Invoice unavailable.'};
 try{const {prepareInvoiceDelivery}=await import('../../../../../lib/estates/invoice-delivery');const deliver=await prepareInvoiceDelivery(data);
 const {data:token,error:claimError}=await db.rpc('mzs_claim_lease_invoice_mail',{p_id:id});if(claimError)return {error:claimError.message};
 const status=await deliver(id,token);revalidatePath(path);return {status};
 }catch(e){return {error:e instanceof Error?e.message:'Delivery could not be verified.'};}
}
export async function recordPayment(invoice:string,id:string,amount:string,date:string,reference:string){
 const {db}=await requireContractAdmin();if(!/^\d{1,10}(\.\d{1,2})?$/.test(amount))return {error:'Enter an amount with at most two decimal places.'};
 const {error}=await db.rpc('mzs_record_lease_payment',{p_invoice:invoice,p_id:id,p_amount:amount,p_date:date,p_reference:reference});if(error)return {error:error.message};revalidatePath(path);return {ok:true};
}
export async function reversePayment(id:string,reason:string){const {db}=await requireContractAdmin();const {error}=await db.rpc('mzs_reverse_lease_payment',{p_id:id,p_reason:reason});if(error)return {error:error.message};revalidatePath(path);return {ok:true};}
