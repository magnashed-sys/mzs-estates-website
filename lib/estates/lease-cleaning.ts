export type CleaningEntry={visit_id:string;worked_on:string;description:string;actual_minutes:number;approved_minutes:number;hours:number;rate_cents:number;net_cents:number};
export type LeaseCleaning={version:1;description:string;customer_reference:string;cutoff:string;entries:CleaningEntry[];hours:number;net_cents:number;vat_cents:number;gross_cents:number};

/** Refuse an incomplete attachment instead of emitting a plausible but wrong invoice. */
export function validateLeaseCleaning(cleaning:LeaseCleaning|undefined,lines:{source?:string;net:number;tax:number;total:number;vat:string}[]){
 const billed=lines.filter(l=>l.source==='zorgbalans_cleaning');
 if(!cleaning){if(billed.length)throw new Error('Cleaning hours attachment is missing.');return;}
 if(cleaning.version!==1||!Array.isArray(cleaning.entries))throw new Error('Invalid cleaning attachment.');
 const ids=new Set<string>();let hours=0,net=0;
 for(const e of cleaning.entries){
  if(ids.has(e.visit_id)||!e.visit_id||!/^\d{4}-\d{2}-\d{2}$/.test(e.worked_on)||e.worked_on>cleaning.cutoff||
   !Number.isInteger(e.actual_minutes)||e.actual_minutes<1||!Number.isInteger(e.approved_minutes)||e.approved_minutes<1||
   e.hours!==Math.max(1,Math.ceil(e.approved_minutes/60))||e.rate_cents!==2500||e.net_cents!==e.hours*2500)
   throw new Error('Cleaning hours attachment does not reconcile.');
  ids.add(e.visit_id);hours+=e.hours;net+=e.net_cents;
 }
 const vat=Math.round(net*.21);
 if(hours!==cleaning.hours||net!==cleaning.net_cents||vat!==cleaning.vat_cents||net+vat!==cleaning.gross_cents||
  billed.length!==(hours?1:0)||billed.some(l=>l.vat!=='21'||Math.round(Number(l.net)*100)!==net||Math.round(Number(l.tax)*100)!==vat||Math.round(Number(l.total)*100)!==net+vat))
  throw new Error('Cleaning invoice line does not match its hours attachment.');
}
