
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import Link from "next/link";
import BookingManagement from "../../BookingManagement";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
export const dynamic="force-dynamic";
export default async function BookingOperations({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 await requireEstateAdmin();
 const params=await searchParams;
 const section=params.view==="calendar"?"calendar":params.view==="cancellations"?"cancellations":"bookings";
 const scope=params.scope==="test"?"test":"live";
 return <main style={{background:"#0d0d0c",color:"#eee8dd",minHeight:"100vh",padding:"32px clamp(18px,4vw,60px)"}}>
  <Link href="/admin/bookings" style={{color:"#d5c09a"}}>{adminT("← All bookings")}</Link>
  <h1>{adminT("Booking operations")}</h1>
  <p>{adminT("Review requests, manage the calendar and clean up test bookings.")}</p>
  <nav aria-label={adminT("Booking operations")} style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:24}}>
   <Link href="/admin/bookings/operations">{adminT("Requests")}</Link>
   <Link href="/admin/bookings/operations?view=calendar">{adminT("Calendar")}</Link>
   <Link href="/admin/bookings/operations?view=cancellations">{adminT("Cancellation requests")}</Link>
   <Link href="/admin/bookings/operations?scope=test">{adminT("Test cleanup")}</Link>
  </nav>
  {scope==="test"&&<p>{adminT("Only eligible test records can be permanently deleted. Review each record before confirming deletion.")}</p>}
  <BookingManagement key={section+scope} initialSection={section} initialScope={scope}/>
 </main>;
}
