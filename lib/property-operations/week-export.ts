import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
export type FrozenVisit={worked_on:string;location:string;unit:string;category:string;description:string;actual_minutes:number;approved_minutes:number;visit_id:string};
export type ClosedWeekReport={name:string;week:string;closedAt:string;approvedBy:string;closeNote:string;rows:FrozenVisit[];totalMinutes:number;eventId:string};
const ascii=(value:string)=>String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'?');
const cleanXml=(value:string)=>String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const duration=(minutes:number)=>Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0');
function crc32(bytes:Buffer){
 let crc=0xffffffff;
 for(const b of bytes){crc^=b;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
function storeZip(files:{name:string;content:string}[]){
 const local:Buffer[]=[],central:Buffer[]=[];let offset=0,centralBytes=0;
 for(const file of files){
  const name=Buffer.from(file.name,'utf8'),data=Buffer.from(file.content,'utf8'),crc=crc32(data);
  const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);
  lh.writeUInt32LE(crc,14);lh.writeUInt32LE(data.length,18);lh.writeUInt32LE(data.length,22);lh.writeUInt16LE(name.length,26);
  local.push(lh,name,data);
  const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);
  ch.writeUInt32LE(crc,16);ch.writeUInt32LE(data.length,20);ch.writeUInt32LE(data.length,24);
  ch.writeUInt16LE(name.length,28);ch.writeUInt32LE(offset,42);
  central.push(ch,name);centralBytes+=ch.length+name.length;offset+=lh.length+name.length+data.length;
 }
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(centralBytes,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,...central,end]);
}
export function weekWorkbook(r:ClosedWeekReport):Buffer{
 const fields:(string|number)[][]=[
 ['MZS GROUP · CLOSED STAFF WEEK'],
 ['Staff',r.name],['Week starting',r.week],['Closure timestamp',r.closedAt],
 ['Approved by',r.approvedBy],['Closure record ID',r.eventId],
 [''],
 ['Work date','Work location','Unit','Category','Work performed','Original minutes','Approved minutes','Visit reference'],
 ...r.rows.map(v=>[v.worked_on,v.location,v.unit,v.category,v.description,v.actual_minutes,v.approved_minutes,v.visit_id]),
 ['TOTAL','','','','','',r.totalMinutes]
 ];
 const rowXml=fields.map((fields,i)=>'<row r="'+(i+1)+'">'+fields.map((value,j)=>{
  const col=String.fromCharCode(65+j),address=col+(i+1);
  return typeof value==='number'?'<c r="'+address+'"><v>'+value+'</v></c>':
   '<c r="'+address+'" t="inlineStr"><is><t>'+cleanXml(value)+'</t></is></c>';
 }).join('')+'</row>').join('');
 const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rowXml+'</sheetData></worksheet>';
 const workbook='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Approved hours" sheetId="1" r:id="rId1"/></sheets></workbook>';
 const rel='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
 const rootRel='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
 return storeZip([{name:'[Content_Types].xml',content:types},{name:'_rels/.rels',content:rootRel},
  {name:'xl/workbook.xml',content:workbook},{name:'xl/_rels/workbook.xml.rels',content:rel},
  {name:'xl/worksheets/sheet1.xml',content:sheet}]);
}
export async function weekPdf(r:ClosedWeekReport):Promise<Uint8Array>{
 const pdf=await PDFDocument.create();pdf.setTitle('MZS Group - approved staff week '+r.week);pdf.setAuthor('MZS Group');
 const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.16,.19,.24),muted=rgb(.40,.43,.48),line=rgb(.73,.71,.65),gold=rgb(.65,.51,.31);
 let page=pdf.addPage([595.28,841.89]),y=770;
 const text=(str:string,x:number,at:number,size=9,strong=false)=>{
  page.drawText(ascii(str).slice(0,110),{x,y:at,size,font:strong?bold:font,color:strong?ink:muted});
 };
 const header=()=>{
  page.drawLine({start:{x:42,y:790},end:{x:553,y:790},thickness:1.5,color:gold});
  text('MZS GROUP | APPROVED STAFF TIME',43,803,13,true);y=754;
  text(r.name,43,y,16,true);y-=25;
  text('Week of '+r.week+' | Approved '+duration(r.totalMinutes)+' | '+r.rows.length+' visits',43,y,10,true);y-=22;
  text('Closed: '+r.closedAt.slice(0,19)+' | Approved by: '+r.approvedBy,43,y,9);y-=24;
  text('Date',43,y,9,true);text('Location / Work description',112,y,9,true);
  text('Actual',453,y,8,true);text('Approved',503,y,8,true);y-=14;
  page.drawLine({start:{x:42,y},end:{x:553,y},color:line,thickness:.6});y-=18;
 };
 header();
 for(const v of r.rows){
  if(y<85){page=pdf.addPage([595.28,841.89]);y=770;header();}
  text(v.worked_on,43,y,8);text(v.location.slice(0,45),112,y,8);
  text(String(v.actual_minutes),458,y,8);text(String(v.approved_minutes),510,y,8,true);y-=12;
  text(v.description.slice(0,74),112,y,7);y-=23;
 }
 if(y<90){page=pdf.addPage([595.28,841.89]);y=770;header();}
 page.drawLine({start:{x:42,y},end:{x:553,y},color:gold,thickness:1});y-=20;
 text('TOTAL APPROVED TIME',310,y,10,true);text(duration(r.totalMinutes),495,y,10,true);
 text('Closure reference: '+r.eventId,43,52,8);
 return pdf.save();
}
