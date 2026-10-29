import {costCategories,dateValue} from './administration';

export const MAX_IMPORT_BYTES=2*1024*1024;
export const MAX_IMPORT_ROWS=1000;
export const importFields={entity:'Entity reference',supplier:'Supplier reference',number:'Invoice number',date:'Invoice date',description:'Description',net:'Net amount',vat:'Original VAT',gross:'Gross amount',currency:'Currency',category:'Cost category',property:'Property reference (optional)'} as const;
export type ImportField=keyof typeof importFields;
export type Mapping=Record<ImportField,number>;
export type CsvTable={headers:string[];rows:string[][]};
export type Reference={id:string;name:string};
export type ImportContext={year:number;entity:Reference&{tax_id?:string|null};suppliers:Reference[];properties:Reference[];existing:{supplier_relationship_id:string;supplier_invoice_number:string}[]};
export type PreviewRow={row:number;number:string;supplier:string;gross:number|null;errors:string[]};
const control=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const own=(object:object,key:string)=>Object.prototype.hasOwnProperty.call(object,key);
const normal=(s:string)=>s.trim().toLocaleLowerCase('en');

/** Strict bounded CSV parser. No format sniffing, formulas, coercion or silent row loss. */
export function parseImportCsv(text:string,delimiter:string):CsvTable{
 if(![',',';','\t'].includes(delimiter)||new TextEncoder().encode(text).length>MAX_IMPORT_BYTES||control.test(text)||text.includes('\uFFFD'))throw Error('Invalid file or file exceeds 2 MB.');
 text=text.replace(/^\uFEFF/,'');
 const records:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 const endCell=()=>{row.push(cell);cell='';closed=false;if(row.length>40)throw Error('Maximum 40 columns.');};
 const endRow=()=>{endCell();if(row.some(c=>c.trim()))records.push(row);row=[];if(records.length>MAX_IMPORT_ROWS+1)throw Error('Maximum 1,000 data rows.');};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
  else if(c===delimiter)endCell();
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;endRow();}
  else if(c==='"'&&!cell&&!closed)quoted=true;
  else if(c==='"'||closed)throw Error('Invalid CSV quoting.');
  else cell+=c;
  if(cell.length>4000)throw Error('A cell exceeds 4,000 characters.');
 }
 if(quoted)throw Error('Invalid CSV quoting.');
 if(cell||row.length||closed)endRow();
 const headers=records.shift()?.map(s=>s.trim());
 if(!headers?.length||headers.some(s=>!s)||new Set(headers.map(normal)).size!==headers.length)throw Error('Use unique, non-empty column headers.');
 if(!records.length)throw Error('No data rows found.');
 if(records.some(r=>r.length!==headers.length))throw Error('Rows have different column counts. Check the delimiter.');
 return {headers,rows:records};
}
export function defaultMapping(headers:string[]):Mapping{
 return Object.fromEntries(Object.keys(importFields).map(k=>[k,headers.findIndex(h=>normal(h)===k)])) as Mapping;
}
export function importCents(raw:string,decimal:'.'|','):number{
 const v=raw.trim(),pattern=decimal==='.'?/^\d{1,9}(\.\d{1,2})?$/:/^\d{1,9}(,\d{1,2})?$/;
 if(!pattern.test(v))throw Error('Invalid amount');
 const [a,b='']=v.split(decimal),c=Number(a)*100+Number(b.padEnd(2,'0'));
 if(!Number.isSafeInteger(c)||c>100_000_000_000)throw Error('Invalid amount');return c;
}
function reference(raw:string,options:Reference[]):Reference|undefined{
 const matches=options.filter(o=>normal(o.id)===normal(raw)||normal(o.name)===normal(raw));
 return matches.length===1?matches[0]:undefined;
}
export function previewImport(table:CsvTable,mapping:Mapping,context:ImportContext,decimal:'.'|',',dateFormat:'iso'|'dmy'){
 const keys=Object.keys(importFields) as ImportField[],selected=keys.map(k=>mapping[k]).filter(n=>n!==-1);
 if(keys.some(k=>k!=='property'&&(!Number.isInteger(mapping[k])||mapping[k]<0||mapping[k]>=table.headers.length))||selected.some(n=>!Number.isInteger(n)||n<0||n>=table.headers.length)||new Set(selected).size!==selected.length)throw Error('Map each required field to a different column.');
 if(!['.',','].includes(decimal)||!['iso','dmy'].includes(dateFormat))throw Error('Invalid format.');
 const existing=new Set(context.existing.map(c=>JSON.stringify([c.supplier_relationship_id,c.supplier_invoice_number.trim().toUpperCase()]))),batch=new Map<string,PreviewRow[]>();
 const rows:PreviewRow[]=table.rows.map((r,index)=>{
  const value=(k:ImportField)=>mapping[k]>=0?r[mapping[k]].trim():'';
  const errors:string[]=[],number=value('number'),supplier=reference(value('supplier'),context.suppliers);
  if(![context.entity.id,context.entity.name,context.entity.tax_id].some(x=>x&&normal(x)===normal(value('entity'))))errors.push('Entity does not match this administration.');
  if(!supplier)errors.push('Supplier is missing, unknown or ambiguous.');
  if(!number||number.length>100||/[\r\n\t]/.test(number))errors.push('Invalid invoice number.');
  let date=value('date');if(dateFormat==='dmy'&&/^\d{2}\/\d{2}\/\d{4}$/.test(date)){const [d,m,y]=date.split('/');date=`${y}-${m}-${d}`;}else if(dateFormat==='dmy')date='';
  try{dateValue(date);if(Number(date.slice(0,4))!==context.year)errors.push('Invoice date is outside this financial year.');}catch{errors.push('Invalid invoice date.');}
  if(!value('description')||value('description').length>2000)errors.push('Description is required (maximum 2,000 characters).');
  if(value('currency')!=='EUR')errors.push('Only explicit EUR amounts are supported.');
  if(!own(costCategories,value('category')))errors.push('Unknown category code.');
  const property=value('property');if(property&&!reference(property,context.properties))errors.push('Property is unknown or ambiguous.');
  if(property)errors.push('Property costs require dated paying-entity verification before import.');
  let gross:number|null=null;
  try{const net=importCents(value('net'),decimal),vat=importCents(value('vat'),decimal);gross=importCents(value('gross'),decimal);if(net+vat!==gross)errors.push('Net plus VAT does not equal gross.');if(gross===0)errors.push('Zero-value costs require manual review.');}catch{errors.push('Invalid amount. Use the selected decimal separator without thousands separators.');}
  const result={row:index+2,number,supplier:supplier?.name??value('supplier'),gross,errors};
  if(supplier&&number){const key=JSON.stringify([supplier.id,number.toUpperCase()]);if(existing.has(key))errors.push('Invoice already exists for this entity and supplier.');batch.set(key,[...(batch.get(key)??[]),result]);}
  return result;
 });
 for(const duplicates of batch.values())if(duplicates.length>1)for(const r of duplicates)r.errors.push('Duplicate invoice within this file.');
 const eligible=rows.filter(r=>!r.errors.length),gross=eligible.reduce((sum,r)=>sum+(r.gross??0),0);
 if(!Number.isSafeInteger(gross))throw Error('Total exceeds the supported range.');
 return {rows,eligible:eligible.length,blocked:rows.length-eligible.length,gross};
}
