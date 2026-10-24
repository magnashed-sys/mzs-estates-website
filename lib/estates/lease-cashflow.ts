export type CashInvoice={id:string;total:number;due_date:string};
export type CashPayment={invoice_id:string;amount:number;reversed_at:string|null};
export function invoiceBalance(i:CashInvoice,payments:CashPayment[]){return Math.max(0,Math.round(Number(i.total)*100)-payments.filter(p=>p.invoice_id===i.id&&!p.reversed_at).reduce((n,p)=>n+Math.round(Number(p.amount)*100),0))/100;}
export function cashflowSummary(invoices:CashInvoice[],payments:CashPayment[],today:string){let outstanding=0,overdue=0,received=0;for(const i of invoices){const balance=invoiceBalance(i,payments);outstanding+=Math.round(balance*100);if(i.due_date<today)overdue+=Math.round(balance*100);received+=Math.round((Number(i.total)-balance)*100);}return {outstanding:outstanding/100,overdue:overdue/100,received:received/100};}
export type ForecastContract={status:string;first_period:string;lease_start:string;lease_end:string|null;max_terms:number|null;prorate:boolean;lines:{amount:string;vat:string}[]};
// Input amounts are validated non-negative decimal strings (at most two decimals).
// Use integer ratios so exact half cents round up, matching PostgreSQL numeric.
function amountCents(amount:string){const [whole,fraction='']=String(amount).split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));}
function roundedRatio(numerator:number,denominator:number){return Math.floor((2*numerator+denominator)/(2*denominator));}
export function rentalForecast(contracts:ForecastContract[],month:string){
 const start=month+'-01',d=new Date(start+'T12:00:00Z');const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)).toISOString().slice(0,10);const days=Number(end.slice(-2));let total=0;
 for(const c of contracts){const n=(d.getUTCFullYear()-Number(c.first_period.slice(0,4)))*12+d.getUTCMonth()-(Number(c.first_period.slice(5,7))-1);
 if(c.status!=='active'||n<0||n>=Math.min(c.max_terms??600,600)||c.lease_start>end||(c.lease_end&&c.lease_end<start))continue;
 const covered=(Date.parse((c.lease_end&&c.lease_end<end?c.lease_end:end)+'T12:00:00Z')-Date.parse((c.lease_start>start?c.lease_start:start)+'T12:00:00Z'))/86400000+1;
 for(const l of c.lines){const cents=amountCents(l.amount);const net=c.prorate?roundedRatio(cents*covered,days):cents;total+=net+(l.vat==='exempt'?0:roundedRatio(net*Number(l.vat),100));}
 }return total/100;
}
