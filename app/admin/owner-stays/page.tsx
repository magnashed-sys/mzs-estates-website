import Link from 'next/link';
import {requireEstateAdmin} from '../../../lib/security/estate-properties';
import {grantPartner,decideOwnerStay,adjustBookingPrice} from './actions';
export const dynamic='force-dynamic';
const money=(n:number|string|null)=>n===null?'Not priced':new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR'}).format(Number(n));
export default async function PropertyPartnerManagement(){
 const {db}=await requireEstateAdmin();
 const [people,projects,grants,requests,bookings]=await Promise.all([
 db.from('profiles').select('id,full_name,email,role').in('role',['client','partner']).eq('is_active',true).order('full_name'),
 db.from('projects').select('id,title').order('title'),
 db.from('mzs_property_partners').select('id,profile_id,project_id,complimentary_owner_stays,is_active'),
 db.from('mzs_owner_stay_requests').select('id,partner_id,check_in,check_out,guest_count,status,notes,booking_id').order('created_at',{ascending:false}),
 db.rpc('admin_list_rental_bookings').in('status',['confirmed','requested']).eq('is_test',false).order('check_in',{ascending:false}).limit(200)
 ]);
 const sections={people:people.error?.message,projects:projects.error?.message,grants:grants.error?.message,requests:requests.error?.message,bookings:bookings.error?.message};
 const failures=Object.entries(sections).filter(([,message])=>!!message).map(([key])=>key);
 if(failures.length)console.error('Property partners: unavailable admin data sections',failures);

 const names=new Map((people.data||[]).map(x=>[x.id,x.full_name||x.email]));
 const places=new Map((projects.data||[]).map(x=>[x.id,x.title]));
 const grantIndex=new Map((grants.data||[]).map(x=>[x.id,x]));
 const field={padding:'9px',background:'#24221f',color:'#fff',border:'1px solid #655c4c'} as const;
 const section={padding:24,border:'1px solid #5b503e',background:'#151411',marginTop:24} as const;
 return <main style={{padding:'40px clamp(20px,5vw,75px)',background:'#0f0f0e',color:'#f2eee8',minHeight:'100vh'}}>
 <Link href='/admin?tab=bookings' style={{color:'#d5c09a'}}>← Booking administration</Link>
 <h1 style={{fontFamily:'Georgia,serif',fontWeight:400}}>Property Partners & Owner Stays</h1>
 <p style={{color:'#b9aa94'}}>Property-specific rights, admin approval and auditable booking prices.</p>
 {failures.length>0&&<p role='alert' style={{padding:16,border:'1px solid #a9845a'}}>Some sections could not load ({failures.join(', ')}). No changes have been made; please refresh or check administrator permissions.</p>}
 <section style={section}><h2>Grant complimentary owner-stay access</h2>
 <form action={grantPartner} style={{display:'flex',flexWrap:'wrap',gap:14,alignItems:'end'}}>
 <label>Existing client or partner<br/><select name='profile_id' required style={field}><option value=''>Select account</option>{(people.data||[]).map(x=><option key={x.id} value={x.id}>{x.full_name||x.email} ({x.role})</option>)}</select></label>
 <label>Property<br/><select name='project_id' required style={field}><option value=''>Select property</option>{(projects.data||[]).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
 <button disabled={!!(people.error||projects.error||grants.error)} style={field}>Grant access · approval required</button></form>
 <p style={{color:'#b9aa94'}}>Permissions are linked to the existing account. No global administrator access is granted. Partner requests are always free and require approval.</p>
 {(grants.data||[]).map(g=><p key={g.id}>{names.get(g.profile_id)||'Account'} · {places.get(g.project_id)||'Property'} · {g.is_active?'Active':'Inactive'}</p>)}
 </section>
 <section style={section}><h2>Owner-stay requests</h2>
 {(requests.data||[]).length===0?<p>No requests yet.</p>:(requests.data||[]).map(r=>{const g=grantIndex.get(r.partner_id);return <article key={r.id} style={{padding:'16px 0',borderBottom:'1px solid #4b4234'}}>
 <strong>{names.get(g?.profile_id||'')||'Partner'} · {places.get(g?.project_id||'')||'Property'}</strong>
 <p>{r.check_in} – {r.check_out} · {r.guest_count} guests · {r.status.toUpperCase()} · €0 owner stay</p><p>{r.notes}</p>
 {r.status==='requested'&&<form action={decideOwnerStay} style={{display:'flex',gap:12}}><input type='hidden' name='request_id' value={r.id}/>
 <button name='decision' value='approve' style={field}>Approve · create confirmed stay</button>
 <button name='decision' value='decline' style={field}>Decline</button></form>}
 </article>})}
 </section>
 <section style={section}><h2>Booking price editor</h2><p style={{color:'#b9aa94'}}>Updates are audit-logged; no payment is generated or edited. Existing issued invoices require separate accounting adjustments.</p>
 {(bookings.data||[]).map(b=><details key={b.id} style={{borderBottom:'1px solid #4b4234',padding:'14px 0'}}><summary>{places.get(b.project_id)||'Property'} · {b.check_in} – {b.check_out} · {money(b.quoted_total_eur)} · {b.status}</summary>
 <form action={adjustBookingPrice} style={{display:'flex',flexWrap:'wrap',gap:12,paddingTop:12}}>
 <input type='hidden' name='booking_id' value={b.id}/><input type='hidden' name='expected' value={b.quoted_total_eur===null?'':String(b.quoted_total_eur)}/>
 <label>New total EUR<br/><input type='number' min='0' step='0.01' name='total' required defaultValue={b.quoted_total_eur??0} style={field}/></label>
 <label>Reason for change<br/><input name='reason' required minLength={5} maxLength={500} style={field}/></label>
 <button style={field}>Save audited price</button></form></details>)}
 </section></main>;
}
