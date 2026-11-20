import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireContractAdmin} from '../../../../../../../../lib/security/estate-contracts';
import {allRows} from '../../../../../../../../lib/property-operations/staff-data';

const outcomes:Record<string,string>={accepted:'Geaccepteerd door mailserver',captured:'Opgevangen in testomgeving',failed:'Verzending mislukt',uncertain:'Uitkomst onbekend',sending:'Wordt verzonden',unsent:'Nog niet verzonden'};
export default async function History({params}:{params:Promise<{id:string}>}){
 const {db}=await requireContractAdmin();const {id}=await params;
 const {data:invoice,error}=await db.from('mzs_lease_invoices').select('number,payload,delivery_status').eq('id',id).maybeSingle();
 if(error)throw Error('Factuur kon niet worden geladen');if(!invoice)notFound();
 const events=await allRows<{id:string;created_at:string;action:string;new_record:{status?:string}}>((from,to)=>db.from('mzs_lease_audit').select('id,created_at,action,new_record',{count:'exact'}).eq('new_record->>invoice_id',id).in('action',['invoice:delivery_requested','invoice:copy_requested','invoice:delivery_result']).order('created_at').order('id').range(from,to));
 const date=new Intl.DateTimeFormat('nl-NL',{dateStyle:'medium',timeStyle:'medium',timeZone:'Europe/Amsterdam'});
 return <section><Link href={'/admin/group/estates/contracts?view=billing&invoice='+id}>Terug naar factuur</Link><h1>Verzendhistorie · {invoice.number}</h1>
 <p>Ontvanger: {invoice.payload.snapshot.tenant_email||'Onbekend'}</p><p>Huidige status: {outcomes[invoice.delivery_status]??invoice.delivery_status}</p>
 {events.length?<ol>{events.map(e=><li key={e.id}><time dateTime={e.created_at}>{date.format(new Date(e.created_at))}</time> · {e.action==='invoice:copy_requested'?'Kopie aangevraagd':e.action==='invoice:delivery_requested'?'Verzending aangevraagd':outcomes[e.new_record.status??'']??'Uitkomst onbekend'}</li>)}</ol>:<p>Geen verzendgebeurtenissen geregistreerd.</p>}</section>;
}
