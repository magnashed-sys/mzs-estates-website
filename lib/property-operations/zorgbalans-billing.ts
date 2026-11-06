export type BillableVisit={id:string;worked_on:string;profile_id:string;effective_minutes:number;description:string;invoiced_hours:number;net_cents:number};
export const MAX_BILLING_VISITS=100;
export function billingSelection(visits:BillableVisit[],ids:readonly string[]){
 const chosen=new Set(ids),rows=visits.filter(v=>chosen.has(v.id));
 const net=rows.reduce((sum,v)=>sum+v.net_cents,0),vat=Math.round(net*21/100);
 return {rows,count:rows.length,minutes:rows.reduce((sum,v)=>sum+v.effective_minutes,0),hours:rows.reduce((sum,v)=>sum+v.invoiced_hours,0),net,vat,gross:net+vat};
}
export function billingVisits(visits:BillableVisit[],from:string,until:string,profile:string){
 return visits.filter(v=>(!from||v.worked_on>=from)&&(!until||v.worked_on<=until)&&(!profile||v.profile_id===profile));
}
