import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {uuid} from '../../../../../lib/property-operations/staff-work';
import {customerInvoicesHref} from '../../../../../lib/property-operations/archive-customers';
import s from '../../../../staff/staff.module.css';
export const dynamic='force-dynamic';
const euro=(n:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(n/100);
type Invoice={id:string;number:string;issued_on:string;customer_name:string;subject:string;net_cents:number;gross_cents:number;source_open_cents:number};
export default async function CustomerInvoices({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}){
 requireStaffEnvironment();const {db}=await requireEstateAdmin();const {id}=await params;if(!uuid.test(id))notFound();
 const {data:customer,error}=await db.from('mzs_lease_relationships').select('id,name').eq('id',id).maybeSingle();if(error)throw Error('Klant kon niet worden geladen');if(!customer)notFound();
 const invoices:Invoice[]=[];let expected:number|undefined;
 for(let offset=0;offset<10000;offset+=500){
  const {data,error,count}=await db.from('mzs_invoice_archive_customers').select('invoice:mzs_invoice_archive!inner(id,number,issued_on,customer_name,subject,net_cents,gross_cents,source_open_cents)',{count:'exact'}).eq('relationship_id',id).order('invoice_id').range(offset,offset+499);
  if(error||!data||count===null||expected!==undefined&&count!==expected)throw Error('Factuurkoppelingen konden niet volledig worden geladen');expected=count;
  for(const row of data){const invoice=row.invoice as unknown as Invoice;if(!invoice?.id)throw Error('Gekoppelde factuur ontbreekt');invoices.push(invoice);}
  if(data.length<500)break;
 }
 if(invoices.length!==expected||new Set(invoices.map(i=>i.id)).size!==invoices.length)throw Error('Onvolledig factuuroverzicht');
 invoices.sort((a,b)=>b.issued_on.localeCompare(a.issued_on)||b.number.localeCompare(a.number));
 const raw=(await searchParams).page??'1',page=/^[1-9]\d*$/.test(raw)?Number(raw):1,pages=Math.max(1,Math.ceil(invoices.length/25));
 if(!Number.isSafeInteger(page)||page>pages)redirect(customerInvoicesHref(id)+'?page='+pages);
 const sum=(key:'net_cents'|'gross_cents'|'source_open_cents')=>{let total=0;for(const i of invoices){if(!Number.isSafeInteger(i[key]))throw Error('Ongeldig factuurbedrag');total+=i[key];if(!Number.isSafeInteger(total))throw Error('Ongeldig totaal');}return total;};
 return <main className={s.adminPage}><Link href={'/admin/relationships?edit='+id}>← Klantgegevens</Link><h1>{customer.name}</h1><h2>Gekoppelde historische facturen · 2026</h2><p>{invoices.length} facturen · exclusief btw {euro(sum('net_cents'))} · inclusief btw {euro(sum('gross_cents'))} · open volgens Gripp {euro(sum('source_open_cents'))}.</p><p>Bronbedragen inclusief credits; openstaande bedragen zijn historische bronstanden, geen actuele bankcontrole. Dit overzicht is alleen voor beheerders.</p><div className={s.tableWrap}><table className={s.table}><thead><tr><th>Factuur</th><th>Datum</th><th>Onderwerp</th><th>Incl. btw</th><th>Open volgens bron</th></tr></thead><tbody>{invoices.slice((page-1)*25,page*25).map(i=><tr key={i.id}><td><Link href={'/admin/workspaces/accountancy/invoices/'+i.id}>{i.number}</Link></td><td>{i.issued_on}</td><td>{i.subject}</td><td>{euro(i.gross_cents)}</td><td>{euro(i.source_open_cents)}</td></tr>)}</tbody></table></div>{!invoices.length&&<p>Er zijn nog geen historische facturen aan deze klant gekoppeld.</p>}<nav className={s.pagination} aria-label="Klantfactuurpagina’s">{page>1&&<Link href={customerInvoicesHref(id)+'?page='+(page-1)}>← Vorige</Link>}<span>Pagina {page} van {pages}</span>{page<pages&&<Link href={customerInvoicesHref(id)+'?page='+(page+1)}>Volgende →</Link>}</nav><Link href="/admin/workspaces/accountancy/invoices?year=2026">Alle historische facturen van 2026 →</Link></main>;
}
