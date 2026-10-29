'use server';
import {revalidatePath} from 'next/cache';
import {notFound} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../../../lib/security/estate-properties';
import {supplierPaymentEnvironment} from '../../../../../../../lib/accountancy/supplier-payments';
import {uuid,dateValue,ADMINISTRATION_ROOT} from '../../../../../../../lib/accountancy/administration';
import {inputEuroCents} from '../../../../../../../lib/property-operations/expense-preview';
export type PaymentAction={ok:boolean;code?:'invalid'|'review_required'|'exceeds'|'duplicate'|'reversed'|'failed'};
const invalid:PaymentAction={ok:false,code:'invalid'};
function field(f:FormData,key:string,max:number){
 const value=f.get(key);
 if(typeof value!=='string')throw Error('invalid');
 const text=value.trim();
 if(text.length>max||/[\u0000-\u001f\u007f]/.test(text))throw Error('invalid');
 return text;
}
function id(f:FormData,key:string){
 const value=field(f,key,36);
 if(!uuid.test(value))throw Error('invalid');
 return value;
}
function errorCode(message:string):PaymentAction['code']{
 if(/reviewed first|must be reviewed/i.test(message))return 'review_required';
 if(/exceeds remaining/i.test(message))return 'exceeds';
 if(/active payment.*reference/i.test(message))return 'duplicate';
 if(/was reversed|already reversed/i.test(message))return 'reversed';
 return 'failed';
}
async function assertYear(db:Awaited<ReturnType<typeof requireEstateAdmin>>['db'],yearId:string,draftId:string){
 const [year,draft]=await Promise.all([
  db.from('mzs_accountancy_years').select('issuer_id,fiscal_year').eq('id',yearId).single(),
  db.from('mzs_ops_expense_drafts').select('legal_entity_id,invoice_date').eq('id',draftId).single()
 ]);
 if(year.error||draft.error||!year.data||!draft.data||
  draft.data.legal_entity_id!==year.data.issuer_id||
  Number(draft.data.invoice_date.slice(0,4))!==year.data.fiscal_year)throw Error('invalid');
}
export async function recordSupplierPayment(form:FormData):Promise<PaymentAction>{
 if(!supplierPaymentEnvironment())notFound();
 const {db}=await requireEstateAdmin();
 let requestId:string,draftId:string,yearId:string,paidOn:string,amount:number,reference:string;
 try{
  if(form.get('confirmed_existing_transfer')!=='yes')throw Error('invalid');
  requestId=id(form,'request_id');draftId=id(form,'draft_id');yearId=id(form,'year_id');
  paidOn=dateValue(field(form,'paid_on',10));reference=field(form,'reference',200);
  amount=inputEuroCents(field(form,'amount_eur',20));
  if(reference.length<3||!Number.isSafeInteger(amount)||amount<=0||amount>100_000_000_000)throw Error('invalid');
  await assertYear(db,yearId,draftId);
 }catch{return invalid;}
 const {error}=await db.rpc('mzs_record_supplier_payment',{
  p_id:requestId,p_draft:draftId,p_amount_cents:amount,p_paid_on:paidOn,p_reference:reference
 });
 if(error)return {ok:false,code:errorCode(error.message)};
 revalidatePath(ADMINISTRATION_ROOT+'/'+yearId);
 revalidatePath(ADMINISTRATION_ROOT+'/'+yearId+'/payments');
 return {ok:true};
}
export async function reverseSupplierPayment(form:FormData):Promise<PaymentAction>{
 if(!supplierPaymentEnvironment())notFound();
 const {db}=await requireEstateAdmin();
 let paymentId:string,draftId:string,yearId:string,reason:string;
 try{
  paymentId=id(form,'payment_id');draftId=id(form,'draft_id');yearId=id(form,'year_id');
  reason=field(form,'reason',500);
  if(reason.length<8)throw Error('invalid');
  await assertYear(db,yearId,draftId);
 }catch{return invalid;}
 const {error}=await db.rpc('mzs_reverse_supplier_payment',{p_id:paymentId,p_draft:draftId,p_reason:reason});
 if(error)return {ok:false,code:errorCode(error.message)};
 revalidatePath(ADMINISTRATION_ROOT+'/'+yearId);
 revalidatePath(ADMINISTRATION_ROOT+'/'+yearId+'/payments');
 return {ok:true};
}
