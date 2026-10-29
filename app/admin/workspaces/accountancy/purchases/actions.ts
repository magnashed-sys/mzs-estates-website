'use server';
import {revalidatePath} from 'next/cache';
import {requirePdfAdmin} from '../../../../../lib/accountancy/pdf/server';
import {PDF_ROOT} from '../../../../../lib/accountancy/pdf/model';
import {uuid,dateValue,textField,costCategories,ADMINISTRATION_ROOT} from '../../../../../lib/accountancy/administration';
import {inputEuroCents} from '../../../../../lib/property-operations/expense-preview';
export async function decidePdf(f:FormData):Promise<{ok:boolean;code?:string}>{
 const {db}=await requirePdfAdmin();let intake,result,reason,accept,fields;
 try{
  intake=textField(f,'intake',36,36);result=textField(f,'result',36,36);reason=textField(f,'reason',2000,5);const action=textField(f,'decision',10);if(!uuid.test(intake)||!uuid.test(result)||!['accept','reject'].includes(action))throw Error();accept=action==='accept';fields={};
  if(accept){const supplier=textField(f,'supplier',36,36),property=textField(f,'property',36),project=textField(f,'project',36),category=textField(f,'category',30),currency=textField(f,'currency',3,3);
   const net=inputEuroCents(textField(f,'net',20,1)),vat=inputEuroCents(textField(f,'vat',20,1)),gross=inputEuroCents(textField(f,'gross',20,1));
   if(!uuid.test(supplier)||property&&!uuid.test(property)||project&&!uuid.test(project)||!(category in costCategories)||currency!=='EUR'||net+vat!==gross||gross<=0||f.get('original_checked')!=='on'||f.get('entity_checked')!=='on')throw Error();
   fields={supplier,property,project,category,currency,net,vat,gross,number:textField(f,'number',100,1),date:dateValue(textField(f,'date',10,10)),description:textField(f,'description',500,2),original_checked:true,entity_checked:true};
  }
 }catch{return {ok:false,code:'invalid'};}
 const {error}=await db.rpc('mzs_confirm_purchase_pdf',{p_intake:intake,p_result:result,p_fields:fields,p_reason:reason,p_accept:accept});
 if(error)return {ok:false,code:error.code==='23505'?'duplicate':error.message.includes('paying entity')?'payer':'failed'};
 revalidatePath(PDF_ROOT);revalidatePath(PDF_ROOT+'/'+intake);revalidatePath(ADMINISTRATION_ROOT,'layout');revalidatePath('/admin/workspaces/estates/expenses');revalidatePath('/admin/workspaces/estates/reports');return {ok:true};
}
