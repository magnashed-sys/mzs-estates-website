import Link from 'next/link';
import {redirect,notFound} from 'next/navigation';
import {getLocale} from 'next-intl/server';
import {createClient} from '../../../lib/supabase/server';
import {isPhase3aPreviewIsolated} from '../../../lib/security/phase3a-preview-isolation';
import {copy,partnerLocale,displayLocale,todayMadrid,partnerLabel,nightsBetween,type Period} from '../../../lib/partner/presentation';
import PartnerHeader from '../partner/PartnerHeader';
import OwnerStayForm from './OwnerStayForm';
import styles from '../partner/partner.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Owner stays | MZS Group',robots:{index:false,follow:false}};
type Grant={id:string;project_id:string;projects:{title:string}|null};
type Request={id:string;partner_id:string;check_in:string;check_out:string;status:string;guest_count:number;notes:string;rental_bookings:{status:string}|null};
export default async function OwnerStays(){
 if(!isPhase3aPreviewIsolated())notFound();
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const locale=partnerLocale(await getLocale()),today=todayMadrid();const t=(nl:string,en:string,es:string)=>copy(locale,nl,en,es);
 const {data:profile}=await db.from('profiles').select('is_active').eq('id',user.id).single();if(!profile?.is_active)notFound();
 const grantsResult=await db.from('mzs_property_partners').select('id,project_id,projects(title)').eq('profile_id',user.id).eq('is_active',true).eq('complimentary_owner_stays',true);
 const grants=(grantsResult.data||[]) as unknown as Grant[];
 const requestResult=grants.length?await db.from('mzs_owner_stay_requests').select('id,partner_id,check_in,check_out,status,guest_count,notes,rental_bookings(status)').in('partner_id',grants.map(g=>g.id)).order('check_in',{ascending:true}):{data:[],error:null};
 const requests=((requestResult.data||[]) as unknown as Request[]).map(r=>({...r,status:r.rental_bookings?.status==='cancelled'?'cancelled':r.status}));
 const calendars=await Promise.all(grants.map(async g=>{const {data,error}=await db.rpc('get_rental_calendar',{p_project_id:g.project_id});return {id:g.id,unavailable:!error&&Array.isArray(data?.unavailable)?data.unavailable as Period[]:null,maximumGuests:!error&&data?.settings?.maximum_guests?Math.min(30,Number(data.settings.maximum_guests)):30};}));
 const upcoming=requests.filter(r=>r.check_out>today&&!['cancelled','declined'].includes(r.status));
 const history=requests.filter(r=>r.check_out<=today||['cancelled','declined'].includes(r.status)).sort((a,b)=>b.check_in.localeCompare(a.check_in));
 const date=(day:string)=>new Intl.DateTimeFormat(displayLocale(locale),{dateStyle:'medium',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
 const list=(items:typeof requests)=>items.length?items.map(r=><article key={r.id} className={styles.stay}><span className={styles.eyebrow}>{grants.find(g=>g.id===r.partner_id)?.projects?.title}</span><strong>{date(r.check_in)} — {date(r.check_out)}</strong><span><span className={styles.badge}>{partnerLabel(r.status,locale)}</span></span><small>{nightsBetween(r.check_in,r.check_out)} {t('nachten','nights','noches')} · {r.guest_count} {t('gasten','guests','huéspedes')} · €0</small>{r.notes&&<details className={styles.record}><summary>{t('Opmerking','Note','Nota')}</summary><p className={styles.note}>{r.notes}</p></details>}</article>):<p className={styles.empty}>{t('Geen verblijven in dit overzicht.','No stays in this overview.','No hay estancias en este resumen.')}</p>;
 return <main className={styles.page}><PartnerHeader locale={locale}/><div className={styles.body}><header className={styles.header}><div><p className={styles.eyebrow}>OWNER STAYS</p><h1>{t('Mijn eigen verblijven','My owner stays','Mis estancias')}</h1><p className={styles.note}>{t('Plan je verblijf en volg je aanvraag op één plek.','Plan your stay and follow your request in one place.','Planifica tu estancia y consulta tu solicitud en un solo lugar.')}</p></div><span className={styles.badge}>{t('Na goedkeuring door MZS','Subject to MZS approval','Sujeto a aprobación de MZS')}</span></header>
 <nav className={styles.nav} aria-label={t('Onderdelen','Sections','Secciones')}><Link href='/private/partner'>{t('Overzicht','Overview','Resumen')}</Link><Link href='/private/partner?view=finance'>{t('Financiën','Finances','Finanzas')}</Link><Link href='/private/owner-stays' aria-current='page'>{t('Verblijven','Stays','Estancias')}</Link><Link href='/private/partner?view=documents'>{t('Documenten','Documents','Documentos')}</Link></nav>
 {grantsResult.error||requestResult.error?<p className={styles.error} role='alert'>{t('Je verblijven konden niet volledig worden geladen. Vernieuw de pagina.','Your stays could not be fully loaded. Refresh the page.','No se pudieron cargar todas las estancias. Actualiza la página.')}</p>:<>
 {grants.length===0&&<section className={styles.section}><p className={styles.note}>{t('Er zijn geen rechten voor eigen verblijven aan je account gekoppeld. Neem contact op met MZS.','Your account has no owner-stay permissions. Please contact MZS.','Tu cuenta no tiene permisos para estancias propias. Contacta con MZS.')}</p></section>}
 <div className={styles.twoColumns}><div>{grants.map(g=>{const calendar=calendars.find(c=>c.id===g.id)!;return <section key={g.id} className={styles.section}><p className={styles.eyebrow}>{t('Nieuwe aanvraag','New request','Nueva solicitud')}</p><h2>{g.projects?.title||t('Toegewezen woning','Assigned property','Inmueble asignado')}</h2><OwnerStayForm grantId={g.id} locale={locale} today={today} unavailable={calendar.unavailable} maximumGuests={calendar.maximumGuests}/></section>;})}</div><div><section className={styles.section}><h2>{t('Mijn aanvragen','My requests','Mis solicitudes')}</h2><p className={styles.note}>{t('Komende en huidige verblijven · alle jaren','Upcoming and current stays · all years','Estancias próximas y actuales · todos los años')}</p>{list(upcoming)}</section><details className={styles.section}><summary>{t('Historie','History','Historial')} <small>{history.length}</small></summary>{list(history)}</details><Link href='/private/partner?view=stays' className={styles.secondary}>{t('Alle objectboekingen','All property bookings','Todas las reservas')} →</Link></div></div></>}
 <p className={styles.footer}>PRIVATE · INDEPENDENT · INTERNATIONAL</p></div></main>;
}
