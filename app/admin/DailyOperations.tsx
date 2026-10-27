"use client";
import dynamic from "next/dynamic";
import {useRouter} from "next/navigation";
const BookingManagement=dynamic(()=>import("./BookingManagement"),{loading:()=> <p role="status">Loading upcoming arrivals…</p>});
export default function DailyOperations(){
 const router=useRouter();
 return <BookingManagement mode="summary" onNavigate={section=>router.push("/admin/bookings/operations"+(section==="cancellations"?"?view=cancellations":""))}/>;
}
