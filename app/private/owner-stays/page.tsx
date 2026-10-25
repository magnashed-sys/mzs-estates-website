import Link from 'next/link';
import {redirect,notFound} from 'next/navigation';
import {createClient} from '../../../lib/supabase/server';
import {isPhase3aPreviewIsolated} from '../../../lib/security/phase3a-preview-isolation';
import {requestOwnerStay} from './actions';
export const dynamic='force-dynamic';
export default async function OwnerStays(){
 if(!isPhase3aPreviewIsolated())notFound();
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/login');
 const [grants,requests]=await Promise.all([
 db.from('mzs_property_partners').select('id,project_id,projects(title)').eq('profile_id',user.id).eq('is_active',true).eq('complimentary_owner_stays',true),
 db.from('mzs_owner_stay_requests').select('id,partner_id,check_in,check_out,status,guest_count,notes').order('created_at',{ascending:false})
 ]);
 if(grants.error||requests.error)throw Error('Owner access cannot be loaded');
 const input={padding:10,background:'#24221f',border:'1px solid #665a45',color:'#f4f0e8'} as const;
 return <main style={{minHeight:'100vh',background:'#0e0e0d',color:'#eee6d9',padding:'45px clamp(20px,6vw,90px)'}}>
 <Link href='/private' style={{color:'#d5c09a'}}>← Private access</Link>
 <p style={{letterSpacing:3,color:'#c6ae84'}}>MZS GROUP / PROPERTY PARTNERS</p><h1 style={{fontFamily:'Georgia,serif',fontWeight:400}}>My owner stays</h1>
 <p>Request complimentary stays at properties where you have owner-use rights. All requests require MZS administrator approval. A request does not reserve dates until approved.</p>
 {(grants.data||[]).map(g=><section key={g.id} style={{border:'1px solid #5b503e',padding:24,marginTop:22}}>
 <h2>{(g.projects as unknown as {title:string}|null)?.title||'Assigned property'}</h2>
 <form action={requestOwnerStay} style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'end'}}><input type='hidden' name='partner_id' value={g.id}/>
 <label>Check in<br/><input name='check_in' required type='date' style={input}/></label>
 <label>Check out<br/><input name='check_out' required type='date' style={input}/></label>
 <label>Guests<br/><input name='guest_count' type='number' min='1' max='30' defaultValue={1} required style={input}/></label>
 <label>Note (optional)<br/><input name='notes' maxLength={1500} style={input}/></label>
 <button style={input}>Request owner stay · €0</button></form></section>)}
 {(grants.data||[]).length===0&&<p>You have no owner-stay property permissions yet.</p>}
 <h2>My requests</h2>{(requests.data||[]).map(r=><p key={r.id}>{r.check_in} – {r.check_out} · {r.status} · €0</p>)}
 </main>;
}
