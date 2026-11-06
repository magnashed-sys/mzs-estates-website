'use server';
import {createHash} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../../../../../lib/security/estate-properties';
import {uuid,ADMINISTRATION_ROOT} from '../../../../../../../lib/accountancy/administration';
import {bankFile} from '../../../../../../../lib/accountancy/bank/file';
import {bankPreview,MAX_BANK_BYTES,type BankOptions} from '../../../../../../../lib/accountancy/bank/model';
function text(f:FormData,k:string,max=1000){const v=f.get(k);if(typeof v!=='string'||v.length>max)throw Error('Invalid input');return v;}
function id(f:FormData,k:string){const v=text(f,k,36);if(!uuid.test(v))throw Error('Invalid ID');return v;}
async function read(f:FormData){const file=f.get('file');if(!(file instanceof File)||file.size>MAX_BANK_BYTES)throw Error('Use a CSV or XLSX file up to 512 KiB');const options=JSON.parse(text(f,'options',3000)) as BankOptions;return {file,options,bytes:Buffer.from(await file.arrayBuffer())};}
export async function previewBankFile(f:FormData){
 await requireEstateAdmin();try{const {file,options,bytes}=await read(f);return {ok:true as const,table:await bankFile(bytes,file.name,options.delimiter,options.decimal)};}catch(e){return {ok:false as const,error:(e as Error).message};}
}
function safeError(message:string){
 for(const known of ['Reverse all allocations before voiding the import','File already imported','Possible duplicate bank transaction','Request ID conflict','Allocation exceeds remaining bank amount','Allocation exceeds invoice total','Record the evidenced opening balance first','An opening balance already exists','Source file hash mismatch','Allocation was reversed','Transaction date outside permitted period','Allocation date outside permitted period'])if(message.includes(known))return known;
 return 'Could not save. Check the selected entity, dates, amounts and references.';
}
export async function saveBank(f:FormData){
 const {db}=await requireEstateAdmin();let yearId='';try{
  yearId=id(f,'year_id');const action=text(f,'action',20),requestId=id(f,'id');let payload:Record<string,unknown>;
  if(action==='import'){
   if(f.get('confirmed')!=='yes')throw Error('Confirm the reviewed import first');
   const {file,options,bytes}=await read(f);const {data:y,error}=await db.from('mzs_accountancy_years').select('fiscal_year').eq('id',yearId).single();if(error||!y)throw Error('Administration unavailable');
   const result=bankPreview(await bankFile(bytes,file.name,options.delimiter,options.decimal),options,y.fiscal_year);if(result.errors.length)throw Error('Resolve all import errors first');
   payload={account_id:id(f,'account_id'),filename:file.name.replace(/[^\p{L}\p{N}_. -]/gu,'_').slice(0,150),sha256:createHash('sha256').update(bytes).digest('hex'),raw_base64:bytes.toString('base64'),rows:result.rows};
  }else{
   payload=JSON.parse(text(f,'payload',12000));if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid input');
   if(action==='account'){
    const iban=String(payload.iban??'').replace(/\s/g,'').toUpperCase();if(!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban))throw Error('Invalid IBAN');let mod=0;for(const c of iban.slice(4)+iban.slice(0,4)){const digits=/[A-Z]/.test(c)?String(c.charCodeAt(0)-55):c;for(const d of digits)mod=(mod*10+Number(d))%97;}if(mod!==1)throw Error('Invalid IBAN checksum');payload.iban=iban;
   }
  }
  const {error}=await db.rpc('mzs_bank_write',{p_action:action,p:{...payload,id:requestId,year_id:yearId}});if(error)return {ok:false,error:safeError(error.message)};
  revalidatePath(ADMINISTRATION_ROOT+'/'+yearId);revalidatePath(ADMINISTRATION_ROOT+'/'+yearId+'/bank');return {ok:true,error:''};
 }catch(e){return {ok:false,error:safeError((e as Error).message)};}
}
