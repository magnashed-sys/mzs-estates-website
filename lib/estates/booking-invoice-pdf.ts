import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {bookingInvoiceTerms,bookingPaymentSchedule,noVatText,type BookingInvoiceDocument} from "./booking-invoice";

export async function bookingInvoicePdf(i:BookingInvoiceDocument){
 const s=bookingPaymentSchedule(i.total,i.paid,i.checkIn,i.bookedOn);
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const font=await doc.embedFont(await readFile(path.join(process.cwd(),"lib/estates/fonts/DejaVuSans.ttf")),{subset:true});
 const ink=rgb(.15,.17,.17),muted=rgb(.4,.44,.43),gold=rgb(.63,.54,.39),pale=rgb(.94,.95,.94);
 let page=doc.addPage([595,842]);
 const money=(v:number)=>new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"}).format(v);
 const date=(v:string)=>v.split("-").reverse().join("-");
 const text=(value:string,x:number,y:number,size=9,color=ink)=>page.drawText(value,{x,y,size,font,color});
 const right=(value:string,y:number,size=10)=>text(value,549-font.widthOfTextAtSize(value,size),y,size);
 function lines(value:string,width:number,size:number){
  const out:string[]=[];
  for(const para of value.split(/\r?\n/)){
   let line="";
   for(const word of para.split(/\s+/)){
    const next=line?line+" "+word:word;
    if(font.widthOfTextAtSize(next,size)<=width){line=next;continue;}
    if(line)out.push(line);line="";
    for(const ch of word){if(font.widthOfTextAtSize(line+ch,size)>width){out.push(line);line="";}line+=ch;}
   }
   if(line)out.push(line);
  }
  return out;
 }
 function block(value:string,x:number,y:number,width:number,size=9,color=ink){
  for(const line of lines(value,width,size)){if(y<55){page=doc.addPage([595,842]);y=790;}text(line,x,y,size,color);y-=size+4;}
  return y;
 }
 const rule=(y:number)=>page.drawLine({start:{x:46,y},end:{x:549,y},thickness:.6,color:rgb(.85,.87,.86)});
 let left=block(i.issuer.name.toUpperCase(),46,792,270,17);
 left=block(i.issuer.address,46,left-9,270,9);
 left=block("CIF: "+i.issuer.tax_id,46,left-3,270,9,muted);
 text("BOEKINGSBEVESTIGING",325,792,10);
 text("BOOKING CONFIRMATION",325,779,10);
 text("CONFIRMACIÓN DE RESERVA",325,766,10);
 text("CONCEPT / DRAFT / BORRADOR",325,749,8,gold);
 let y=Math.min(left-12,704);rule(y);y-=22;
 text("FACTUUR AAN / BILL TO / FACTURAR A",46,y,8,muted);
 let recipientEnd=block(i.recipient,46,y-21,260,12);
 if(i.recipientAddress)recipientEnd=block(i.recipientAddress,46,recipientEnd-5,260,9);
 const refEnd=block("Boeking / Booking / Reserva: "+i.reference,330,y,219,9);
 block("Nummer en datum volgen bij uitgifte.\nNumber and date assigned on issue.\nNúmero y fecha al emitir.",330,refEnd-8,219,8,muted);
 y=Math.min(recipientEnd-20,y-82);
 const propertyLines=lines(i.property,470,11);
 const boxHeight=48+propertyLines.length*15;
 page.drawRectangle({x:46,y:y-boxHeight+13,width:503,height:boxHeight,color:pale});
 y=block(i.property,60,y-5,470,11)-5;
 y=block("Verblijf / Stay / Estancia: "+date(i.checkIn)+" - "+date(i.checkOut),60,y,470,9)-24;
 text("OMSCHRIJVING / DESCRIPTION / DESCRIPCIÓN",46,y,8,muted);
 right("BEDRAG / AMOUNT / IMPORTE",y,8);rule(y-12);y-=31;
 y=block("Verhuur / Rental / Alquiler: "+i.property,46,y,340,10);
 right(money(s.total),y+14);rule(y-8);y-=25;
 y=block(noVatText,46,y,503,8,muted)-12;
 text("Totaal / Total / Total",280,y,10);right(money(s.total),y,12);y-=23;
 text("Ontvangen / Received / Recibido",280,y,9);right(money(s.paid),y,10);y-=15;
 if(i.receiptDates.length)y=block(i.receiptDates.map(date).join(" · "),280,y,269,7.5,muted)-5;
 page.drawRectangle({x:270,y:y-29,width:279,height:36,color:rgb(.91,.93,.90)});
 text("Openstaand / Due / Pendiente",280,y-15,9);text(money(s.outstanding),539-font.widthOfTextAtSize(money(s.outstanding),12),y-15,12);y-=48;
 if(s.credit>0)y=block("Te veel betaald / Credit / Saldo a favor: "+money(s.credit),46,y,503,9)-5;
 if(y<260){page=doc.addPage([595,842]);y=790;}
 y=block("BETALING / PAYMENT / PAGO",46,y,503,8,muted)-2;
 y=block(i.issuer.name+"  |  IBAN: "+i.issuer.iban.replace(/(.{4})/g,"$1 ").trim(),46,y,503,9);
 y=block("Referentie / Reference / Referencia: "+i.reference,46,y,503,8);
 y=block("Aanbetaling / Deposit / Anticipo (50%): "+money(s.deposit)+"  |  "+(s.depositDue?date(s.depositDue):"7 dagen na boeken / 7 days after booking / 7 días tras reservar"),46,y,503,8);
 y=block("Resterende 50% / Remaining 50% / 50% restante: "+money(s.finalInstalment)+"  |  "+date(s.balanceDue),46,y,503,8)-8;
 rule(y);y-=18;
 for(const term of bookingInvoiceTerms){
  y=block(term.language.toUpperCase(),46,y,503,7.5,gold);
  y=block(term.text,46,y,503,8)-6;
 }
 doc.getPages().forEach((p,n)=>p.drawText("CONCEPT / DRAFT / BORRADOR   |   "+(n+1)+" / "+doc.getPageCount(),{x:46,y:28,size:7,font,color:muted}));
 doc.setTitle("Booking confirmation - "+i.reference);doc.setProducer("MZS Group");
 return Buffer.from(await doc.save());
}
