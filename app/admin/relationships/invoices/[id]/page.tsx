
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {uuid} from '../../../../../lib/property-operations/staff-work';
import {customerInvoicesHref} from '../../../../../lib/property-operations/archive-customers';
import {loadInvoiceRegister} from '../../../../../lib/finance/invoice-register';
import {allRows} from '../../../../../lib/property-operations/staff-data';
import s from '../../../../staff/staff.module.css';
export const dynamic='force-dynamic';
const euro=(n:number|null, adminLocale = 'en-GB')=>n===null?'Unknown':new Intl.NumberFormat(adminLocale,{style:'currency',currency:'EUR'}).format(n/100);
type Invoice={id:string;issuer_id:string;number:string;issued_on:string;customer_name:string;subject:string;net_cents:number;gross_cents:number;source_open_cents:number};
export default async function CustomerInvoices({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 requireStaffEnvironment();const {db}=await requireEstateAdmin();const {id}=await params;if(!uuid.test(id))notFound();
 const {data:customer,error}=await db.from('mzs_lease_relationships').select('id,name').eq('id',id).maybeSingle();if(error)throw Error("Customer could not be loaded");if(!customer)notFound();
 let invoices:Invoice[]=[];let expected:number|undefined;
 for(let offset=0;offset<10000;offset+=500){
  const {data,error,count}=await db.from('mzs_invoice_archive_customers').select('invoice:mzs_invoice_archive!inner(id,issuer_id,number,issued_on,customer_name,subject,net_cents,gross_cents,source_open_cents)',{count:'exact'}).eq('relationship_id',id).order('invoice_id').range(offset,offset+499);
  if(error||!data||count===null||expected!==undefined&&count!==expected)throw Error("Invoice links could not be fully loaded");expected=count;
  for(const row of data){const invoice=row.invoice as unknown as Invoice;if(!invoice?.id)throw Error("Linked invoice is missing");invoices.push(invoice);}
  if(data.length<500)break;
 }
 if(invoices.length!==expected||new Set(invoices.map(i=>i.id)).size!==invoices.length)throw Error("Incomplete invoice overview");
 const excluded=await allRows<{invoice_id:string}>((a,b)=>db.from('mzs_invoice_archive_exclusions').select('invoice_id',{count:'exact'}).order('invoice_id').range(a,b) as unknown as PromiseLike<{data:{invoice_id:string}[]|null;error:unknown;count:number|null}>);
 const excludedIds=new Set(excluded.map(x=>x.invoice_id));invoices=invoices.filter(i=>i.issued_on.startsWith('2026-')&&!excludedIds.has(i.id));
 const current=await loadInvoiceRegister(db,2026),byIdentity=new Map(current.map(i=>[i.issuerId+':'+i.number.trim().toUpperCase(),i]));
 const currentRow=(i:Invoice)=>{const row=byIdentity.get(i.issuer_id+':'+i.number.trim().toUpperCase());if(!row)throw Error('Linked invoice missing from current register');return row;};
 const currentBalance=(i:Invoice)=>currentRow(i).balance;
 const currentTotal=invoices.reduce((sum,i)=>sum+(currentBalance(i)??0),0);if(!Number.isSafeInteger(currentTotal))throw Error('Invalid current total');
 invoices.sort((a,b)=>b.issued_on.localeCompare(a.issued_on)||b.number.localeCompare(a.number));
 const raw=(await searchParams).page??'1',page=/^[1-9]\d*$/.test(raw)?Number(raw):1,pages=Math.max(1,Math.ceil(invoices.length/25));
 if(!Number.isSafeInteger(page)||page>pages)redirect(customerInvoicesHref(id)+'?page='+pages);
 const sum=(key:'net_cents'|'gross_cents'|'source_open_cents')=>{let total=0;for(const i of invoices){if(!Number.isSafeInteger(i[key]))throw Error("Invalid invoice amount");total+=i[key];if(!Number.isSafeInteger(total))throw Error("Invalid total");}return total;};
 return <main className={s.adminPage}><Link href={'/admin/relationships?edit='+id}>{adminT("← Customer details")}</Link><h1>{customer.name}</h1><h2>{adminT("Linked historical invoices · 2026")}</h2><p>{invoices.length}  {adminT("invoices · excluding VAT")} {euro(sum('net_cents'), adminLocale)}  {adminT("· including VAT")} {euro(sum('gross_cents'), adminLocale)}  {adminT("· current balance")} {euro(currentTotal, adminLocale)}  {adminT("(original Gripp balance")} {euro(sum('source_open_cents'), adminLocale)}).</p><p>{adminT("Source amounts include credits. Current balances include additional registered receipts and reversals. Unknown balances are excluded from the total. Original Gripp balances remain source snapshots, not bank reconciliation. Excluded invoices are omitted. This overview is for administrators only.")}</p><div className={s.tableWrap}><table className={s.table}><thead><tr><th>{adminT("Invoice")}</th><th>{adminT("Date")}</th><th>{adminT("Subject")}</th><th>{adminT("Incl. VAT")}</th><th>{adminT("Current balance")}</th><th>{adminT("Original Gripp balance")}</th></tr></thead><tbody>{invoices.slice((page-1)*25,page*25).map(i=><tr key={i.id}><td><Link href={currentRow(i).href}>{i.number}</Link></td><td>{i.issued_on}</td><td>{i.subject}</td><td>{euro(i.gross_cents, adminLocale)}</td><td>{euro(currentBalance(i), adminLocale)}</td><td>{euro(i.source_open_cents, adminLocale)}</td></tr>)}</tbody></table></div>{!invoices.length&&<p>{adminT("No historical invoices have been linked to this customer yet.")}</p>}<nav className={s.pagination} aria-label={adminT("Customer invoice pages")}>{page>1&&<Link href={customerInvoicesHref(id)+'?page='+(page-1)}>{adminT("← Previous")}</Link>}<span>{adminT("Page")} {page}  {adminT("of")} {pages}</span>{page<pages&&<Link href={customerInvoicesHref(id)+'?page='+(page+1)}>{adminT("Next →")}</Link>}</nav><Link href="/admin/workspaces/accountancy/invoices?year=2026">{adminT("All historical invoices for 2026 →")}</Link></main>;
}
