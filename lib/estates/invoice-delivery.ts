import nodemailer from 'nodemailer';
import {createClient} from '@supabase/supabase-js';
import {classifyRentalMailFailure} from '../mzs/rental-notifications';
import {invoicePdf,type InvoiceDocument} from './invoice-pdf';
export function invoiceMailMode(){
 const e=process.env;
 if(e.VERCEL_ENV==='preview'&&e.NEXT_PUBLIC_SUPABASE_URL==='https://senonkpxdtlhyhrubicg.supabase.co')return 'capture';
 if(e.VERCEL_ENV==='production'&&e.NEXT_PUBLIC_SUPABASE_URL==='https://ptrnjzmcehrhbsfxntgw.supabase.co'&&e.MZS_LEASE_INVOICE_SEND_ENABLED==='true')return 'smtp';
 throw new Error('Invoice sending has not been enabled for this environment.');
}
export async function prepareInvoiceDelivery(i:InvoiceDocument){
 const mode=invoiceMailMode(),e=process.env;
 const to=i.payload.snapshot.tenant_email?.trim().toLowerCase();
 if(!to||!/^[^@\s<>;,]+@[^@\s<>;,]+\.[^@\s<>;,]+$/.test(to))throw new Error('A single valid tenant email is required on the approved invoice.');
 const key=e.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new Error('Trusted invoice delivery worker is not configured.');
 const host=e.MZS_SMTP_HOST||e.SMTP_HOST,port=Number(e.MZS_SMTP_PORT||e.SMTP_PORT||587),user=e.MZS_SMTP_USER||e.SMTP_USER,pass=e.MZS_SMTP_PASSWORD||e.SMTP_PASSWORD,from=e.MZS_SMTP_FROM||e.SMTP_FROM||user;
 if(mode==='smtp'&&(!host||!user||!pass||!from||![465,587].includes(port)))throw new Error('Invoice SMTP settings are incomplete.');
 const pdf=await invoicePdf(i);
 const worker=createClient(e.NEXT_PUBLIC_SUPABASE_URL!,key,{auth:{persistSession:false,autoRefreshToken:false}});
 return async(id:string,token:string)=>{
  const transport=mode==='capture'?nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'}):nodemailer.createTransport({host,port,secure:port===465,requireTLS:port===587,auth:{user,pass},tls:{minVersion:'TLSv1.2'},connectionTimeout:8000,greetingTimeout:6000,socketTimeout:10000});
  let status='uncertain';let category:string|null=null;
  try{const result=await transport.sendMail({from:mode==='capture'?'MZS Group <staging@example.invalid>':from,to,subject:`${i.number} | ${i.payload.subject}`,text:`Dear ${i.payload.snapshot.tenant_name},\n\nPlease find your rental invoice ${i.number} attached.\nRental period: ${i.payload.period_start} to ${i.payload.period_end}.\nTotal: EUR ${Number(i.total).toFixed(2)}.\nPayment due: ${i.due_date}.\nIBAN: ${i.payload.snapshot.issuer_iban}.\nPlease quote ${i.number} with your payment.\n\nKind regards,\n${i.payload.snapshot.issuer_name}\nMZS Group`,attachments:[{filename:i.number+'.pdf',content:pdf,contentType:'application/pdf'}],messageId:`<lease-${id}@notifications.mzsgroup.com>`});
   status=mode==='capture'?'captured':result.accepted?.some((a:string|{address:string})=>(typeof a==='string'?a:a.address).toLowerCase()===to)?'accepted':'failed';
  }catch(error){status=classifyRentalMailFailure(error)==='uncertain'?'uncertain':'failed';category=status==='uncertain'?'smtp_outcome_unknown':'smtp_not_accepted';}finally{transport.close();}
  const {data,error}=await worker.rpc('mzs_finish_lease_invoice_mail',{p_id:id,p_token:token,p_status:status,p_error:category});
  if(error||!data)return 'uncertain';return status;
 };
}
