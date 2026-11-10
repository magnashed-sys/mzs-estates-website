import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {IssuerDetails} from './issuer-profile';
import {validateLeaseCleaning,type LeaseCleaning} from './lease-cleaning';
export type InvoiceDocument={number:string;issued_on:string;due_date:string;total:number;payload:{subject:string;period_start:string;period_end:string;subtotal:number;tax_total:number;lines:{source?:string;description:string;net:number;tax:number;total:number;vat:string}[];issuer_registration?:string;snapshot:Record<string,string>&{issuer_details?:IssuerDetails;cleaning?:LeaseCleaning}}};
export async function invoicePdf(i:InvoiceDocument,kind:'rental'|'service'|'credit'='rental'){
 const cleaning=kind==='rental'?i.payload.snapshot.cleaning:undefined;
 if(kind==='rental')validateLeaseCleaning(cleaning,i.payload.lines);
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
 if(kind==='rental')text('MZS GROUP',16,gold);text(kind==='credit'?'CREDIT NOTE':kind==='service'?'INVOICE':'RENTAL INVOICE',22);text(i.number,14,gold);y-=14;
 text(kind==='credit'?`Credit date: ${i.issued_on}`:`Invoice date: ${i.issued_on}    Payment due: ${i.due_date}`);if(kind==='rental')text(`Rental period: ${i.payload.period_start} - ${i.payload.period_end}`);y-=12;
 const s=i.payload.snapshot;text('ISSUER',9,gold);text(s.issuer_name,12);text(s.issuer_address);if(s.issuer_tax_id)text(`Tax ID: ${s.issuer_tax_id}`);if(i.payload.issuer_registration)text(`Registration: ${i.payload.issuer_registration}`);text(`IBAN: ${s.issuer_iban}`);
 for(const [label,value] of [['Trading name',details.trading_name],['Legal form',details.legal_form],['Country',details.country],['Contact',details.contact_name],['Email',details.email],['Telephone',details.phone],['Website',details.website],['Account holder',details.account_holder],['BIC / SWIFT',details.bic],['Billing address',details.billing_address]])if(value)text(`${label}: ${value}`);y-=12;
 text('BILL TO',9,gold);text(s.tenant_name,12);if(s.tenant_attention)text(`Attn: ${s.tenant_attention}`);text(s.tenant_address);if(s.tenant_tax_id)text(`Tax ID: ${s.tenant_tax_id}`);if(s.customer_reference)text(`Customer reference: ${s.customer_reference}`);y-=12;text(i.payload.subject,12,gold);y-=8;
 for(const l of i.payload.lines){if(y<110)newPage();text(l.description,11);text(`Net ${money(l.net)}  |  VAT ${l.vat==='exempt'?'Exempt':l.vat+'%'}: ${money(l.tax)}  |  Total ${money(l.total)}`);y-=7;}
 if(y<170)newPage();y-=8;text(`Subtotal: ${money(i.payload.subtotal)}`);text(`VAT: ${money(i.payload.tax_total)}`);y-=6;text(`TOTAL: ${money(i.total)}`,16,gold);y-=12;
 if(kind==='credit')text('Allocated to the original invoice. This credit note does not confirm a bank refund.');else text(`Please transfer to ${s.issuer_iban}, quoting ${i.number}.`);if(kind==='rental')text('Payment must be received before the first day of the rental month.');if(kind!=='credit'&&s.payment_conditions)text(s.payment_conditions);if(kind!=='credit'&&details.payment_instructions)text(details.payment_instructions);
 if(cleaning?.entries.length){
  const euro=(c:number)=>(c/100).toLocaleString('nl-NL',{style:'currency',currency:'EUR'});
  function attachmentPage(){
   newPage();text('BIJLAGE 1 - URENSTAAT',16,gold);text(`Bij factuur ${i.number}`,10);text(cleaning!.customer_reference,9);y-=10;
   for(const [x,label] of [[50,'DATUM'],[115,'WERKZAAMHEDEN'],[350,'MIN.'],[400,'UREN'],[442,'TARIEF'],[505,'BEDRAG']] as const)page.drawText(label,{x,y,size:8,font,color:gold});y-=20;
  }
  attachmentPage();
  for(const e of cleaning.entries){
   const wrapped:string[]=[];let row='';
   for(const ch of e.description.replace(/\s+/g,' ')){
    if(font.widthOfTextAtSize(row+ch,8)>220){wrapped.push(row);row='';}row+=ch;
   }wrapped.push(row);
   let first=true;
   while(wrapped.length){
    if(y<100)attachmentPage();
    if(first){
     const values:[[number,string],[number,string],[number,string],[number,string],[number,string]]=[[50,e.worked_on.split('-').reverse().join('-')],[350,String(e.approved_minutes)],[400,String(e.hours)],[442,euro(e.rate_cents)],[505,euro(e.net_cents)]];
     for(const [x,value] of values)page.drawText(value,{x,y,size:8,font,color:ink});first=false;
    }
    page.drawText(wrapped.shift()!,{x:115,y,size:8,font,color:ink});y-=13;
   }y-=10;
  }
  if(y<180)attachmentPage();y-=8;
  text(`Totaal: ${cleaning.hours} uur | Excl. btw ${euro(cleaning.net_cents)}`,11,gold);
  text(`Btw 21%: ${euro(cleaning.vat_cents)} | Incl. btw: ${euro(cleaning.gross_cents)}`,10);
  y-=8;text('Min. = goedgekeurde minuten. Per bezoek naar boven afgerond op hele uren, minimaal 1 uur. Tarief: € 25,00 per uur exclusief btw.',8);
  text('Deze bijlage specificeert de post Schoonmaak op de huurfactuur.',8);
 }
 doc.getPages().forEach((p,n)=>p.drawText(`${i.number}  |  ${n+1} / ${doc.getPageCount()}`,{x:50,y:30,size:8,font,color:gold}));
 doc.setTitle(`${i.number} - ${i.payload.subject}`);doc.setProducer(kind!=='rental'?i.payload.snapshot.issuer_name:'MZS Group');return Buffer.from(await doc.save());
}
