import {createClient} from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import {reportWindow,visitorReport, type VisitorSummary} from './visitor-report';

/** One durable claim per day. SMTP ambiguity is never automatically retried. */
export async function deliverVisitorReport(now=new Date()) {
  const env=process.env;
  if(env.VERCEL_ENV!=='production'||env.NEXT_PUBLIC_SUPABASE_URL!=='https://ptrnjzmcehrhbsfxntgw.supabase.co')return 'disabled';
  const window=reportWindow(now); if(!window)return 'not_due';
  if(!env.SUPABASE_SERVICE_ROLE_KEY) return 'not_configured';
  const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:settings,error:settingsError}=await db.from('mzs_visitor_settings').select('enabled,recipient_user_id,started_at').eq('singleton',true).single();
  if(settingsError)throw new Error('Visitor settings unavailable');
  if(!settings.enabled||!settings.recipient_user_id)return 'disabled';
  const {data:profile,error:profileError}=await db.from('profiles').select('role,is_active,email').eq('id',settings.recipient_user_id).single();
  const {data:auth,error:authError}=await db.auth.admin.getUserById(settings.recipient_user_id);
  const recipient=auth?.user?.email?.toLowerCase();
  if(profileError||authError||profile?.role!=='admin'||profile.is_active!==true||!auth.user?.email_confirmed_at||
    !recipient||recipient!==profile.email?.toLowerCase()||!/^[^@\s<>;,]+@[^@\s<>;,]+\.[^@\s<>;,]+$/.test(recipient))return 'recipient_requires_review';
  const host=env.MZS_SMTP_HOST||env.SMTP_HOST,port=Number(env.MZS_SMTP_PORT||env.SMTP_PORT||587),user=env.MZS_SMTP_USER||env.SMTP_USER,pass=env.MZS_SMTP_PASSWORD||env.SMTP_PASSWORD;
  const from=env.MZS_SMTP_FROM||env.SMTP_FROM||(user?.includes('@')?`MZS Group <${user}>`:null);
  if(!host||!user||!pass||!from||![465,587].includes(port))return 'not_configured';
  // Fetch and render before claiming: a read error can be safely retried.
  const {data:rows,error:summaryError}=await db.rpc('mzs_visitor_summary',{p_start:window.start,p_end:window.end});
  if(summaryError)throw new Error('Visitor report unavailable');
  const message=visitorReport(window.day,(rows??[]) as VisitorSummary[],settings.started_at);
  const {error:claimError}=await db.from('mzs_visitor_reports').insert({report_day:window.day,recipient_user_id:settings.recipient_user_id,status:'sending'});
  if(claimError?.code==='23505')return 'already_claimed';
  if(claimError)throw new Error('Visitor report claim failed');
  const mailer=nodemailer.createTransport({host,port,secure:port===465,requireTLS:port===587,auth:{user,pass},tls:{minVersion:'TLSv1.2'},connectionTimeout:8000,greetingTimeout:6000,socketTimeout:10000});
  let status='uncertain';
  try {
    const receipt=await mailer.sendMail({...message,from,to:recipient,messageId:`<visitors-${window.day}@notifications.mzsgroup.com>`});
    status=receipt.accepted?.some((address:string|{address:string})=>(typeof address==='string'?address:address.address).toLowerCase()===recipient)?'accepted':'failed';
  } catch {status='uncertain';} finally {mailer.close();}
  const {data:saved,error:saveError}=await db.from('mzs_visitor_reports').update({status,completed_at:new Date().toISOString(),error_category:status==='accepted'?null:'delivery_requires_review'}).eq('report_day',window.day).eq('status','sending').select('report_day');
  if(saveError||saved?.length!==1)return 'uncertain';
  // Limited retention of raw browsing data; delivery metadata remains for auditing.
  if(status==='accepted')await db.from('mzs_visitor_activity').delete().lt('occurred_at',new Date(now.getTime()-90*86400000).toISOString());
  return status;
}
