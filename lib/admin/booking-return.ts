/** Accept only the booking register and its known filters as a return destination. */
export function bookingReturnHref(value: unknown): string {
 const fallback="/admin/bookings";
 if(typeof value!=="string"||value.length>2000||!(value===fallback||value.startsWith(fallback+"?")))return fallback;
 const input=new URLSearchParams(value.slice(fallback.length+1));
 const output=new URLSearchParams();
 for(const key of ["q","year","property","category","status","period","archive","size","page"]){
  const values=input.getAll(key);
  if(values.length===1&&values[0])output.set(key,values[0].slice(0,key==="q"?150:100));
 }
 return fallback+(output.size?"?"+output.toString():"");
}
