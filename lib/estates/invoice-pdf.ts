import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {IssuerDetails} from './issuer-profile';
export type InvoiceDocument={number:string;issued_on:string;due_date:string;total:number;payload:{subject:string;period_start:string;period_end:string;subtotal:number;tax_total:number;lines:{description:string;net:number;tax:number;total:number;vat:string}[];issuer_registration?:string;snapshot:Record<string,string>&{issuer_details?:IssuerDetails}}};
export async function invoicePdf(i:InvoiceDocument,kind:'rental'|'service'='rental'){
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
 const details=i.payload.snapshot.issuer_details||{};
 if(details.logo){
  try{const bytes=Buffer.from(details.logo.split(',')[1]||'', 'base64');
   const isPng=details.logo.startsWith('data:image/png;');
   if(bytes.length>200000||(isPng&&(bytes.length<24||bytes.readUInt32BE(16)>2000||bytes.readUInt32BE(20)>2000)))throw new Error('Invalid logo dimensions');
   const logo=isPng?await doc.embedPng(bytes):await doc.embedJpg(bytes);
   if(logo.width>2000||logo.height>2000)throw new Error('Invalid logo dimensions');
   const scale=Math.min(140/logo.width,55/logo.height,1);page.drawImage(logo,{x:50,y:y-logo.height*scale,width:logo.width*scale,height:logo.height*scale});y-=logo.height*scale+15;
  }catch{throw new Error('The saved issuer logo is invalid. Review it before issuing invoices.');}
 }
 if(kind==='rental')text('MZS GROUP',16,gold);text(kind==='service'?'INVOICE':'RENTAL INVOICE',22);text(i.number,14,gold);y-=14;
 text(`Invoice date: ${i.issued_on}    Payment due: ${i.due_date}`);if(kind==='rental')text(`Rental period: ${i.payload.period_start} - ${i.payload.period_end}`);y-=12;
 const s=i.payload.snapshot;text('ISSUER',9,gold);text(s.issuer_name,12);text(s.issuer_address);if(s.issuer_tax_id)text(`Tax ID: ${s.issuer_tax_id}`);if(i.payload.issuer_registration)text(`Registration: ${i.payload.issuer_registration}`);text(`IBAN: ${s.issuer_iban}`);
 for(const [label,value] of [['Trading name',details.trading_name],['Legal form',details.legal_form],['Country',details.country],['Contact',details.contact_name],['Email',details.email],['Telephone',details.phone],['Website',details.website],['Account holder',details.account_holder],['BIC / SWIFT',details.bic],['Billing address',details.billing_address]])if(value)text(`${label}: ${value}`);y-=12;
 text('BILL TO',9,gold);text(s.tenant_name,12);if(s.tenant_attention)text(`Attn: ${s.tenant_attention}`);text(s.tenant_address);if(s.tenant_tax_id)text(`Tax ID: ${s.tenant_tax_id}`);if(s.customer_reference)text(`Customer reference: ${s.customer_reference}`);y-=12;text(i.payload.subject,12,gold);y-=8;
 for(const l of i.payload.lines){if(y<110)newPage();text(l.description,11);text(`Net ${money(l.net)}  |  VAT ${l.vat==='exempt'?'Exempt':l.vat+'%'}: ${money(l.tax)}  |  Total ${money(l.total)}`);y-=7;}
 if(y<170)newPage();y-=8;text(`Subtotal: ${money(i.payload.subtotal)}`);text(`VAT: ${money(i.payload.tax_total)}`);y-=6;text(`TOTAL: ${money(i.total)}`,16,gold);y-=12;
 text(`Please transfer to ${s.issuer_iban}, quoting ${i.number}.`);if(kind==='rental')text('Payment must be received before the first day of the rental month.');if(s.payment_conditions)text(s.payment_conditions);if(details.payment_instructions)text(details.payment_instructions);
 doc.getPages().forEach((p,n)=>p.drawText(`${i.number}  |  ${n+1} / ${doc.getPageCount()}`,{x:50,y:30,size:8,font,color:gold}));
 doc.setTitle(`${i.number} - ${i.payload.subject}`);doc.setProducer(kind==='service'?i.payload.snapshot.issuer_name:'MZS Group');return Buffer.from(await doc.save());
}
