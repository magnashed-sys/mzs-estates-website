import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import {accountingCsv,bookingAllocation} from "../../../../lib/estates/booking-accounting";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"};
type Row={id:string;category:string;status:string;property:string;guestName:string;invoiceRecipient:string;sourceRef:string;checkIn:string;checkOut:string;amount:number|null};
export async function GET(request:Request){
 const {db}=await requireEstateAdmin();
 const raw=new URL(request.url).searchParams.get("year")||"";
 if(!/^\d{4}$/.test(raw)||Number(raw)<1900||Number(raw)>2199)return new Response("Select a valid arrival year.",{status:400,headers});
 const year=Number(raw);const rows:unknown[][]=[["Allocation year (arrival basis)","Administrative allocation date (not payment or invoice date)","Booking ID","Original reference","Property","Guest","Invoice recipient","Check-in","Check-out","Booking total EUR","Recorded paid EUR","Outstanding EUR","Overpaid EUR","Payment status","Known payment dates","Historical settlement EUR (date unknown)","Other undated receipts EUR","Issued invoice number","Actual invoice issue date"]];
 try{
  let expected:number|null=null;const seen=new Set<string>();
  for(let offset=0;;offset+=100){
   if(offset>=100000)throw Error("Export too large");
   const result=await db.rpc("mzs_admin_bookings_search_v2",{p_year:year,p_category:"Guest booking",p_status:"confirmed",p_period:"all",p_archive:"active",p_offset:offset,p_limit:100});
   if(result.error||!result.data||!Array.isArray(result.data.items))throw Error("Booking data unavailable");
   if(expected===null)expected=result.data.total;
   if(expected!==result.data.total)throw Error("Bookings changed during export");
   const items=result.data.items as Row[];
   for(const b of items){
    if(seen.has(b.id))throw Error("Bookings changed during export");seen.add(b.id);
    const allocation=bookingAllocation(b.checkIn);
    if(allocation.allocationYear!==year||b.category!=="Guest booking"||b.status!=="confirmed")throw Error("Unexpected booking");
    const [booking,owner,invoice]=await Promise.all([
     db.from("rental_bookings").select("is_test,check_in,check_out,status,quoted_total_eur").eq("id",b.id).single(),
     db.from("mzs_owner_stay_requests").select("id").eq("booking_id",b.id).maybeSingle(),
     db.from("mzs_booking_invoices").select("number,issued_on").eq("booking_id",b.id).maybeSingle()
    ]);
    if(booking.error||owner.error||invoice.error)throw Error("Accounting data unavailable");
    if(booking.data.is_test||owner.data)continue;
    if(booking.data.check_in!==b.checkIn||booking.data.check_out!==b.checkOut||booking.data.status!==b.status||Number(booking.data.quoted_total_eur)!==Number(b.amount))throw Error("Booking changed during export");
    let paid=0,historical=0,undated=0;const dates=new Set<string>();
    for(let receiptOffset=0;;receiptOffset+=1000){
     if(receiptOffset>=50000)throw Error("Too many receipts");
     const receipts=await db.from("mzs_booking_receipts").select("id,amount,received_on,receipt_type").eq("booking_id",b.id).is("reversed_at",null).order("id").range(receiptOffset,receiptOffset+999);
     if(receipts.error)throw Error("Payment data unavailable");
     for(const r of receipts.data||[]){const cents=Math.round(Number(r.amount)*100);paid+=cents;
      if(r.received_on)dates.add(r.received_on);else if(r.receipt_type==="historical_settlement")historical+=cents;else undated+=cents;
     }
     if((receipts.data||[]).length<1000)break;
    }
    const total=b.amount===null?null:Math.round(Number(b.amount)*100);
    const amount=(cents:number)=> (cents/100).toFixed(2);
    rows.push([year,allocation.allocationDate,b.id,b.sourceRef,b.property,b.guestName,b.invoiceRecipient,b.checkIn,b.checkOut,total===null?"":amount(total),amount(paid),total===null?"":amount(Math.max(total-paid,0)),total===null?"":amount(Math.max(paid-total,0)),total===null?"Not priced":total===0?"No charge":paid>total?"Overpaid":paid===total?"Paid":paid>0?"Partly paid":"Unpaid",[...dates].sort().join(", "),amount(historical),amount(undated),invoice.data?.number||"",invoice.data?.issued_on||""]);
   }
   if(seen.size===expected)break;
   if(items.length<100)throw Error("Incomplete booking export");
  }
  return new Response(accountingCsv(rows),{headers:{...headers,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="MZS-bookings-arrival-year-${year}.csv"`}});
 }catch{return new Response("The complete accounting export could not be generated. Please retry; no partial export was produced.",{status:503,headers});}
}
