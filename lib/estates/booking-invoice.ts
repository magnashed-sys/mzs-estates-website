export const bookingInvoiceTerms = [
 {language:"Nederlands",text:"Wij vragen je 50% van het boekingsbedrag binnen 7 dagen na het boeken te voldoen. De resterende 50% dient uiterlijk 14 dagen voor aanvang van het verblijf te zijn ontvangen. Bij annulering wordt de reeds betaalde aanbetaling niet terugbetaald."},
 {language:"English",text:"Please pay a 50% deposit within 7 days of booking. The remaining 50% must be received no later than 14 days before your stay begins. If you cancel, any deposit already paid is non-refundable."},
 {language:"Español",text:"Te pedimos un anticipo del 50% dentro de los 7 días siguientes a la reserva. El 50% restante deberá recibirse como máximo 14 días antes del inicio de la estancia. En caso de cancelación, el anticipo ya abonado no se reembolsará."}
];
export const noVatText="Geen btw in rekening gebracht / No VAT charged / No se repercute IVA";
export function isMaseIssuer(issuer:{name:string;tax_id?:string|null}){
 return issuer.name.trim().toLowerCase()==="mase estates sl"&&issuer.tax_id?.replace(/\s/g,"").toUpperCase()==="B16396079";
}
export function shiftDate(value:string,days:number){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error("Invalid calendar date");
 const d=new Date(value+"T12:00:00Z");
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error("Invalid calendar date");
 d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
}
export function bookingPaymentSchedule(total:number,paid:number,checkIn:string,bookedOn:string|null){
 if(!Number.isFinite(total)||total<=0||!Number.isFinite(paid)||paid<0)throw Error("Invalid booking amounts");
 const cents=Math.round(total*100),received=Math.round(paid*100),deposit=Math.round(cents/2);
 return {total:cents/100,paid:received/100,deposit:deposit/100,finalInstalment:(cents-deposit)/100,
  outstanding:Math.max(cents-received,0)/100,credit:Math.max(received-cents,0)/100,
  depositDue:bookedOn?shiftDate(bookedOn,7):null,balanceDue:shiftDate(checkIn,-14)};
}
export function invoiceAddress(value:unknown):string{
 if(typeof value==="string")return value.trim();
 if(!value||typeof value!=="object"||Array.isArray(value))return "";
 // Only actual supplied address fields; never print metadata or placeholders.
 const v=value as Record<string,unknown>;
 const get=(...keys:string[])=>{for(const k of keys)if(typeof v[k]==="string"&&v[k].trim())return v[k].trim();return "";};
 return [get("address","address_line1","street"),get("address_line2","address_extra"),
  [get("postal_code","postcode","zip"),get("city","town")].filter(Boolean).join(" "),get("country")].filter(Boolean).join("\n");
}
export type BookingInvoiceDocument={
 issuer:{name:string;address:string;tax_id:string;iban:string};
 recipient:string;recipientAddress:string;property:string;reference:string;
 checkIn:string;checkOut:string;bookedOn:string|null;
 total:number;paid:number;receiptDates:string[];
};
