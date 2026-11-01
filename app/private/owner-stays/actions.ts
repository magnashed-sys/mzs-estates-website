'use server';
import {revalidatePath} from 'next/cache';
import {getLocale} from 'next-intl/server';
import {deliverOwnerStayAdminNotifications} from '../../../lib/mzs/notifications';
import {createClient} from '../../../lib/supabase/server';
import {isPhase3aPreviewIsolated} from '../../../lib/security/phase3a-preview-isolation';
import {copy,validDay,todayMadrid,overlaps,type Period} from '../../../lib/partner/presentation';
import type {OwnerStayState} from '../../../lib/partner/owner-stay-state';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function requestOwnerStay(_previous:OwnerStayState,form:FormData):Promise<OwnerStayState>{
 const locale=await getLocale();const t=(nl:string,en:string,es:string)=>copy(locale,nl,en,es);
 const fail=(message:string):OwnerStayState=>({status:'error',message});
 if(!isPhase3aPreviewIsolated())return fail(t('Deze omgeving is niet beschikbaar.','This environment is unavailable.','Este entorno no está disponible.'));
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return fail(t('Log opnieuw in om je aanvraag te versturen.','Sign in again to send your request.','Inicia sesión de nuevo para enviar la solicitud.'));
 const {data:profile}=await db.from('profiles').select('is_active').eq('id',user.id).single();
 if(!profile?.is_active)return fail(t('Je account heeft geen actieve toegang.','Your account has no active access.','Tu cuenta no tiene acceso activo.'));
 const partner=String(form.get('partner_id')||''),check_in=String(form.get('check_in')||''),check_out=String(form.get('check_out')||'');
 const guest_count=Number(form.get('guest_count')),notes=String(form.get('notes')||'').trim();
 if(!UUID.test(partner)||!validDay(check_in)||!validDay(check_out)||check_in<todayMadrid()||check_out<=check_in||!Number.isInteger(guest_count)||guest_count<1||guest_count>30||notes.length>1500)return fail(t('Controleer de data, het aantal gasten en je opmerking. Vertrek moet na aankomst liggen.','Check the dates, guest count and note. Check-out must be after check-in.','Comprueba las fechas, los huéspedes y la nota. La salida debe ser posterior a la llegada.'));
 const {data:grant}=await db.from('mzs_property_partners').select('id,project_id').eq('id',partner).eq('profile_id',user.id).eq('is_active',true).eq('complimentary_owner_stays',true).eq('requires_approval',true).single();
 if(!grant)return fail(t('Je hebt geen toegang om dit verblijf aan te vragen.','You do not have access to request this stay.','No tienes permiso para solicitar esta estancia.'));
 const {data:calendar,error:calendarError}=await db.rpc('get_rental_calendar',{p_project_id:grant.project_id});
 if(!calendarError&&calendar){
  if(Array.isArray(calendar.unavailable)&&overlaps(check_in,check_out,calendar.unavailable as Period[]))return fail(t('Deze data zijn inmiddels bezet. Kies een andere periode.','These dates are now occupied. Choose another period.','Estas fechas ya están ocupadas. Elige otro período.'));
  if(calendar.settings?.maximum_guests&&guest_count>Number(calendar.settings.maximum_guests))return fail(t('Het aantal gasten is hoger dan de capaciteit van deze woning.','The guest count exceeds this property’s capacity.','El número de huéspedes supera la capacidad del inmueble.'));
 }
 const {data:duplicate,error:duplicateError}=await db.from('mzs_owner_stay_requests').select('id').eq('partner_id',partner).eq('check_in',check_in).eq('check_out',check_out).in('status',['requested','confirmed']).limit(1);
 if(duplicateError)return fail(t('De aanvraag kan nu niet worden gecontroleerd. Probeer opnieuw.','We cannot check your request right now. Please retry.','No podemos comprobar la solicitud ahora. Inténtalo de nuevo.'));
 if(duplicate?.length)return fail(t('Voor deze data bestaat al een aanvraag. Bekijk Mijn aanvragen hieronder.','A request already exists for these dates. See My requests below.','Ya existe una solicitud para estas fechas. Consulta Mis solicitudes abajo.'));
 const {data:request,error}=await db.from('mzs_owner_stay_requests').insert({partner_id:partner,check_in,check_out,guest_count,notes}).select('id').single();
 if(error||!request)return fail(t('Je aanvraag kon niet worden opgeslagen. Probeer opnieuw.','Your request could not be saved. Please retry.','No se pudo guardar la solicitud. Inténtalo de nuevo.'));
 // The request is saved even if email delivery is temporarily unavailable.
 try{await deliverOwnerStayAdminNotifications(request.id);}catch{console.error('[Owner stay] Notification delivery deferred');}
 revalidatePath('/private/owner-stays');revalidatePath('/private/partner');
 return {status:'success',message:t('Je aanvraag staat in afwachting van goedkeuring. Je vindt de status bij Mijn aanvragen. De data zijn nog niet gereserveerd.','Your request is awaiting approval. Follow its status under My requests. The dates are not yet reserved.','Tu solicitud está pendiente de aprobación. Consulta su estado en Mis solicitudes. Las fechas aún no están reservadas.')};
}
