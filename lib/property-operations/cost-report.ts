export type ConceptCost={id:string;property_id:string|null;legal_entity_id:string;invoice_date:string;category:string;net_cents:number;vat_cents:number;gross_cents:number};
export type CostTotal={count:number;net:number;vat:number;gross:number};
const empty=():CostTotal=>({count:0,net:0,vat:0,gross:0});
export function summarizeConceptCosts(rows:readonly ConceptCost[]){
 const seen=new Set<string>(),total=empty(),months=new Map<string,CostTotal>(),properties=new Map<string,CostTotal>(),categories=new Map<string,CostTotal>();
 function add(t:CostTotal,r:ConceptCost){t.count++;t.net+=r.net_cents;t.vat+=r.vat_cents;t.gross+=r.gross_cents;if([t.net,t.vat,t.gross].some(n=>!Number.isSafeInteger(n)))throw Error('Cost total overflow');}
 for(const row of rows){
 if(seen.has(row.id)||!/^\d{4}-\d{2}-\d{2}$/.test(row.invoice_date)||[row.net_cents,row.vat_cents,row.gross_cents].some(n=>!Number.isSafeInteger(n)||n<0)||row.net_cents+row.vat_cents!==row.gross_cents)throw Error('Invalid cost source');
 seen.add(row.id);add(total,row);
 for(const [map,key] of [[months,row.invoice_date.slice(0,7)],[properties,row.property_id??'company'],[categories,row.category]] as const){const group=map.get(key)??empty();add(group,row);map.set(key,group);}
 }
 return {total,months:[...months].sort(([a],[b])=>a.localeCompare(b)),properties:[...properties],categories:[...categories]};
}
