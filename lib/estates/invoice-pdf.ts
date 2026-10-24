import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
export type InvoiceDocument={number:string;issued_on:string;due_date:string;total:number;payload:{subject:string;period_start:string;period_end:string;subtotal:number;tax_total:number;lines:{description:string;net:number;tax:number;total:number;vat:string}[];issuer_registration?:string;snapshot:Record<string,string>}};
export async function invoicePdf(i:InvoiceDocument){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const font=await doc.embedFont(await readFile(path.join(process.cwd(),'lib/estates/fonts/DejaVuSans.ttf')),{subset:true});
 const gold=rgb(.53,.43,.28),ink=rgb(.12,.12,.12);let page=doc.addPage([595,842]),y=790;
 const money=(v:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(Number(v));
 function newPage(){page=doc.addPage([595,842]);y=790;}
 function text(value:string,size=10,color=ink){
  for(const paragraph of String(value||'').split(/\r?\n/)){
   let line='';for(const word of paragraph.split(/\s+/)){for(const ch of (line?' ':'')+word){if(font.widthOfTextAtSize(line+ch,size)>490){if(y<65)newPage();page.drawText(line,{x:50,y,size,font,color});y-=size+5;line='';}line+=ch;}}
   if(y<65)newPage();page.drawText(line,{x:50,y,size,font,color});y-=size+5;
  }
 }
 text('MZS GROUP',16,gold);text('RENTAL INVOICE',22);text(i.number,14,gold);y-=14;
 text(`Invoice date: ${i.issued_on}    Payment due: ${i.due_date}`);text(`Rental period: ${i.payload.period_start} - ${i.payload.period_end}`);y-=12;
 const s=i.payload.snapshot;text('ISSUER',9,gold);text(s.issuer_name,12);text(s.issuer_address);if(s.issuer_tax_id)text(`Tax ID: ${s.issuer_tax_id}`);if(i.payload.issuer_registration)text(`Registration: ${i.payload.issuer_registration}`);text(`IBAN: ${s.issuer_iban}`);y-=12;
 text('BILL TO',9,gold);text(s.tenant_name,12);text(s.tenant_address);if(s.customer_reference)text(`Customer reference: ${s.customer_reference}`);y-=12;text(i.payload.subject,12,gold);y-=8;
 for(const l of i.payload.lines){if(y<110)newPage();text(l.description,11);text(`Net ${money(l.net)}  |  VAT ${l.vat==='exempt'?'Exempt':l.vat+'%'}: ${money(l.tax)}  |  Total ${money(l.total)}`);y-=7;}
 if(y<170)newPage();y-=8;text(`Subtotal: ${money(i.payload.subtotal)}`);text(`VAT: ${money(i.payload.tax_total)}`);y-=6;text(`TOTAL: ${money(i.total)}`,16,gold);y-=12;
 text(`Please transfer to ${s.issuer_iban}, quoting ${i.number}.`);text('Payment must be received before the first day of the rental month.');if(s.payment_conditions)text(s.payment_conditions);
 doc.getPages().forEach((p,n)=>p.drawText(`${i.number}  |  ${n+1} / ${doc.getPageCount()}`,{x:50,y:30,size:8,font,color:gold}));
 doc.setTitle(`${i.number} - ${i.payload.subject}`);doc.setProducer('MZS Group');return Buffer.from(await doc.save());
}
