export function bookingAllocation(checkIn:string){
 const date=new Date(checkIn+"T12:00:00Z");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(checkIn)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==checkIn)throw Error("Invalid arrival date");
 return {allocationDate:checkIn,allocationYear:Number(checkIn.slice(0,4))};
}
export function accountingCsv(rows:unknown[][]){
 // Prevent formula execution when a guest/reference is opened in a spreadsheet.
 const cell=(v:unknown)=>{let s=v==null?"":String(v);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n';
}
