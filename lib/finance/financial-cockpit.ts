/** Read-only financial presentation model; never treats scheduled amounts as cash received. */
import {rentalForecast, type ForecastContract} from '../estates/lease-cashflow';

export type LeasePayment = {amount:number|string;received_on:string;reversed_at:string|null};
export type LoanDeal = {id:string;direction:'provided'|'received';status:string;review_state:string};
export type LoanInstalment = {id:string;deal_id:string;kind:string;due_date:string;amount:number|string};
export type LoanPayment = {instalment_id:string;amount:number|string;paid_on:string;is_void:boolean};
export type Booking = {id:string;check_in:string;check_out:string;status:string;is_test:boolean;quoted_total_eur:number|string|null};
export type MonthlyMoney = {month:string;rentForecast:number;rentReceived:number;interestIn:number;interestOut:number;interestReceived:number;interestPaid:number};
export type CockpitData = {
  year:number;asOf:string;rows:MonthlyMoney[];loansAvailable:boolean;
  bookings:{from:string;to:string;total:number;confirmed:number;unpriced:number;months:{month:string;total:number}[]};
  quality:{contracts:number;loansActive:number;loansNeedingReview:number;interestEntries:number;actualRentPayments:number;actualLoanPayments:number};
};
const isoDate=(date:Date)=>date.toISOString().slice(0,10);
const dateUTC=(str:string)=>Date.parse(str+'T00:00:00Z');
function moneyCents(value:number|string):number{
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)throw new Error('Invalid recorded monetary amount');
  return Math.round(n*100);
}
const plusMonths=(iso:string,months:number)=>{
  const [year,month,day]=iso.split('-').map(Number);
  const d=new Date(Date.UTC(year,month-1+months,1));
  const monthEnd=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  return isoDate(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),Math.min(day,monthEnd))));
};
const isoMonth=(year:number,month:number)=>year+'-'+String(month).padStart(2,'0');
function addMonth(map:Map<string,number>,month:string,cents:number){map.set(month,(map.get(month)||0)+cents);}
function monthWindows(from:string,to:string){
  const windows:{month:string;start:number;end:number}[]=[];
  let cur=from.slice(0,7)+'-01';
  while(cur<to){
    const next=plusMonths(cur,1);
    windows.push({month:cur.slice(0,7),start:dateUTC(cur),end:dateUTC(next)});
    cur=next;
    if(windows.length>50)throw new Error('Date range exceeded');
  }
  return windows;
}
export function buildFinancialCockpit(args:{
  year:number;asOf:string;contracts:ForecastContract[];rentPayments:LeasePayment[];
  deals:LoanDeal[];instalments:LoanInstalment[];loanPayments:LoanPayment[];
  bookings:Booking[];loansAvailable:boolean;
}):CockpitData{
 const {year,asOf,contracts,rentPayments,deals,instalments,loanPayments,bookings,loansAvailable}=args;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||year<2020||year>2100)throw new Error('Invalid reporting period');
 const byMonth=new Map<string,MonthlyMoney>();
 for(let m=1;m<=12;m++){const month=isoMonth(year,m);byMonth.set(month,{month,rentForecast:Math.round(rentalForecast(contracts,month)*100),rentReceived:0,interestIn:0,interestOut:0,interestReceived:0,interestPaid:0});}
 let actualRentPayments=0,actualLoanPayments=0;
 for(const payment of rentPayments){if(payment.reversed_at)continue;actualRentPayments++;const row=byMonth.get(payment.received_on.slice(0,7));if(row)row.rentReceived+=moneyCents(payment.amount);}
 const activeDeals=new Map(deals.filter(d=>d.status==='active').map(d=>[d.id,d]));
 const interestById=new Map<string,{direction:'provided'|'received'}>();
 for(const i of instalments){
  if(i.kind!=='interest')continue;
  const deal=activeDeals.get(i.deal_id);
  if(!deal)continue;
  interestById.set(i.id,{direction:deal.direction});
  const row=byMonth.get(i.due_date.slice(0,7));
  if(row)row[deal.direction==='provided'?'interestIn':'interestOut']+=moneyCents(i.amount);
 }
 for(const p of loanPayments){
  if(p.is_void)continue;
  const entry=interestById.get(p.instalment_id);if(!entry)continue;
  actualLoanPayments++;
  const row=byMonth.get(p.paid_on.slice(0,7));
  if(row)row[entry.direction==='provided'?'interestReceived':'interestPaid']+=moneyCents(p.amount);
 }
 const end=plusMonths(asOf,3),from=dateUTC(asOf),until=dateUTC(end);
 const bookingMonths=new Map<string,number>();
 let confirmed=0,unpriced=0;
 for(const booking of bookings){
  if(booking.status!=='confirmed'||booking.is_test)continue;
  const start=dateUTC(booking.check_in),finish=dateUTC(booking.check_out);
  if(!Number.isFinite(start)||!Number.isFinite(finish)||finish<=start)continue;
  const left=Math.max(start,from),right=Math.min(finish,until);
  if(right<=left)continue;
  confirmed++;
  if(booking.quoted_total_eur==null){unpriced++;continue;}
  const total=moneyCents(booking.quoted_total_eur);
  const nights=(finish-start)/86400000;
  const portions=monthWindows(asOf,end);
  for(const portion of portions){
    const overlap=Math.max(0,Math.min(right,portion.end)-Math.max(left,portion.start))/86400000;
    if(overlap>0){
      const cents=Math.round(total*overlap/nights);
      addMonth(bookingMonths,portion.month,cents);
    }
  }
  // Rounding within a reservation can differ by at most a few cents; avoid
  // presenting a sum of full reservations where dates fall outside the window.
 }
 const bookingSeries=monthWindows(asOf,end).map(m=>({month:m.month,total:(bookingMonths.get(m.month)||0)/100}));
 const rows=[...byMonth.values()].map(m=>({month:m.month,rentForecast:m.rentForecast/100,rentReceived:m.rentReceived/100,interestIn:m.interestIn/100,interestOut:m.interestOut/100,interestReceived:m.interestReceived/100,interestPaid:m.interestPaid/100}));
 return {year,asOf,rows,loansAvailable,
 bookings:{from:asOf,to:end,total:bookingSeries.reduce((sum,x)=>sum+x.total,0),confirmed,unpriced,months:bookingSeries},
 quality:{contracts:contracts.filter(c=>c.status==='active').length,loansActive:activeDeals.size,
 loansNeedingReview:[...activeDeals.values()].filter(d=>d.review_state!=='reviewed').length,
 interestEntries:interestById.size,actualRentPayments,actualLoanPayments}};
}
