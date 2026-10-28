/** Read-only register filters. Never interpolate arbitrary PostgREST syntax. */
export const EXPENSE_PAGE_SIZE = 25;
export type ExpenseFilters = {q:string;property:string;entity:string;supplier:string;from:string;until:string;page:number};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function expenseFilters(params:Record<string,string|string[]|undefined>):ExpenseFilters {
 const one=(key:string)=>typeof params[key]==="string"?params[key] as string:"";
 const id=(key:string)=>{const value=one(key);if(value&&!uuid.test(value))throw new Error("Invalid filter. Clear the filters and retry.");return value;};
 const date=(key:string)=>{const value=one(key);if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+"T12:00:00Z"))||new Date(value+"T12:00:00Z").toISOString().slice(0,10)!==value))throw new Error("Choose a valid date.");return value;};
 const from=date("from"),until=date("until");
 if(from&&until&&from>until)throw new Error("The end date must be on or after the start date.");
 const rawPage=one("page");
 const page=/^[1-9]\d{0,5}$/.test(rawPage)?Number(rawPage):1;
 return {q:one("q").replace(/[^\p{L}\p{N}\s-]/gu," ").replace(/\s+/g," ").trim().slice(0,100),property:id("property"),entity:id("entity"),supplier:id("supplier"),from,until,page};
}
export function expenseRegisterHref(filters:ExpenseFilters,page:number):string {
 const query=new URLSearchParams();
 for(const key of ["q","property","entity","supplier","from","until"] as const)if(filters[key])query.set(key,filters[key]);
 if(page>1)query.set("page",String(page));
 return "/admin/workspaces/estates/expenses"+(query.size?"?"+query.toString():"")+"#expense-register";
}
/** Counts deliberately describe one visible page, never a partial grand total. */
export function expensePageTotals(rows:readonly {net_cents:number;vat_cents:number;gross_cents:number}[]){
 let net=0,vat=0,gross=0;
 for(const row of rows){
  const amounts=[row.net_cents,row.vat_cents,row.gross_cents];
  if(amounts.some(x=>!Number.isSafeInteger(x)||x<0)||row.net_cents+row.vat_cents!==row.gross_cents)throw new Error("Expense amounts cannot be added reliably.");
  net+=row.net_cents;vat+=row.vat_cents;gross+=row.gross_cents;
 }
 if([net,vat,gross].some(x=>!Number.isSafeInteger(x)))throw new Error("Expense amounts out of range.");
 return {net,vat,gross};
}
