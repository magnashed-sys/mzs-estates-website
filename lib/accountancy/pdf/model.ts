import {dateValue} from '../administration';
export const PDF_BUCKET='mzs-purchase-pdf-quarantine';
export const PDF_ROOT='/admin/workspaces/accountancy/purchases';
export const MAX_PDF_BYTES=4*1024*1024;
export type ExtractedPage={page:number;text:string};
export type Proposal={supplierName:string;number:string;date:string;net:string;vat:string;gross:string;currency:string;warnings:string[]};
export function pdfIntakeEnvironment(e:NodeJS.ProcessEnv=process.env){return e.VERCEL_ENV==='preview'&&e.NEXT_PUBLIC_SUPABASE_URL==='https://senonkpxdtlhyhrubicg.supabase.co';}
export function suggestPurchase(pages:ExtractedPage[]):Proposal{
 const text=pages.map(p=>p.text).join('\n'),lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const warnings:string[]=[];
 const choose=(pattern:RegExp)=>{const matches=[...new Set(lines.flatMap(line=>{const m=line.match(pattern);return m?[m[1].trim()]:[];}))];return matches.length===1?matches[0]:'';};
 const supplierName=choose(/^(?:supplier|leverancier|proveedor)\s*:\s*(.{2,160})$/i);
 const number=choose(/^(?:invoice\s*(?:number|no\.?|#)|factuurnummer|factuur\s*nr\.?|(?:n[uú]mero\s*(?:de\s*)?factura)|factura\s*(?:n[ºo°]\.?|#))\s*[:#]?\s+([\w./-]{1,100})$/i);
 const rawDate=choose(/^(?:invoice date|factuurdatum|fecha(?: de (?:la )?factura)?)\s*:\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/i);
 let date='';try{if(rawDate){const bits=rawDate.split('/');if(bits.length===3&&Number(bits[0])<=12)throw Error();date=dateValue(bits.length===3?`${bits[2]}-${bits[1]}-${bits[0]}`:rawDate);}}catch{}
 const amount=(pattern:RegExp)=>{const raw=choose(pattern).replace(/(?:EUR|€)/gi,'').trim();if(!/^\d{1,9}[.,]\d{2}$/.test(raw))return '';return raw.replace(',','.');};
 const net=amount(/^(?:net(?: amount)?|subtotal|base imponible|importe neto|excl\.?\s*(?:btw|vat))\s*:\s*(.+)$/i);
 const vat=amount(/^(?:vat(?: amount)?|iva|cuota iva|btw(?: bedrag)?)\s*:\s*(.+)$/i);
 const gross=amount(/^(?:total(?: amount| factura)?|importe total|totaal(?: incl\.? btw)?)\s*:\s*(.+)$/i);
 // Foreign currency or absent explicit EUR prevents any suggestion of EUR.
 const currency=/\bEUR\b|€/.test(text)&&!/(?:\b(?:USD|GBP|CHF|AUD|CAD)\b|\$|£)/.test(text)?'EUR':'';
 if(text.replace(/\s/g,'').length<20)warnings.push('No usable text found. Review this scan manually.');
 warnings.push('Suggestions are not verified. Check every value against the original PDF.');
 if(!number||!date||!net||!vat||!gross||!currency)warnings.push('Some fields could not be recognised unambiguously.');
 return {supplierName,number,date,net,vat,gross,currency,warnings};
}
