import Link from 'next/link';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {requireStaffEnvironment} from '../../../../../lib/security/property-staff';
import {loadRegisters,allRows,type Params} from '../../../../../lib/property-operations/staff-data';
import type {Property,Member} from '../../../../../lib/property-operations/staff-work';
import StaffScopeForm from './StaffScopeForm';
import WorkOrders,{type Order} from './WorkOrders';
import WorkRegisters from '../../../../staff/WorkRegisters';
import s from '../../../../staff/staff.module.css';
export const dynamic='force-dynamic';
export default async function StaffAdmin({searchParams}:{searchParams:Promise<Params>}){
 requireStaffEnvironment();const {db}=await requireEstateAdmin();const params=await searchParams;
 const [data,properties,members,scopes,summary]=await Promise.all([
 loadRegisters(db,params,true),
 allRows<Property>((a,b)=>db.from('mzs_estate_properties').select('id,name',{count:'exact'}).order('id').range(a,b)),
 allRows<Member>((a,b)=>db.from('profiles').select('id,full_name,role,is_active',{count:'exact'}).in('role',['client','partner','admin']).order('id').range(a,b)),
 allRows<{profile_id:string;property_id:string;action:string}>((a,b)=>db.from('mzs_ops_current_staff_scopes').select('profile_id,property_id,action',{count:'exact'}).eq('action','grant').order('profile_id').order('property_id').range(a,b)),
 allRows<{property_id:string;name:string;open_tickets:number;pending_visits:number;approved_minutes:number;expense_draft_cents:number}>((a,b)=>db.from('mzs_ops_property_work_summary').select('*',{count:'exact'}).order('property_id').range(a,b))
 ]);
 const [orders,issuers,suppliers,payers]=data.ticket?await Promise.all([
 allRows<Order>((a,b)=>db.from('mzs_ops_current_work_orders').select('*',{count:'exact'}).eq('ticket_id',data.ticket!.id).order('created_at',{ascending:false}).order('id').range(a,b)),
 allRows<{id:string;name:string}>((a,b)=>db.from('mzs_lease_issuers').select('id,name',{count:'exact'}).order('id').range(a,b)),
 allRows<{id:string;name:string}>((a,b)=>db.from('mzs_lease_relationships').select('id,name',{count:'exact'}).order('id').range(a,b)),
 allRows<{legal_entity_id:string;effective_from:string;effective_until:string|null}>((a,b)=>db.from('mzs_ops_property_entity_links').select('legal_entity_id,effective_from,effective_until',{count:'exact'}).eq('property_id',data.ticket!.property_id).eq('relationship_type','payer').order('id').range(a,b))
 ]):[[],[],[],[]];
 const orderHistory:{id:string;work_order_id:string;decision:string;reason:string;decided_at:string}[]=[];
 for(let i=0;i<orders.length;i+=100)orderHistory.push(...await allRows<{id:string;work_order_id:string;decision:string;reason:string;decided_at:string}>((a,b)=>db.from('mzs_ops_maintenance_work_order_decisions').select('id,work_order_id,decision,reason,decided_at',{count:'exact'}).in('work_order_id',orders.slice(i,i+100).map(x=>x.id)).order('sequence_no',{ascending:false}).range(a,b)));
 const today=new Date().toISOString().slice(0,10);
 const assignedMembers=data.ticket?members.filter(m=>m.role==='admin'||scopes.some(x=>x.profile_id===m.id&&x.property_id===data.ticket!.property_id)):members;
 // Keep all names in the register but restrict the assignee selector separately.
 return <main className={s.adminPage}><Link href="/admin/workspaces/estates">← Vastgoedbeheer</Link><h1>Medewerkers &amp; onderhoud</h1><p>Beoordeel werkelijke uren, beslis over correcties en volg onderhoud op. Toegang voor medewerkers wordt hier per object toegewezen.</p>
 <section className={s.panel}><h2>Overzicht per object · alle registraties</h2><div className={s.tableWrap}><table className={s.table}><thead><tr><th>Object</th><th>Open onderhoud</th><th>Uren te beoordelen</th><th>Goedgekeurde uren</th><th>Kostenconcepten incl. btw</th></tr></thead><tbody>{summary.map(p=><tr key={p.property_id}><td><Link href={'?property='+p.property_id}>{p.name}</Link></td><td>{p.open_tickets}</td><td>{p.pending_visits} bezoeken</td><td>{(Number(p.approved_minutes)/60).toLocaleString('nl-NL',{maximumFractionDigits:2})}</td><td>{(Number(p.expense_draft_cents)/100).toLocaleString('nl-NL',{style:'currency',currency:'EUR'})}</td></tr>)}</tbody></table></div><p>Kostenconcepten zijn nog geen betaalde kosten. Uren hebben hier geen geldwaarde. Een open correctie telt mee bij de te beoordelen bezoeken.</p></section>
 <WorkRegisters data={data} params={params} properties={properties} members={members} assignees={assignedMembers} admin/>
 {data.ticket&&<WorkOrders ticket={data.ticket} orders={orders} issuers={issuers} suppliers={suppliers} payerIds={payers.filter(p=>p.effective_from<=today&&(!p.effective_until||p.effective_until>=today)).map(p=>p.legal_entity_id)} history={orderHistory}/>}
 <details className={s.panel}><summary>Medewerkertoegang beheren</summary><p>Proeftoegang wordt niet automatisch omgezet. Wijs elk echt object bewust toe.</p><StaffScopeForm members={members.filter(m=>['client','partner'].includes(m.role))} properties={properties}/><h3>Vastgelegde objecttoegang</h3>{!scopes.length&&<p>Nog geen echte objecttoegang toegewezen.</p>}<ul>{scopes.map(x=><li key={x.profile_id+x.property_id}>{members.find(m=>m.id===x.profile_id)?.full_name??'Account'} · {properties.find(p=>p.id===x.property_id)?.name??'Object'}{members.find(m=>m.id===x.profile_id)?.is_active===false&&' · account inactief'}</li>)}</ul></details>
 </main>;
}
