import {createClient} from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import {hoursWindow,weeklyHoursReport,hoursRecipient,type HoursEntry} from './weekly-hours-report';

/** One durable claim per week. SMTP ambiguity is never automatically retried. */
export async function deliverWeeklyHoursReport(now=new Date()) {
  const env=process.env;
  if(env.VERCEL_ENV!=='production'||env.NEXT_PUBLIC_SUPABASE_URL!=='https://ptrnjzmcehrhbsfxntgw.supabase.co')return 'disabled';
  const window=hoursWindow(now); if(!window)return 'not_due';
  if(!env.SUPABASE_SERVICE_ROLE_KEY) return 'not_configured';
  const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:settings,error:settingsError}=await db.from('mzs_weekly_hours_settings').select('enabled,recipient_user_id,first_week').eq('singleton',true).single();
  if(settingsError)throw new Error('Weekly hours settings unavailable');
  if(!settings.enabled||!settings.recipient_user_id||!settings.first_week||window.week<settings.first_week)return 'disabled';
  const {data:profile,error:profileError}=await db.from('profiles').select('is_active,email').eq('id',settings.recipient_user_id).single();
  const {data:auth,error:authError}=await db.auth.admin.getUserById(settings.recipient_user_id);
  const recipient=auth?.user?.email?.toLowerCase();
  if(profileError||authError||profile?.is_active!==true||!auth.user?.email_confirmed_at||
    recipient!==hoursRecipient||recipient!==profile.email?.toLowerCase()||!/^[^@\s<>;,]+@[^@\s<>;,]+\.[^@\s<>;,]+$/.test(recipient))return 'recipient_requires_review';
  const host=env.MZS_SMTP_HOST||env.SMTP_HOST,port=Number(env.MZS_SMTP_PORT||env.SMTP_PORT||587),user=env.MZS_SMTP_USER||env.SMTP_USER,pass=env.MZS_SMTP_PASSWORD||env.SMTP_PASSWORD;
  const from=env.MZS_SMTP_FROM||env.SMTP_FROM||(user?.includes('@')?`MZS Group <${user}>`:null);
  if(!host||!user||!pass||!from||![465,587].includes(port))return 'not_configured';
  // Fetch and render before claiming: a read error can be safely retried.
  const {data:rows,error:summaryError}=await db.rpc('mzs_weekly_hours_summary',{p_week:window.week});
  if(summaryError)throw new Error('Weekly hours report unavailable');
  if(!Array.isArray(rows))throw Error('Invalid hours snapshot');
  const message=weeklyHoursReport(window.week,rows as HoursEntry[]);
  const {error:claimError}=await db.from('mzs_weekly_hours_reports').insert({week_start:window.week,recipient_user_id:settings.recipient_user_id,status:'sending'});
  if(claimError?.code==='23505')return 'already_claimed';
  if(claimError)throw new Error('Weekly hours report claim failed');
  const mailer=nodemailer.createTransport({host,port,secure:port===465,requireTLS:port===587,auth:{user,pass},tls:{minVersion:'TLSv1.2'},connectionTimeout:8000,greetingTimeout:6000,socketTimeout:10000});
  let status='uncertain';
  try {
    const receipt=await mailer.sendMail({...message,from,to:recipient,messageId:`<hours-${window.week}@notifications.mzsgroup.com>`});
    status=receipt.accepted?.some((address:string|{address:string})=>(typeof address==='string'?address:address.address).toLowerCase()===recipient)?'accepted':'failed';
  } catch {status='uncertain';} finally {mailer.close();}
  const {data:saved,error:saveError}=await db.from('mzs_weekly_hours_reports').update({status,completed_at:new Date().toISOString(),error_category:status==='accepted'?null:'delivery_requires_review'}).eq('week_start',window.week).eq('status','sending').select('week_start');
  if(saveError||saved?.length!==1)return 'uncertain';
  return status;
}
