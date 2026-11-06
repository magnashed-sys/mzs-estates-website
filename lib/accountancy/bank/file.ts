import {inflateRawSync} from 'node:zlib';
import {readSheet} from 'read-excel-file/node';
import {MAX_BANK_BYTES,parseBankCsv} from './model';
import type {CsvTable} from '../import-preview';
// Validate actual expansion before the spreadsheet parser sees any XML.
function validateWorkbook(bytes:Buffer){
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0||bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6))throw Error('Unsupported Excel archive');
 const count=bytes.readUInt16LE(end+10);let pos=bytes.readUInt32LE(end+16),total=0;
 if(count>100||count<1)throw Error('Excel archive exceeds limits');
 for(let i=0;i<count;i++){
  if(pos+46>bytes.length||bytes.readUInt32LE(pos)!==0x02014b50)throw Error('Invalid Excel archive');
  const flags=bytes.readUInt16LE(pos+8),method=bytes.readUInt16LE(pos+10),compressed=bytes.readUInt32LE(pos+20),expanded=bytes.readUInt32LE(pos+24),len=bytes.readUInt16LE(pos+28),extra=bytes.readUInt16LE(pos+30),comment=bytes.readUInt16LE(pos+32),local=bytes.readUInt32LE(pos+42);
  const name=bytes.subarray(pos+46,pos+46+len).toString('utf8');
  if(flags&1||![0,8].includes(method)||expanded>8*1024*1024||local+30>bytes.length||bytes.readUInt32LE(local)!==0x04034b50||name.includes('..')||/vbaProject|externalLinks/i.test(name))throw Error('Unsupported Excel content');
  const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);if(start+compressed>bytes.length)throw Error('Invalid Excel archive');
  const data=method===0?bytes.subarray(start,start+compressed):inflateRawSync(bytes.subarray(start,start+compressed),{maxOutputLength:8*1024*1024});total+=data.length;
  if(data.length!==expanded||total>8*1024*1024||name.endsWith('.xml')&&/<(?:\w+:)?f(?:\s|>)/.test(data.toString('utf8')))throw Error('Excel is too large or contains formulas. Export bank values only.');
  pos+=46+len+extra+comment;
 }
}
export async function bankFile(bytes:Buffer,filename:string,delimiter:string,decimal:'.'|','='.'):Promise<CsvTable>{
 if(!bytes.length||bytes.length>MAX_BANK_BYTES)throw Error('Maximum file size is 512 KiB');
 if(/\.xlsx$/i.test(filename)){
  validateWorkbook(bytes);const rows=await readSheet(bytes);
  if(rows.length<2||rows.length>1001||rows.some(r=>r.length>40))throw Error('Maximum 1,000 rows and 40 columns');
  const strings=rows.map(r=>r.map(v=>v===null?'':v instanceof Date?v.toISOString().slice(0,10):typeof v==='number'?String(v).replace('.',decimal):String(v)));
  const width=strings[0].length;if(strings.some(r=>r.length>width))throw Error('Data columns exceed header columns');const csv=strings.map(r=>Array.from({length:width},(_,i)=>'"'+(r[i]??'').replaceAll('"','""')+'"').join(';')).join('\n');return parseBankCsv(csv,';');
 }
 if(!/\.csv$/i.test(filename))throw Error('Use CSV or XLSX. Save older XLS files as XLSX or CSV.');
 return parseBankCsv(new TextDecoder('utf-8',{fatal:true}).decode(bytes),delimiter);
}
