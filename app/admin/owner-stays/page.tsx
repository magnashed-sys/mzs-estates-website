
import {getAdminI18n} from '../../../lib/admin/i18n-server';
import Link from 'next/link';
import {requireEstateAdmin} from '../../../lib/security/estate-properties';
import {grantPartner,adjustBookingPrice} from './actions';
import OwnerStayDecision from './OwnerStayDecision';
import OwnerStayCleanup from './OwnerStayCleanup';
export const dynamic='force-dynamic';
const money=(n:number|string|null, adminLocale = 'en-GB')=>n===null?'Not priced':new Intl.NumberFormat(adminLocale,{style:'currency',currency:'EUR'}).format(Number(n));
export default async function PropertyPartnerManagement(){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

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
 // Exact calendar-overlap checks for each distinct pending owner-stay interval.
 // Reuse one query for duplicate submissions; never load private booking data
 // outside the existing administrator guard.
 const pending=(requests.data||[]).filter(r=>r.status==='requested');
 const intervals=new Map<string,{projectId:string;checkIn:string;checkOut:string}>();
 for(const request of pending){
  const grant=grantIndex.get(request.partner_id);
  if(!grant)continue;
  const key=[grant.project_id,request.check_in,request.check_out].join('|');
  intervals.set(key,{projectId:grant.project_id,checkIn:request.check_in,checkOut:request.check_out});
 }
 const entries=[...intervals];
 const checked=await Promise.all(entries.map(([,span])=>db.from('rental_bookings')
  .select('id,check_in,check_out,status')
  .eq('project_id',span.projectId).eq('is_test',false)
  .in('status',['confirmed','blocked'])
  .lt('check_in',span.checkOut).gt('check_out',span.checkIn)
  .order('check_in',{ascending:true}).limit(2)));
 const conflictByInterval=new Map(entries.map(([key],i)=>[key,checked[i]]));
 const conflictError=checked.some(result=>Boolean(result.error));
 const field={padding:'9px',background:'#24221f',color:'#fff',border:'1px solid #655c4c'} as const;
 const section={padding:24,border:'1px solid #5b503e',background:'#151411',marginTop:24} as const;
 return <main style={{padding:'40px clamp(20px,5vw,75px)',background:'#0f0f0e',color:'#f2eee8',minHeight:'100vh'}}>
 <Link href='/admin/bookings' style={{color:'#d5c09a'}}>{adminT("← Bookings")}</Link>
 <h1 style={{fontFamily:'Georgia,serif',fontWeight:400}}>{adminT("Property Partners & Owner Stays")}</h1>
 <p style={{color:'#b9aa94'}}>{adminT("Property-specific rights, admin approval and auditable booking prices.")}</p>
 {failures.length>0&&<p role='alert' style={{padding:16,border:'1px solid #a9845a'}}>{adminT("Some sections could not load (")}{failures.join(', ')}{adminT("). No changes have been made; please refresh or check administrator permissions.")}</p>}
 <section style={section}><h2>{adminT("Grant complimentary owner-stay access")}</h2>
 <form action={grantPartner} style={{display:'flex',flexWrap:'wrap',gap:14,alignItems:'end'}}>
 <label>{adminT("Existing client or partner")}<br/><select name='profile_id' required style={field}><option value=''>{adminT("Select account")}</option>{(people.data||[]).map(x=><option key={x.id} value={x.id}>{x.full_name||x.email} ({adminT(x.role)})</option>)}</select></label>
 <label>{adminT("Property")}<br/><select name='project_id' required style={field}><option value=''>{adminT("Select property")}</option>{(projects.data||[]).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
 <button disabled={!!(people.error||projects.error||grants.error)} style={field}>{adminT("Grant access · approval required")}</button></form>
 <p style={{color:'#b9aa94'}}>{adminT("Permissions are linked to the existing account. No global administrator access is granted. Partner requests are always free and require approval.")}</p>
 {(grants.data||[]).map(g=><p key={g.id}>{names.get(g.profile_id)||adminT("Account")} · {places.get(g.project_id)||adminT("Property")} · {g.is_active?adminT("Active"):adminT("Inactive")}</p>)}
 </section>
 <section style={section}><h2>{adminT("Owner-stay requests")}</h2>
 <p style={{color:'#b9aa94'}}>{adminT("Every approval is checked against confirmed stays and unavailable periods. An overlapping request cannot create a second reservation.")}</p>
 {conflictError&&<p role='alert' style={{padding:14,border:'1px solid #a9845a',color:'#e3a995'}}>{adminT("Availability checks could not be completed. Approvals are temporarily disabled; refresh the page and verify the calendar before proceeding.")}</p>}
 {(requests.data||[]).length===0?<p>{adminT("No requests yet.")}</p>:(requests.data||[]).map(r=>{const g=grantIndex.get(r.partner_id);const check=g?conflictByInterval.get([g.project_id,r.check_in,r.check_out].join('|')):null;const conflict=check?.data?.[0];const blocked=Boolean(r.status==='requested'&&(!g||!check||check.error||conflictError||conflict));return <article id={'request-'+r.id} key={r.id} style={{padding:'16px 0',borderBottom:'1px solid #4b4234'}}>
 <strong>{names.get(g?.profile_id||'')||adminT("Partner")} · {places.get(g?.project_id||'')||adminT("Property")}</strong>
 <p>{r.check_in} – {r.check_out} · {r.guest_count}  {adminT("guests ·")} {adminT(r.status.toUpperCase())}  {adminT("· €0 owner stay")}</p><p>{r.notes}</p>
 {r.booking_id&&<Link href={'/admin/bookings/'+r.booking_id} style={{color:'#d5c09a'}}>{adminT("Open reservation dossier →")}</Link>}
 {r.status==='requested'&&conflict&&<p role="alert" style={{padding:12,color:'#f0c0a5',border:'1px solid #8a624c',lineHeight:1.7}}>
   <strong>{adminT("Approval blocked: dates already occupied.")}</strong>  {adminT("An existing")} {adminT(conflict.status)}  {adminT("reservation or unavailable period runs from")} {conflict.check_in}  {adminT("to")} {conflict.check_out}{adminT(". This request cannot be accepted without resolving that conflict.")}{' '}<Link href={'/admin/bookings/'+conflict.id} style={{color:'#d5c09a'}}>{adminT("Open existing booking →")}</Link>
 </p>}
 {r.status==='requested'&&!conflict&&blocked&&<p role="alert" style={{color:'#e3a995'}}>{adminT("Approval is disabled because the property or calendar could not be verified. You can still decline the request.")}</p>}
 {r.status==='requested'&&<OwnerStayDecision id={r.id} blocked={blocked}/>}
 {['declined','cancelled'].includes(r.status)&&!r.booking_id&&<OwnerStayCleanup id={r.id} status={r.status} checkIn={r.check_in} checkOut={r.check_out}/>}

 </article>})}
 </section>
 <section style={section}><h2>{adminT("Booking price editor")}</h2><p style={{color:'#b9aa94'}}>{adminT("Updates are audit-logged; no payment is generated or edited. Existing issued invoices require separate accounting adjustments.")}</p>
 {(bookings.data||[]).map(b=><details key={b.id} style={{borderBottom:'1px solid #4b4234',padding:'14px 0'}}><summary>{places.get(b.project_id)||adminT("Property")} · {b.check_in} – {b.check_out} · {money(b.quoted_total_eur, adminLocale)} · {adminT(b.status)}</summary>
 <form action={adjustBookingPrice} style={{display:'flex',flexWrap:'wrap',gap:12,paddingTop:12}}>
 <input type='hidden' name='booking_id' value={b.id}/><input type='hidden' name='expected' value={b.quoted_total_eur===null?'':String(b.quoted_total_eur)}/>
 <label>{adminT("New total EUR")}<br/><input type='number' min='0' step='0.01' name='total' required defaultValue={b.quoted_total_eur??0} style={field}/></label>
 <label>{adminT("Reason for change")}<br/><input name='reason' required minLength={5} maxLength={500} style={field}/></label>
 <button style={field}>{adminT("Save audited price")}</button></form></details>)}
 </section></main>;
}

