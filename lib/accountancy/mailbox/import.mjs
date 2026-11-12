import {ImapFlow} from 'imapflow';
import {simpleParser} from 'mailparser';
export const MAX_MESSAGE_BYTES=16*1024*1024;
export const MAX_PDF_BYTES=4*1024*1024;
export function mailboxClient(password){
 if(!password)throw Error('Mailbox password missing');
 const client=new ImapFlow({host:'mailspace.org',port:993,secure:true,auth:{user:'mase@mzsgroup.eu',pass:password},tls:{rejectUnauthorized:true},logger:false,disableAutoIdle:true,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:30000});
 client.on('error',()=>{});
 return client;
}
export async function parsePdfAttachments(source,parse=simpleParser){
 if(!Buffer.isBuffer(source)||source.length>MAX_MESSAGE_BYTES)throw Error('message_too_large');
 const mail=await parse(source,{skipHtmlToText:true,skipTextToHtml:true,skipImageLinks:true,maxHtmlLengthToParse:0});
 const attachments=mail.attachments??[];
 const files=[];
 for(const a of attachments){
  if(a.contentDisposition==='inline'&&a.cid&&/^image\//i.test(a.contentType??''))continue;
  const name=a.filename??'invoice.pdf';
  if(!(/\.pdf$/i.test(name))||!['application/pdf','application/octet-stream'].includes((a.contentType??'').toLowerCase()))throw Error('unsupported_attachment');
  if(!Buffer.isBuffer(a.content)||a.content.length<128||a.content.length>MAX_PDF_BYTES||a.content.subarray(0,5).toString()!=='%PDF-')throw Error('invalid_pdf');
  files.push({name,bytes:a.content});
  if(files.length>5)throw Error('too_many_attachments');
 }
 return files;
}
// Pilot deliberately opens INBOX read-only and contains no MOVE/STORE/EXPUNGE.
// Every rerun revalidates SHA-based retained originals before treating them as duplicates.
export async function importMailboxBatch({client,retain,parse=parsePdfAttachments,limit=5,afterUid=0,expectedValidity=''}){
 const results=[];
 let lock;
 const deadline=Date.now()+210000;
 const timer=setTimeout(()=>client.close(),210000);
 try{
  await client.connect();
  lock=await client.getMailboxLock('INBOX',{readOnly:true,acquireTimeout:10000});
  const box=client.mailbox;
  if(!box||!box.readOnly||!box.uidValidity)throw Error('mailbox_not_readonly');
  const uidValidity=String(box.uidValidity);
  if((afterUid>0&&!expectedValidity)||(expectedValidity&&expectedValidity!==uidValidity))throw Error('mailbox_changed');
  if(!box.exists)return results;
  if(!Number.isSafeInteger(afterUid)||afterUid<0||afterUid>4294967295)throw Error('invalid_cursor');
  if(BigInt(afterUid)>=BigInt(box.uidNext)-1n)return results;
  const uids=await client.search({uid:(afterUid+1)+':*'},{uid:true});
  if(!Array.isArray(uids)||uids.length>5000)throw Error('inbox_requires_manual_batching');
  const selected=uids.filter(uid=>Number.isSafeInteger(uid)&&uid>afterUid).sort((a,b)=>a-b).slice(0,Math.min(Math.max(1,Math.floor(limit)),5));
  if(!selected.length)return results;
  // Finish metadata fetch before issuing another IMAP command (avoids iterator deadlocks).
  const messages=await client.fetchAll(selected.join(','),{uid:true,size:true},{uid:true});
  for(const message of messages){
   const row={uid:message.uid,uidValidity,code:'error',intakes:[]};
   results.push(row);
   if(!Number.isSafeInteger(message.uid)||message.uid<1){row.code='invalid_uid';continue;}
   if(!Number.isSafeInteger(message.size)||message.size<=0||message.size>MAX_MESSAGE_BYTES){row.code='message_too_large';continue;}
   try{
    if(String(client.mailbox?.uidValidity)!==uidValidity)throw Error('mailbox_changed');
    const download=await client.download(message.uid,undefined,{uid:true,maxBytes:MAX_MESSAGE_BYTES+1});
    if(!download.content)throw Error('message_missing');
    const parts=[];let size=0;
    for await(const part of download.content){
     size+=part.length;if(size>MAX_MESSAGE_BYTES){download.content.destroy();throw Error('message_too_large');}
     parts.push(part);
    }
    if(size!==message.size)throw Error('incomplete_message');
    const files=await parse(Buffer.concat(parts));
    if(!files.length){row.code='no_pdf';continue;}
    row.code='retained';
    for(const file of files){
     if(Date.now()>=deadline)throw Error('batch_timeout');
     const saved=await retain(file);
     if(saved.status!==200||!saved.body.id||saved.body.verdict!=='clean'){row.code=row.intakes.length?'partial':'needs_attention';break;}
     row.intakes.push({id:saved.body.id,duplicate:saved.body.duplicate===true});
    }
   }catch{
    row.code=row.intakes.length?'partial':'needs_attention';
   }
  }
  return results;
 }finally{
  clearTimeout(timer);
  lock?.release();
  // Close without waiting on a stalled LOGOUT; EXAMINE never changes message flags.
  client.close();
 }
}
