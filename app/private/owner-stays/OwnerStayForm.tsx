'use client';
import {useActionState,useState} from 'react';
import {requestOwnerStay} from './actions';
import {copy,displayLocale,nightsBetween,overlaps,type Period} from '../../../lib/partner/presentation';
import styles from '../partner/partner.module.css';
export default function OwnerStayForm({grantId,locale,today,unavailable,maximumGuests}:{grantId:string;locale:string;today:string;unavailable:Period[]|null;maximumGuests:number}){
 const t=(nl:string,en:string,es:string)=>copy(locale,nl,en,es);
 const [outcome,action,pending]=useActionState(requestOwnerStay,{status:'idle',message:''});
 const [arrival,setArrival]=useState(''),[departure,setDeparture]=useState('');
 const [month,setMonth]=useState(today.slice(0,7)+'-01');
 const date=new Date(month+'T12:00:00Z'),year=date.getUTCFullYear(),monthIndex=date.getUTCMonth();
 const firstOffset=(date.getUTCDay()+6)%7,dayCount=new Date(Date.UTC(year,monthIndex+1,0)).getUTCDate();
 const days=Array.from({length:firstOffset+dayCount},(_,i)=>i<firstOffset?null:new Date(Date.UTC(year,monthIndex,i-firstOffset+1)).toISOString().slice(0,10));
 const nights=nightsBetween(arrival,departure);
 const conflict=!!arrival&&!!departure&&!!unavailable&&overlaps(arrival,departure,unavailable);
 const blocked=(day:string)=>!!unavailable?.some(p=>day>=p.check_in&&day<p.check_out);
 const format=(day:string)=>new Intl.DateTimeFormat(displayLocale(locale),{dateStyle:'long',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
 const selectDay=(day:string)=>{
  if(!arrival||departure||day<=arrival){if(!blocked(day)){setArrival(day);setDeparture('');}}
  else if(!unavailable||!overlaps(arrival,day,unavailable))setDeparture(day);
 };
 if(outcome.status==='success')return <div className={styles.success} role='status'><strong>{t('Aanvraag ontvangen','Request received','Solicitud recibida')}</strong><p>{outcome.message}</p><a href='/private/owner-stays' className={styles.secondary}>{t('Nog een verblijf aanvragen','Request another stay','Solicitar otra estancia')}</a></div>;
 return <form action={action} className={styles.form} aria-busy={pending}>
 <input type='hidden' name='partner_id' value={grantId}/>
 <fieldset disabled={pending}>
 <div className={styles.calendar}><div className={styles.calendarHeader}><button type='button' aria-label={t('Vorige maand','Previous month','Mes anterior')} disabled={month.slice(0,7)<=today.slice(0,7)} onClick={()=>setMonth(new Date(Date.UTC(year,monthIndex-1,1)).toISOString().slice(0,10))}>←</button><strong aria-live='polite'>{new Intl.DateTimeFormat(displayLocale(locale),{month:'long',year:'numeric',timeZone:'UTC'}).format(date)}</strong><button type='button' aria-label={t('Volgende maand','Next month','Mes siguiente')} onClick={()=>setMonth(new Date(Date.UTC(year,monthIndex+1,1)).toISOString().slice(0,10))}>→</button></div>
 <div className={styles.calendarGrid}>{Array.from({length:7},(_,i)=><span key={'weekday'+i}>{new Intl.DateTimeFormat(displayLocale(locale),{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,1+i)))}</span>)}{days.map((day,i)=>{
 if(!day)return <span key={'empty'+i}/>;
 const canDepart=!!arrival&&!departure&&day>arrival&&(!unavailable||!overlaps(arrival,day,unavailable));
 const occupied=blocked(day);const disabled=day<today||(occupied&&!canDepart);
 return <button type='button' key={day} disabled={disabled} onClick={()=>selectDay(day)} aria-label={format(day)+(occupied?' · '+t('Bezet','Occupied','Ocupado'):'')} aria-pressed={day===arrival||day===departure} data-blocked={occupied} data-selected={day===arrival||day===departure} data-between={!!arrival&&!!departure&&day>arrival&&day<departure}>{Number(day.slice(-2))}</button>;
 })}</div></div>
 <p className={styles.note}>{unavailable===null?t('Beschikbaarheid is momenteel niet zichtbaar. Je kunt data aanvragen; MZS controleert deze voor goedkeuring.','Availability is currently unavailable. You can request dates; MZS checks them before approval.','La disponibilidad no se puede consultar ahora. Puedes solicitar fechas; MZS las comprobará antes de aprobar.'):t('Kies aankomst en vertrek. Doorgestreepte nachten zijn bezet; vertrek op de eerste bezette dag is mogelijk.','Choose check-in and check-out. Crossed-out nights are occupied; departure on the first occupied day is possible.','Elige llegada y salida. Las noches tachadas están ocupadas; es posible salir el primer día ocupado.')}</p>
 <div className={styles.formGrid}><label>{t('Aankomst','Check in','Llegada')}<input name='check_in' type='date' required min={today} value={arrival} onChange={e=>{setArrival(e.target.value);if(e.target.value)setMonth(e.target.value.slice(0,7)+'-01');if(departure<=e.target.value)setDeparture('');}}/></label><label>{t('Vertrek','Check out','Salida')}<input name='check_out' type='date' required min={arrival?new Date(Date.parse(arrival+'T12:00:00Z')+86400000).toISOString().slice(0,10):today} value={departure} onChange={e=>setDeparture(e.target.value)}/></label></div>
 </fieldset>
 <label>{t('Aantal gasten','Guests','Huéspedes')}<input name='guest_count' type='number' min={1} max={maximumGuests} defaultValue={1} required disabled={pending}/></label>
 <label>{t('Opmerking (optioneel)','Note (optional)','Nota (opcional)')}<textarea name='notes' rows={3} maxLength={1500} disabled={pending}/></label>
 <p className={styles.badge} aria-live='polite'>{nights>0?nights+' '+t('nachten','nights','noches'):t('Selecteer je data','Select your dates','Selecciona tus fechas')} · €0</p>
 {conflict&&<p role='alert' className={styles.error}>{t('Deze periode overlapt een bezet verblijf. Kies andere data.','These dates overlap an occupied stay. Choose other dates.','Estas fechas coinciden con una estancia ocupada. Elige otras fechas.')}</p>}
 {outcome.status==='error'&&<p role='alert' className={styles.error}>{outcome.message}</p>}
 <button type='submit' disabled={pending||nights<1||conflict}>{pending?t('Aanvraag verzenden…','Sending request…','Enviando solicitud…'):t('Eigen verblijf aanvragen · €0','Request owner stay · €0','Solicitar estancia · €0')}</button>
 <p className={styles.note}>{t('Een aanvraag reserveert nog geen data. Je verblijf is bevestigd na goedkeuring door MZS.','A request does not reserve dates. Your stay is confirmed after MZS approval.','Una solicitud no reserva fechas. La estancia se confirma tras la aprobación de MZS.')}</p>
 </form>;
}
