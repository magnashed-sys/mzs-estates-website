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
 const gold=kind==='rental'?rgb(.15,.20,.25):rgb(.53,.43,.28),ink=kind==='rental'?rgb(.15,.20,.25):rgb(.12,.12,.12);let page=doc.addPage([595,842]),y=790;
 const money=(v:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(Number(v));
 function newPage(){page=doc.addPage([595,842]);y=790;}
 function text(value:string,size=10,color=ink){
  for(const paragraph of String(value||'').replace(/\\n/g,'\n').split(/\r?\n/)){
   let line='';for(const word of paragraph.split(/\s+/)){for(const ch of (line?' ':'')+word){if(font.widthOfTextAtSize(line+ch,size)>490){if(y<65)newPage();page.drawText(line,{x:50,y,size,font,color});y-=size+5;line='';}line+=ch;}}
   if(y<65)newPage();page.drawText(line,{x:50,y,size,font,color});y-=size+5;
  }
 }
 const details=i.payload.snapshot.issuer_details||{};
 /** Rental invoices follow the approved final Zorgbalans 7113 PDF, not the legacy service route. */
 async function rentalLayout(){
  const s=i.payload.snapshot,muted=rgb(.39,.45,.50),pale=rgb(.96,.97,.97),rule=rgb(.84,.87,.89);
  let savedLogo:Awaited<ReturnType<typeof doc.embedPng>>|undefined;
  if(details.logo){
   try{const bytes=Buffer.from(details.logo.split(',')[1]||'','base64'),png=details.logo.startsWith('data:image/png;');
    if(bytes.length>200000||(png&&(bytes.length<24||bytes.readUInt32BE(16)>2000||bytes.readUInt32BE(20)>2000)))throw new Error('Invalid logo dimensions');
    savedLogo=png?await doc.embedPng(bytes):await doc.embedJpg(bytes);
    if(savedLogo.width>2000||savedLogo.height>2000)throw new Error('Invalid logo dimensions');
   }catch{throw new Error('The saved issuer logo is invalid. Review it before issuing invoices.');}
  }

  const euro=(v:number)=>Number(v).toLocaleString('nl-NL',{style:'currency',currency:'EUR'});
  const date=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)?new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T12:00:00Z')):v;
  function face(_value:string,_strong=false){return font;}
  function draw(value:string,x:number,at:number,size=9,strong=false,color=ink){
   page.drawText(value,{x,y:at,size,font,color});
   if(strong)page.drawText(value,{x:x+.35,y:at,size,font,color});
  }
  function right(value:string,x:number,at:number,size=9,strong=false,color=ink){draw(value,x-face(value,strong).widthOfTextAtSize(value,size),at,size,strong,color);}
  function wrap(value:string,width:number,size=9,strong=false){
   const out:string[]=[];
   for(const paragraph of String(value||'').replace(/\\n/g,'\n').split(/\r?\n/)){
    let line='';for(const word of paragraph.split(/\s+/)){
     const next=line?line+' '+word:word;
     if(face(next,strong).widthOfTextAtSize(next,size)<=width){line=next;continue;}
     if(line)out.push(line);line='';
     for(const ch of word){if(face(line+ch,strong).widthOfTextAtSize(line+ch,size)>width){out.push(line);line='';}line+=ch;}
    }out.push(line);
   }return out;
  }
  function header(continuation=false){
   page.drawRectangle({x:0,y:833,width:595,height:9,color:ink});
   const name=String(s.issuer_name||'').toUpperCase();
   let size=14;while(size>8&&face(name,true).widthOfTextAtSize(name,size)>300)size-=.5;
   const nameY=savedLogo?760:789;
   if(savedLogo){const scale=Math.min(140/savedLogo.width,35/savedLogo.height,1);page.drawImage(savedLogo,{x:44,y:782,width:savedLogo.width*scale,height:savedLogo.height*scale});}
   const names=wrap(name,300,size,true);names.forEach((line,n)=>draw(line,44,nameY-n*(size+3),size,true));
   right('FACTUUR',551,786,26,true);right(date(i.issued_on).toUpperCase(),551,767,8,true,muted);
   const bottom=Math.min(750,nameY-7-names.length*(size+3));
   page.drawLine({start:{x:44,y:bottom},end:{x:551,y:bottom},color:rule,thickness:.6});
   y=bottom-28;
   if(continuation){draw('Factuur '+i.number+' - vervolg',44,y,9,true,muted);y-=25;}
  }
  function next(){newPage();header(true);}
  function ensure(height:number){if(y-height<62)next();}
  function paragraph(value:string,size=9,strong=false,color=ink,width=507,x=44){for(const line of wrap(value,width,size,strong)){ensure(size+5);draw(line,x,y,size,strong,color);y-=size+5;}}
  function divider(){page.drawLine({start:{x:44,y},end:{x:551,y},color:rule,thickness:.6});}
  header();
  // Keep both address columns in the same rows, including across page boundaries.
  draw('AFZENDER',44,y,8,true,muted);draw('FACTUUR AAN',316,y,8,true,muted);y-=23;
  const issuer=[s.issuer_name,s.issuer_address,s.issuer_tax_id&&'Btw-id: '+s.issuer_tax_id,
   i.payload.issuer_registration&&'Registratie: '+i.payload.issuer_registration,
   ...([['Handelsnaam',details.trading_name],['Rechtsvorm',details.legal_form],['Land',details.country&&!s.issuer_address.includes(details.country)?details.country:''],['Contact',details.contact_name!==s.issuer_name?details.contact_name:''],['E-mail',details.email],['Telefoon',details.phone],['Website',details.website],['Factuuradres',details.billing_address]] as const).filter(([,v])=>v).map(([k,v])=>k+': '+v)].filter(Boolean);
  const tenant=[s.tenant_name,s.tenant_attention&&'T.a.v. '+s.tenant_attention,s.tenant_address,s.tenant_tax_id&&'Btw-id: '+s.tenant_tax_id].filter(Boolean);
  const left=issuer.flatMap((v,n)=>wrap(v,238,9,n===0).map(t=>({t,strong:n===0}))),rightRows=tenant.flatMap((v,n)=>wrap(v,235,9,n===0).map(t=>({t,strong:n===0})));
  for(let n=0;n<Math.max(left.length,rightRows.length);n++){ensure(15);if(left[n])draw(left[n].t,44,y,9,left[n].strong);if(rightRows[n])draw(rightRows[n].t,316,y,9,rightRows[n].strong);y-=15;}
  y-=16;
  // A shaded metadata block with measured rows; long references are never truncated.
  const meta=[['FACTUURNUMMER',i.number],['FACTUURDATUM',date(i.issued_on)],['VERVALDATUM',date(i.due_date)],['HUURPERIODE',date(i.payload.period_start)+' t/m '+date(i.payload.period_end)]];
  for(let n=0;n<meta.length;n+=2){
   const cells=meta.slice(n,n+2).map(([label,value])=>({label,lines:wrap(value,143,8.5,label==='FACTUURNUMMER')}));
   const count=Math.max(...cells.map(c=>c.lines.length));ensure(count*14+14);
   page.drawRectangle({x:44,y:y-count*14-14,width:507,height:count*14+14,color:pale});
   cells.forEach((c,k)=>{draw(c.label,58+k*253,y-15,6.5,true,muted);c.lines.forEach((v,j)=>draw(v,150+k*253,y-15-j*14,8.5,c.label==='FACTUURNUMMER'));});y-=count*14+14;
  }
  if(s.customer_reference){for(const [n,line] of wrap(s.customer_reference,350,9).entries()){ensure(24);page.drawRectangle({x:44,y:y-24,width:507,height:24,color:pale});if(!n)draw('UW REFERENTIE',58,y-15,7,true,muted);draw(line,195,y-15,9);y-=24;}}
  y-=18;paragraph(i.payload.subject,13,true);y-=12;
  function tableHeader(){ensure(50);page.drawRectangle({x:44,y:y-25,width:507,height:31,color:ink});draw('OMSCHRIJVING',57,y-13,8,true,rgb(1,1,1));right('BTW',433,y-13,8,true,rgb(1,1,1));right('EXCL. BTW',539,y-13,8,true,rgb(1,1,1));y-=47;}
  tableHeader();
  for(const l of i.payload.lines){
   const lines=wrap(l.description,310,9);
   if(y<95){next();tableHeader();}
   right(l.vat==='exempt'?'Vrijgesteld':l.vat+'%',433,y,8);right(euro(l.net),539,y,10,true);
   for(const line of lines){if(y<78){next();tableHeader();}draw(line,57,y,9);y-=14;}
   y-=8;divider();y-=14;
  }
  const taxes=new Map<string,number>();for(const l of i.payload.lines)taxes.set(l.vat,(taxes.get(l.vat)||0)+Number(l.tax));
  ensure(85+taxes.size*22);y-=8;
  draw('Subtotaal excl. btw',330,y,9);right(euro(i.payload.subtotal),539,y);y-=22;
  for(const [rate,amount] of taxes){draw(rate==='exempt'?'Btw vrijgesteld':'Btw '+rate+'%',330,y,9);right(euro(amount),539,y);y-=22;}
  // Render the authoritative tax total as well when a snapshot has no line breakdown.
  if(!taxes.size){draw('Btw',330,y,9);right(euro(i.payload.tax_total),539,y);y-=22;}
  page.drawLine({start:{x:305,y:y+5},end:{x:551,y:y+5},color:ink,thickness:.7});y-=22;
  draw('TOTAAL TE BETALEN',305,y,9,true);right(euro(i.total),539,y-2,18,true);y-=32;
  const payment=[{value:'BETALING',size:8,strong:true,color:muted},{value:'IBAN  '+s.issuer_iban,size:10,strong:true,color:ink},
   {value:'Ten name van '+(details.account_holder||s.issuer_name),size:9,strong:false,color:ink},
   ...(details.bic?[{value:'BIC / SWIFT: '+details.bic,size:9,strong:false,color:ink}]:[]),
   {value:'Graag onder vermelding van factuurnummer '+i.number+'. Betaling uiterlijk '+date(i.due_date)+'.',size:8,strong:false,color:muted},
   ...[s.payment_conditions,details.payment_instructions].filter(Boolean).map(value=>({value:value!,size:8,strong:false,color:muted}))];
  const paymentRows=payment.flatMap(row=>wrap(row.value,475,row.size,row.strong).map(value=>({...row,value})));
  const paymentHeight=paymentRows.reduce((n,row)=>n+row.size+7,0)+20;
  if(paymentHeight<620)ensure(paymentHeight);
  for(const row of paymentRows){ensure(row.size+11);page.drawRectangle({x:44,y:y-row.size-8,width:507,height:row.size+11,color:pale});draw(row.value,60,y-5,row.size,row.strong,row.color);y-=row.size+7;}
  y-=25;if(cleaning?.entries.length)paragraph('Bijlage 1: specificatie schoonmaakwerkzaamheden.',8,false,muted);
 }
 if(details.logo&&kind!=='rental'){
  try{const bytes=Buffer.from(details.logo.split(',')[1]||'', 'base64');
   const isPng=details.logo.startsWith('data:image/png;');
   if(bytes.length>200000||(isPng&&(bytes.length<24||bytes.readUInt32BE(16)>2000||bytes.readUInt32BE(20)>2000)))throw new Error('Invalid logo dimensions');
   const logo=isPng?await doc.embedPng(bytes):await doc.embedJpg(bytes);
   if(logo.width>2000||logo.height>2000)throw new Error('Invalid logo dimensions');
   const scale=Math.min(140/logo.width,55/logo.height,1);page.drawImage(logo,{x:50,y:y-logo.height*scale,width:logo.width*scale,height:logo.height*scale});y-=logo.height*scale+15;
  }catch{throw new Error('The saved issuer logo is invalid. Review it before issuing invoices.');}
 }
 if(kind==='rental'){
  await rentalLayout();
 }else{
 text(kind==='credit'?'CREDIT NOTE':'INVOICE',22);text(i.number,14,gold);y-=14;
 text(kind==='credit'?`Credit date: ${i.issued_on}`:`Invoice date: ${i.issued_on}    Payment due: ${i.due_date}`);y-=12;
 const s=i.payload.snapshot;text('ISSUER',9,gold);text(s.issuer_name,12);text(s.issuer_address);if(s.issuer_tax_id)text(`Tax ID: ${s.issuer_tax_id}`);if(i.payload.issuer_registration)text(`Registration: ${i.payload.issuer_registration}`);text(`IBAN: ${s.issuer_iban}`);
 for(const [label,value] of [['Trading name',details.trading_name],['Legal form',details.legal_form],['Country',details.country],['Contact',details.contact_name],['Email',details.email],['Telephone',details.phone],['Website',details.website],['Account holder',details.account_holder],['BIC / SWIFT',details.bic],['Billing address',details.billing_address]])if(value)text(`${label}: ${value}`);y-=12;
 text('BILL TO',9,gold);text(s.tenant_name,12);if(s.tenant_attention)text(`Attn: ${s.tenant_attention}`);text(s.tenant_address);if(s.tenant_tax_id)text(`Tax ID: ${s.tenant_tax_id}`);if(s.customer_reference)text(`Customer reference: ${s.customer_reference}`);y-=12;text(i.payload.subject,12,gold);y-=8;
 for(const l of i.payload.lines){if(y<110)newPage();text(l.description,11);text(`Net ${money(l.net)}  |  VAT ${l.vat==='exempt'?'Exempt':l.vat+'%'}: ${money(l.tax)}  |  Total ${money(l.total)}`);y-=7;}
 if(y<170)newPage();y-=8;text(`Subtotal: ${money(i.payload.subtotal)}`);text(`VAT: ${money(i.payload.tax_total)}`);y-=6;text(`TOTAL: ${money(i.total)}`,16,gold);y-=12;
 if(kind==='credit')text('Allocated to the original invoice. This credit note does not confirm a bank refund.');else text(`Please transfer to ${s.issuer_iban}, quoting ${i.number}.`);if(kind!=='credit'&&s.payment_conditions)text(s.payment_conditions);if(kind!=='credit'&&details.payment_instructions)text(details.payment_instructions);
 }
 if(cleaning?.entries.length){
  const euro=(c:number)=>(c/100).toLocaleString('nl-NL',{style:'currency',currency:'EUR'});
  function attachmentPage(){
   newPage();page.drawRectangle({x:0,y:833,width:595,height:9,color:gold});
   text(i.payload.snapshot.issuer_name.toUpperCase(),14,gold);y-=15;
   text('BIJLAGE 1 - URENSTAAT',16,gold);text(`Bij factuur ${i.number}`,10);text(cleaning!.customer_reference,9);y-=10;
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
 doc.getPages().forEach((p,n)=>{
  if(kind==='rental')p.drawLine({start:{x:44,y:48},end:{x:551,y:48},color:rgb(.84,.87,.89),thickness:.6});
  p.drawText(`${kind==='rental'?'FACTUUR ':''}${i.number}  |  ${n+1} / ${doc.getPageCount()}`,{x:50,y:30,size:8,font,color:gold});
 });
 doc.setTitle(`${i.number} - ${i.payload.subject}`);doc.setProducer(kind!=='rental'?i.payload.snapshot.issuer_name:'MZS Group');return Buffer.from(await doc.save());
}

