import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import net from 'node:net';
import nodemailer from 'nodemailer';
const source=readFileSync(new URL('../lib/mzs/rental-notifications.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const russian = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/mzs/russian-rental-mail.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:russian});
const event=()=>({id:'event-1',booking_id:'booking-1',recipient_user_id:'guest-1',recipient_email:'guest@example.invalid',kind:'modified',attempts:1,claim_token:'claim-1',payload:{property:'Villa <script>alert(1)</script>',check_in:'2027-02-10',check_out:'2027-02-17',guests:4,total_eur:2100,admin_notes:'SECRET_INTERNAL_NOTE',reason:'SECRET_CANCELLATION_REASON'}});
function harness(options={}) {
 let claimed=false;
 const sent=[],updates=[],transports=[];
 const e={...event(),...options.event};
 const db={rpc:async()=>{
  if(claimed)return {data:[]}; claimed=true;return {data:[e]};
 },auth:{admin:{getUserById:async id=>{assert.equal(id,'guest-1');return {data:{user:{email:options.email??e.recipient_email,user_metadata:{preferred_language:options.locale}}},error:options.lookupError?{}:null};}}},from(table){
  const query={select(){return query},eq(){return query},update(value){updates.push(value);return query},
    single:async()=>({data:{user_id:options.owner??e.recipient_user_id,is_test:options.isTest??false}}),
    then(resolve){resolve(options.persistError?{error:{message:'database unreachable'}}:{data:[{id:e.id}],error:null})}};return query;
 }};
 const exports={};
 const env={VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://ptrnjzmcehrhbsfxntgw.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'mock',MZS_RENTAL_NOTIFICATIONS_ENABLED:'true',MZS_RENTAL_MAIL_MODE:'smtp',MZS_SMTP_HOST:'mock',MZS_SMTP_PORT:'587',MZS_SMTP_USER:'mock',MZS_SMTP_PASSWORD:'mock',MZS_SMTP_FROM:'mzs@example.invalid',...options.env};
 vm.runInNewContext(js,{exports,console,process:{env},require(name){
  if(name==='./russian-rental-mail')return russian;
  if(name==='@supabase/supabase-js')return {createClient:()=>db};
  if(name==='nodemailer')return {default:{createTransport:config=>{transports.push(config);if(options.transportFactory)return options.transportFactory(config);return {sendMail:async message=>{
    sent.push(message);if(options.sendError)throw options.sendError;
    return {accepted:options.rejected?[]:[e.recipient_email]};
   },close(){}};}}};throw new Error(name);
 }});
 return {exports,sent,updates,transports};
}
test('update contains the current snapshot and escapes HTML, never internal fields',()=>{
 const h=harness();const m=h.exports.rentalChangeTemplate(event(),'https://preview.example.invalid');
 assert.match(m.text,/10 February 2027/);assert.match(m.text,/Guests: 4/);assert.match(m.text,/€2,100.00/);
 assert.doesNotMatch(m.html,/<script>|SECRET_INTERNAL_NOTE|SECRET_CANCELLATION_REASON/);
 assert.doesNotMatch(m.text,/SECRET_/);assert.match(m.html,/&lt;script&gt;/);
});
test('cancellation invalidates the original confirmation with no refund promise',()=>{
 const m=harness().exports.rentalChangeTemplate({...event(),kind:'cancelled'},'https://preview.example.invalid');
 assert.match(m.text,/no longer valid/);assert.match(m.text,/CANCELLED/);assert.match(m.text,/handled separately/);assert.doesNotMatch(m.text,/SECRET_/);
});
test('recipient comes from verified booking owner and duplicate dispatch does not resend',async()=>{
 const h=harness();assert.equal(await h.exports.deliverRentalChange(),'accepted');
 assert.equal(await h.exports.deliverRentalChange(),'none');assert.equal(h.sent.length,1);
 assert.equal(h.sent[0].to,'guest@example.invalid');assert.equal(h.sent[0].messageId,'<rental-event-1@notifications.mzsgroup.com>');
});
for(const [name,options] of [['changed email',{email:'someone-else@example.invalid'}],['different owner',{owner:'other-guest'}],['test booking',{isTest:true}]])
 test(name+' never sends',async()=>{const h=harness(options);assert.equal(await h.exports.deliverRentalChange(),'failed');assert.equal(h.sent.length,0)});
test('capture ignores inherited production SMTP and uses Preview links',async()=>{
 const h=harness({env:{VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:'https://senonkpxdtlhyhrubicg.supabase.co',VERCEL_URL:'mzs-group-test.vercel.app',MZS_RENTAL_MAIL_MODE:'capture'}});
 assert.equal(await h.exports.deliverRentalChange(),'captured');assert.equal(h.transports[0].streamTransport,true);assert.equal(h.transports[0].host,undefined);
 assert.match(h.sent[0].text,/https:\/\/mzs-group-test.vercel.app\/private\/reservations/);
});
for(const [name,env] of [['Preview SMTP',{VERCEL_ENV:'preview'}],['Preview Production database',{VERCEL_ENV:'preview',MZS_RENTAL_MAIL_MODE:'capture'}],['disabled',{MZS_RENTAL_NOTIFICATIONS_ENABLED:'false'}],['Production capture',{MZS_RENTAL_MAIL_MODE:'capture'}]])
 test(name+' fails closed',async()=>{const h=harness({env});assert.equal(await h.exports.deliverRentalChange(),'disabled');assert.equal(h.sent.length,0)});
for(const [name,error,status] of [['temporary rejection',{responseCode:450,command:'DATA'},'retry'],['permanent rejection',{responseCode:550,command:'RCPT TO'},'failed'],['connection failure',{code:'ECONNREFUSED',command:'CONN'},'retry'],['ambiguous DATA timeout',{code:'ETIMEDOUT',command:'DATA'},'uncertain'],['lost connection after DATA',{code:'ESOCKET',command:'CONN'},'uncertain']])
 test(name,async()=>{const h=harness({sendError:error});assert.equal(await h.exports.deliverRentalChange(),status);assert.equal(h.updates.at(-1).status,status)});
test('accepted mail with failed database acknowledgement stays uncertain',async()=>{
 const h=harness({persistError:true});assert.equal(await h.exports.deliverRentalChange(),'uncertain');assert.equal(h.sent.length,1);assert.equal(h.updates[0].status,'accepted');
});
test('retry exhaustion requires review',async()=>{
 const h=harness({event:{attempts:5},sendError:{responseCode:450}});assert.equal(await h.exports.deliverRentalChange(),'failed');
});
test('recipient lookup failure never sends and eventually stops retrying',async()=>{
 const h=harness({event:{attempts:5},lookupError:true});assert.equal(await h.exports.deliverRentalChange(),'failed');assert.equal(h.sent.length,0);
});

// Real Nodemailer against a local SMTP stub. No external connection or real recipient.
for(const [mode,expected] of [['accepted','accepted'],['temporary','retry'],['permanent','failed'],['lost-data-reply','uncertain']]) {
 test('SMTP protocol: '+mode,async()=>{
  const messages=[],recipients=[],sockets=new Set();
  const server=net.createServer(socket=>{
   sockets.add(socket);socket.on('close',()=>sockets.delete(socket));
   socket.write('220 local.test ESMTP\r\n');let buffer='',inData=false,lines=[];
   socket.on('data',chunk=>{
    buffer+=chunk.toString();let index;
    while((index=buffer.indexOf('\r\n'))>=0){
     const line=buffer.slice(0,index);buffer=buffer.slice(index+2);
     if(inData){
      if(line!=='.'){lines.push(line);continue;}
      messages.push(lines.join('\n'));inData=false;
      if(mode==='lost-data-reply'){socket.destroy();return;}
      socket.write(mode==='temporary'?'450 Try later\r\n':mode==='permanent'?'550 Message rejected\r\n':'250 queued\r\n');
     } else if(/^EHLO|^HELO/.test(line))socket.write('250 local.test\r\n');
     else if(/^MAIL FROM/.test(line))socket.write('250 OK\r\n');
     else if(/^RCPT TO/.test(line)){recipients.push(line);socket.write('250 OK\r\n');}
     else if(line==='DATA'){inData=true;lines=[];socket.write('354 End with dot\r\n');}
     else if(line==='QUIT')socket.end('221 Bye\r\n');
     else socket.write('250 OK\r\n');
    }
   });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
   const h=harness({transportFactory:()=>nodemailer.createTransport({host:'127.0.0.1',port:server.address().port,secure:false,ignoreTLS:true,connectionTimeout:2000,socketTimeout:2000})});
   assert.equal(await h.exports.deliverRentalChange(),expected);
   assert.equal(messages.length,1);assert.deepEqual(recipients,['RCPT TO:<guest@example.invalid>']);
   assert.doesNotMatch(messages[0],/SECRET_INTERNAL|SECRET_CANCELLATION/);
   assert.equal(await h.exports.deliverRentalChange(),'none');assert.equal(messages.length,1);
  }finally{for(const s of sockets)s.destroy();await new Promise(resolve=>server.close(resolve));}
 });
}

test('Russian change mail uses actual recipient preference and retains cancellation semantics',async()=>{
 const h=harness({locale:'ru',event:{kind:'cancelled'}});
 assert.equal(await h.exports.deliverRentalChange(),'accepted');
 assert.match(h.sent[0].subject,/отменено/);assert.match(h.sent[0].text,/Предыдущее подтверждение больше не действует/);
 assert.doesNotMatch(h.sent[0].html,/<script>|SECRET_/);
});
