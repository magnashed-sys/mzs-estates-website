/** Arrival-date boundary for the currently displayed descending page. */
export function bookingTodayBoundary(rows:{checkIn:string}[],today:string){
 const first=rows.findIndex(r=>r.checkIn<=today);
 return first<0?rows.length:first;
}
export function bookingToday(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=(type:string)=>parts.find(p=>p.type===type)!.value;
 return part('year')+'-'+part('month')+'-'+part('day');
}
