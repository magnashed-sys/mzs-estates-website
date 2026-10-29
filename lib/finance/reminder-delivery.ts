import nodemailer from 'nodemailer';
import {createClient} from '@supabase/supabase-js';
import {invoiceMailMode} from '../estates/invoice-delivery';
import {classifyRentalMailFailure} from '../mzs/rental-notifications';
import {reminderText,type Reminder} from './receivables';
export function prepareReminderDelivery(){
 const mode=invoiceMailMode(),e=process.env,key=e.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)throw Error('Trusted delivery worker is not configured.');
 const host=e.MZS_SMTP_HOST||e.SMTP_HOST,port=Number(e.MZS_SMTP_PORT||e.SMTP_PORT||587),user=e.MZS_SMTP_USER||e.SMTP_USER,pass=e.MZS_SMTP_PASSWORD||e.SMTP_PASSWORD,from=e.MZS_SMTP_FROM||e.SMTP_FROM||user;
 if(mode==='smtp'&&(!host||!user||!pass||!from||![465,587].includes(port)))throw Error('Reminder delivery is not configured.');
 const sender=from?.match(/<([^<>]+)>$/)?.[1]??from;
 if(mode==='smtp'&&(!sender||!/^[^@\s<>;,]+@[^@\s<>;,]+\.[^@\s<>;,]+$/.test(sender)))throw Error('A single sender mailbox is required.');
 const worker=createClient(e.NEXT_PUBLIC_SUPABASE_URL!,key,{auth:{persistSession:false,autoRefreshToken:false}});
 return async(id:string,snapshot:Reminder)=>{
  const transport=mode==='capture'?nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'}):nodemailer.createTransport({host,port,secure:port===465,requireTLS:port===587,auth:{user,pass},tls:{minVersion:'TLSv1.2'},connectionTimeout:8000,greetingTimeout:6000,socketTimeout:10000});
  let status='uncertain';
  try{const message=reminderText(snapshot);const result=await transport.sendMail({from:{name:snapshot.issuer,address:mode==='capture'?'staging@example.invalid':sender!},to:snapshot.email,...message,messageId:`<reminder-${id}@notifications.mzsgroup.com>`});status=mode==='capture'?'captured':result.accepted?.some((a:string|{address:string})=>(typeof a==='string'?a:a.address).toLowerCase()===snapshot.email)?'accepted':'failed';}
  catch(error){status=classifyRentalMailFailure(error)==='uncertain'?'uncertain':'failed';}finally{transport.close();}
  const {data,error}=await worker.rpc('mzs_finish_invoice_reminder',{p_id:id,p_status:status});return error||!data?'uncertain':status;
 };
}
