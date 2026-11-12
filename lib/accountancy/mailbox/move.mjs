import {MAX_MESSAGE_BYTES} from './import.mjs';
import {sha256,verifyReceiptOriginals,claimMove,finishMove} from './receipts.mjs';

async function downloadSource(client,uid){
 const download=await client.download(uid,undefined,{uid:true,maxBytes:MAX_MESSAGE_BYTES+1});
 if(!download.content)throw Error('message_missing');
 const parts=[];let size=0;
 for await(const part of download.content){
  size+=part.length;
  if(size>MAX_MESSAGE_BYTES){download.content.destroy();throw Error('message_too_large');}
  parts.push(part);
 }
 return Buffer.concat(parts);
}
export async function moveReviewedMessage({client,service,receipt,verify=verifyReceiptOriginals,claim=claimMove,finish=finishMove}){
 if(receipt.state!=='review'||receipt.mailbox!=='mase@mzsgroup.eu'||receipt.folder!=='INBOX'||
    !Array.isArray(receipt.attachments)||!receipt.attachments.length)throw Error('not_ready');
 await verify(service,receipt);
 const token=await claim(service,receipt);
 let lock,attempted=false;
 const timer=setTimeout(()=>client.close(),90000);
 try{
  await client.connect();
  if(!client.capabilities.has('MOVE')||!client.capabilities.has('UIDPLUS'))throw Error('native_move_required');
  const target=await client.status('Verwerkt',{uidValidity:true});
  if(!target?.uidValidity)throw Error('destination_missing');
  lock=await client.getMailboxLock('INBOX',{readOnly:false,acquireTimeout:10000});
  if(!client.mailbox||client.mailbox.readOnly||String(client.mailbox.uidValidity)!==String(receipt.uid_validity))throw Error('mailbox_changed');
  const uid=Number(receipt.uid);
  if(!Number.isSafeInteger(uid)||uid<1||uid>4294967295)throw Error('invalid_uid');
  const source=await downloadSource(client,uid);
  if(sha256(source)!==receipt.source_sha256)throw Error('message_changed');
  attempted=true;
  // Never permit ImapFlow's COPY/DELETE fallback: native MOVE and UIDPLUS were required.
  const moved=await client.messageMove(String(uid),'Verwerkt',{uid:true});
  const destination=moved?.uidMap?.get(uid);
  if(!Number.isSafeInteger(destination)||destination<1||String(moved.uidValidity)!==String(target.uidValidity))throw Error('move_unconfirmed');
  lock.release();lock=undefined;
  lock=await client.getMailboxLock('Verwerkt',{readOnly:true,acquireTimeout:10000});
  if(String(client.mailbox?.uidValidity)!==String(target.uidValidity)||
     sha256(await downloadSource(client,destination))!==receipt.source_sha256)throw Error('destination_unverified');
  await finish(service,receipt.id,token,'moved',{destination_uid_validity:String(target.uidValidity),destination_uid:destination});
  return {state:'moved'};
 }catch{
  // A lost MOVE acknowledgement is ambiguous. Never retry a possibly completed MOVE automatically.
  const state=attempted?'uncertain':'review';
  await finish(service,receipt.id,token,state);
  return {state};
 }finally{clearTimeout(timer);lock?.release();client.close();}
}
