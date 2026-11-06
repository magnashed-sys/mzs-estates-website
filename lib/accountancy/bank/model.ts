import {dateValue} from '../administration';
import {parseImportCsv,type CsvTable} from '../import-preview';
export const MAX_BANK_BYTES=512*1024,MAX_BANK_ROWS=1000;
export const bankFields={date:'Booking date',description:'Description',amount:'Signed amount',debit:'Debit / outgoing',credit:'Credit / incoming',reference:'Bank transaction ID (optional)',balance:'Balance (optional)',currency:'Currency (optional)'};
export type BankMapping=Record<keyof typeof bankFields,number>;
export type BankOptions={delimiter:string;decimal:'.'|',';dateFormat:'iso'|'dmy';mapping:BankMapping};
export type BankRow={row:number;booked_on:string;description:string;amount_cents:number;reference:string;balance_cents:number|null};
export type BankAccount={id:string;issuer_id:string;name:string;iban:string;opening_on:string;opening_cents:number;evidence:string};
export type BankTransaction=BankRow&{id:string;account_id:string;batch_id:string;fingerprint:string;voided_at?:string|null};
export type Allocation={id:string;transaction_id:string|null;issuer_id:string;booked_on:string;kind:string;amount_cents:number;target_source:string|null;target_id:string|null;person_id:string|null;note:string;created_at:string;reversed_at:string|null};
export type BankSnapshot={issuer_id:string;year:number;accounts:BankAccount[];batches:{id:string;account_id:string;filename:string;sha256:string;raw_base64?:string;created_at:string;voided_at?:string|null;void_reason?:string|null}[];transactions:BankTransaction[];allocations:Allocation[];people:{id:string;name:string}[];targets:{id:string;source:string;number:string;issued_on:string;gross_cents:number;allocated_cents:number}[]};
export function cents(raw:string,decimal:'.'|','):number{
 let v=raw.trim().replace(/\u00a0/g,' ');if(!v)throw Error('Amount is required');
 const sign=v.startsWith('-')?-1:1;v=v.replace(/^[+-]/,'');
 const group=decimal===','?'.':',';
 if(v.includes(group)){const pattern=decimal===','?/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/:/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/;if(!pattern.test(v))throw Error('Invalid thousands separator');v=v.split(group).join('');}
 const pattern=decimal===','?/^\d{1,10}(,\d{1,2})?$/:/^\d{1,10}(\.\d{1,2})?$/;
 if(!pattern.test(v))throw Error('Invalid amount');const [a,b='']=v.split(decimal),n=sign*(Number(a)*100+Number(b.padEnd(2,'0')));if(!Number.isSafeInteger(n)||Math.abs(n)>100_000_000_000)throw Error('Amount exceeds limit');return n;
}
export function suggestMapping(headers:string[]):BankMapping{
 const names:Record<string,string[]>={date:['date','fecha','booking date','boekdatum','datum','fecha operacion'],description:['description','descripcion','concepto','omschrijving','concept'],amount:['amount','importe','bedrag','signed amount'],debit:['debit','debe','cargo','af'],credit:['credit','haber','abono','bij'],reference:['reference','referencia','transaction id','referentie'],balance:['balance','saldo'],currency:['currency','moneda','valuta']};
 const norm=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();return Object.fromEntries(Object.keys(bankFields).map(k=>[k,headers.findIndex(h=>names[k].includes(norm(h)))])) as BankMapping;
}
export function bankPreview(table:CsvTable,options:BankOptions,year:number){
 const {mapping:m,decimal,dateFormat}=options;
 if(![',','.'].includes(decimal)||!['iso','dmy'].includes(dateFormat)||!m||table.rows.length>MAX_BANK_ROWS)throw Error('Invalid import settings');
 const selected=Object.keys(bankFields).map(k=>m[k as keyof BankMapping]);
 if(selected.some(n=>!Number.isInteger(n)||n< -1||n>=table.headers.length)||new Set(selected.filter(n=>n>=0)).size!==selected.filter(n=>n>=0).length||m.date<0||m.description<0||!(m.amount>=0&&m.debit<0&&m.credit<0||m.amount<0&&m.debit>=0&&m.credit>=0))throw Error('Select date and description, then either signed amount OR debit and credit columns');
 const rows:BankRow[]=[],errors:{row:number;message:string}[]=[];
 table.rows.forEach((r,index)=>{const get=(k:keyof BankMapping)=>m[k]>=0?(r[m[k]]??'').trim():'';try{
  let date=get('date');if(dateFormat==='dmy'&&/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(date)){const [d,mo,y]=date.split(/[/-]/);date=`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;}dateValue(date);if(Number(date.slice(0,4))!==year)throw Error('Date is outside this financial year');
  let amount:number;if(m.amount>=0)amount=cents(get('amount'),decimal);else{const debit=get('debit')?cents(get('debit'),decimal):0,credit=get('credit')?cents(get('credit'),decimal):0;if(debit<0||credit<0||debit&&credit)throw Error('Use positive debit OR credit');amount=credit-debit;}if(!amount)throw Error('Zero amount');
  const description=get('description'),reference=get('reference');if(!description||description.length>1000||reference.length>200||/[\u0000-\u001f\u007f]/.test(description+reference))throw Error('Invalid description or reference');
  if(m.currency>=0&&get('currency').toUpperCase()!=='EUR')throw Error('Only EUR is supported');
  rows.push({row:index+2,booked_on:date,description,reference,amount_cents:amount,balance_cents:m.balance>=0&&get('balance')?cents(get('balance'),decimal):null});
 }catch(e){errors.push({row:index+2,message:(e as Error).message});}});
 const keys=new Map<string,number>();for(const r of rows){const key=JSON.stringify([r.booked_on,r.amount_cents,r.description,r.reference]);if(keys.has(key))errors.push({row:r.row,message:'Identical transaction in this file. Use the unique bank transaction ID to distinguish genuine duplicates.'});keys.set(key,r.row);}
 return {rows,errors,total_cents:rows.reduce((a,r)=>a+r.amount_cents,0)};
}
export function parseBankCsv(raw:string,delimiter:string){return parseImportCsv(raw,delimiter);}
export function remaining(tx:BankTransaction,allocations:Allocation[]){return tx.voided_at?0:Math.abs(tx.amount_cents)-allocations.filter(a=>a.transaction_id===tx.id&&!a.reversed_at).reduce((n,a)=>n+Math.abs(a.amount_cents),0);}
export function currentAccountBalance(allocations:Allocation[],person:string,before?:string){return allocations.filter(a=>a.person_id===person&&!a.reversed_at&&(!before||a.booked_on<before)).reduce((n,a)=>n+a.amount_cents,0);}
