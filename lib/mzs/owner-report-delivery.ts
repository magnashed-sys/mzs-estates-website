import {createClient} from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import {ownerReportMessage,ownerReportFrom,ownerReportRecipient} from './owner-report';

/** Uses the existing platform SMTP credentials, never a personal Gmail account. */
export async function deliverOwnerReport(){
 const env=process.env;
 if(env.VERCEL_ENV!=='production'||env.NEXT_PUBLIC_SUPABASE_URL!=='https://ptrnjzmcehrhbsfxntgw.supabase.co')return 'disabled';
 const host=env.MZS_SMTP_HOST||env.SMTP_HOST,port=Number(env.MZS_SMTP_PORT||env.SMTP_PORT||587),user=env.MZS_SMTP_USER||env.SMTP_USER,pass=env.MZS_SMTP_PASSWORD||env.SMTP_PASSWORD;
 const from=env.MZS_SMTP_FROM||env.SMTP_FROM||user;
 if(!host||!user||!pass||!env.SUPABASE_SERVICE_ROLE_KEY||![465,587].includes(port))return 'not_configured';
 if(!from||!/^(?:MZS Group\s*<info@mzsgroup\.eu>|info@mzsgroup\.eu)$/i.test(from.trim()))return 'sender_requires_review';
 const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 // Verify the fixed recipient against the established owner-report account.
 const {data:settings,error:settingsError}=await db.from('mzs_weekly_hours_settings').select('recipient_user_id').eq('singleton',true).single();
 if(settingsError||!settings?.recipient_user_id)return 'recipient_requires_review';
 const {data:profile,error:profileError}=await db.from('profiles').select('is_active,email').eq('id',settings.recipient_user_id).single();
 const {data:auth,error:authError}=await db.auth.admin.getUserById(settings.recipient_user_id);
 if(profileError||authError||profile?.is_active!==true||!auth.user?.email_confirmed_at||auth.user.email?.toLowerCase()!==ownerReportRecipient||profile.email?.toLowerCase()!==ownerReportRecipient)return 'recipient_requires_review';
 const {data,error}=await db.rpc('mzs_claim_owner_report');
 if(error)throw Error('Report claim unavailable');
 const report=Array.isArray(data)?data[0]:undefined;if(!report)return 'none';
 let status='uncertain';
 try {
  if(report.recipient!==ownerReportRecipient)throw Error('Unexpected recipient');
  const message=ownerReportMessage(report.subject,report.body_text);
  const transport=nodemailer.createTransport({host,port,secure:port===465,requireTLS:port===587,auth:{user,pass},tls:{minVersion:'TLSv1.2'},connectionTimeout:8000,greetingTimeout:6000,socketTimeout:10000});
  try {
   const receipt=await transport.sendMail({...message,from:ownerReportFrom,to:ownerReportRecipient,replyTo:'info@mzsgroup.eu',messageId:`<owner-report-${report.id}@mzsgroup.eu>`});
   status=receipt.accepted?.some((address:string|{address:string})=>(typeof address==='string'?address:address.address).toLowerCase()===ownerReportRecipient)?'accepted':'failed';
  }finally{transport.close();}
 }catch{status='uncertain';}
 const {data:saved,error:saveError}=await db.from('mzs_owner_report_outbox').update({status,completed_at:new Date().toISOString(),error_category:status==='accepted'?null:'delivery_requires_review'}).eq('id',report.id).eq('status','sending').select('id');
 if(saveError||saved?.length!==1)return 'uncertain';
 return status;
}
