export type Deal = {
 id:string;title:string;direction:'provided'|'received';lender:string;borrower:string;
 principal:number;annual_rate:number;agreement_date:string|null;start_date:string|null;
 maturity_date:string|null;status:string;review_state:string;notes:string;source_reference:string;
};
export type Instalment = {id:string;deal_id:string;kind:string;period_label:string;due_date:string;amount:number;note:string};
export type Payment = {id:string;instalment_id:string;amount:number;paid_on:string;reference:string;is_void:boolean;void_reason:string|null};
export type LoanDocument = {id:string;title:string;category:string;version_label:string;document_status:string;created_at:string};
export const money = (value:number|string) => new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(Number(value));
export const date = (value:string|null) => value ? new Date(value.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}) : 'To be confirmed';
export const label = (value:string) => value.replaceAll('_',' ');
export function paidFor(id:string,payments:Payment[]) {
 return payments.filter(p=>p.instalment_id===id&&!p.is_void).reduce((sum,p)=>sum+Math.round(Number(p.amount)*100),0)/100;
}
