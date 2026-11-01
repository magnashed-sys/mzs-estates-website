import {type PartnerSource, type Row} from './finance';
export type PartnerLocale = 'nl'|'en'|'es';
export const partnerLocale=(locale:string):PartnerLocale=>locale==='nl'?'nl':locale==='es'?'es':'en';
export const copy=(locale:string,nl:string,en:string,es:string)=>locale==='nl'?nl:locale==='es'?es:en;
export const displayLocale=(locale:string)=>locale==='nl'?'nl-NL':locale==='es'?'es-ES':'en-GB';
export function todayMadrid(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function validDay(day:string){return /^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T12:00:00Z'))&&new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day;}
export const nightsBetween=(start:string,end:string)=>validDay(start)&&validDay(end)?Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000):0;
export type Period={check_in:string;check_out:string};
export const overlaps=(start:string,end:string,periods:Period[])=>periods.some(p=>start<p.check_out&&end>p.check_in);
export function periodSource(source:PartnerSource,year:number,month:number):PartnerSource{
 if(!month)return source;
 const fields:Record<string,string>={leases:'issued_on',bookings:'issued_on',external:'issued_on',services:'issued_on',credit_notes:'issued_on',rent_receipts:'received_on',guest_receipts:'received_on',external_receipts:'received_on',imported_receipts:'received_on',service_receipts:'received_on',property_receipts:'received_on',supplier_payments:'paid_on',costs:'invoice_date'};
 const prefix=`${year}-${String(month).padStart(2,'0')}`;
 // Keep excluded import identities and invoice identities for the existing validation.
 // Totals use the selected month's dates; rows outside it retain identities but no dated attribution.
 return Object.fromEntries(Object.entries(source).map(([key,value])=>[key,fields[key]&&Array.isArray(value)?value.map((r:Row)=>String(r[fields[key]]||'').startsWith(prefix)?r:{...r,[fields[key]]:null}):value])) as PartnerSource;
}
const labels:Record<string,[string,string,string]>={
 confirmed:['Bevestigd','Confirmed','Confirmada'],requested:['In afwachting','Awaiting approval','Pendiente de aprobación'],declined:['Afgewezen','Declined','Rechazada'],cancelled:['Geannuleerd','Cancelled','Cancelada'],blocked:['Geblokkeerd','Blocked','Bloqueada'],pending:['Te beoordelen','Pending review','Pendiente de revisión'],pending_review:['Te beoordelen','Pending review','Pendiente de revisión'],needs_attention:['Aandacht nodig','Needs attention','Requiere atención'],reviewed:['Beoordeeld','Reviewed','Revisada'],excluded:['Uitgesloten','Excluded','Excluida'],draft:['Concept','Draft','Borrador'],issued:['Uitgereikt','Issued','Emitida'],externally_issued:['Extern uitgereikt','Externally issued','Emitida externamente'],active:['Actief','Active','Activa'],agreed:['Overeengekomen','Agreed','Acordada'],closed:['Gesloten','Closed','Cerrada'],void:['Vervallen','Voided','Anulada'],reversed:['Teruggedraaid','Reversed','Revertida'],supplier_invoice:['Inkoopfactuur','Supplier invoice','Factura de proveedor'],other:['Overig','Other','Otros'],purchase_deed:['Aankoopakte','Purchase deed','Escritura de compra'],tax_return:['Belastingaangifte','Tax return','Declaración fiscal'],annual_accounts:['Jaarrekening','Annual accounts','Cuentas anuales'],contract:['Overeenkomst','Agreement','Contrato'],insurance:['Verzekering','Insurance','Seguro'],bank_statement:['Bankafschrift','Bank statement','Extracto bancario'],interest:['Rente','Interest','Intereses'],principal:['Hoofdsom','Principal','Principal']};
export function partnerLabel(value:unknown,locale:string){const key=String(value||'');const entry=labels[key];return entry?entry[locale==='nl'?0:locale==='es'?2:1]:key?key.replaceAll('_',' '):'—';}
export function recordStatus(row:Row,locale:string){return row.reversed_at||row.is_void?partnerLabel('reversed',locale):partnerLabel(row.review_status||row.status,locale);}
export function upcomingBookings(data:Row[],today:string){return data.filter(r=>r.status==='confirmed'&&String(r.check_out)>today).sort((a,b)=>String(a.check_in).localeCompare(String(b.check_in)));}
