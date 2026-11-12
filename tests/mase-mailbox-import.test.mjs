import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {parsePdfAttachments,importMailboxBatch,MAX_MESSAGE_BYTES} from '../lib/accountancy/mailbox/import.mjs';
const pdf=Buffer.from('%PDF-'+'.'.repeat(150));
const mime=(attachments)=>Buffer.from('MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="test"\r\n\r\n'+attachments.map(({name,bytes,type='application/pdf'})=>'--test\r\nContent-Type: '+type+'\r\nContent-Disposition: attachment; filename="'+name+'"\r\nContent-Transfer-Encoding: base64\r\n\r\n'+bytes.toString('base64')+'\r\n').join('')+'--test--\r\n');
test('real MIME parsing preserves two PDF attachments',async()=>{const files=await parsePdfAttachments(mime([{name:'one.pdf',bytes:pdf},{name:'two.pdf',bytes:pdf}]));assert.equal(files.length,2);assert.deepEqual(files[0].bytes,pdf);});
test('unsupported, invalid and oversized messages fail before persistence',async()=>{await assert.rejects(parsePdfAttachments(mime([{name:'other.zip',bytes:pdf,type:'application/zip'}])));await assert.rejects(parsePdfAttachments(mime([{name:'bad.pdf',bytes:Buffer.from('not a pdf')}])));await assert.rejects(parsePdfAttachments(Buffer.alloc(MAX_MESSAGE_BYTES+1)));});
function fake(source,{readOnly=true,uidValidity=123n,reportedSize=source.length}={}){
 const calls=[],client={
  mailbox:{exists:1,uidValidity,uidNext:43n,readOnly},
  async connect(){calls.push('connect')},
  async getMailboxLock(path,options){assert.equal(path,'INBOX');assert.equal(options.readOnly,true);return {release(){calls.push('release')}}},
  async search(){calls.push('search');return [42]},
  async fetchAll(range,query,options){assert.equal(range,'42');assert.equal(options.uid,true);return [{uid:42,size:reportedSize}]},
  async download(uid,part,options){assert.equal(uid,42);assert.equal(options.uid,true);return {content:Readable.from([source])}},
  close(){calls.push('close')},
  messageMove(){throw Error('must never move')},messageFlagsAdd(){throw Error('must never mark seen')}
 };return {client,calls};
}
test('retains all attachments and closes read-only mailbox without message writes',async()=>{
 const f=fake(mime([{name:'one.pdf',bytes:pdf},{name:'two.pdf',bytes:pdf}]));let n=0;
 const result=await importMailboxBatch({client:f.client,retain:async()=>({status:200,body:{id:String(++n),verdict:'clean'}})});
 assert.equal(result[0].code,'retained');assert.equal(result[0].intakes.length,2);assert.equal(result[0].uidValidity,'123');assert.equal(f.calls.at(-1),'close');
});
test('a partial failure remains retryable and duplicates reuse their intake',async()=>{
 const f=fake(mime([{name:'one.pdf',bytes:pdf},{name:'two.pdf',bytes:pdf}]));let n=0;
 let result=await importMailboxBatch({client:f.client,retain:async()=>++n===1?{status:200,body:{id:'saved',verdict:'clean'}}:{status:503,body:{}}});
 assert.equal(result[0].code,'partial');
 result=await importMailboxBatch({client:f.client,retain:async()=>({status:200,body:{id:'saved',verdict:'clean',duplicate:true}})});
 assert.equal(result[0].code,'retained');assert.equal(result[0].intakes[0].duplicate,true);
});
test('blocked scan and incomplete source never count as retained',async()=>{
 const source=mime([{name:'one.pdf',bytes:pdf}]);const f=fake(source);
 assert.equal((await importMailboxBatch({client:f.client,retain:async()=>({status:200,body:{id:'quarantine',verdict:'malicious'}})}))[0].code,'needs_attention');
 const truncated=fake(source,{reportedSize:source.length+1});let called=false;
 assert.equal((await importMailboxBatch({client:truncated.client,retain:async()=>{called=true;}}))[0].code,'needs_attention');assert.equal(called,false);
});
test('read-write mailbox is rejected, cursor past last UID never fetches',async()=>{
 const f=fake(pdf,{readOnly:false});await assert.rejects(importMailboxBatch({client:f.client,retain:async()=>{}}));assert.equal(f.calls.at(-1),'close');
 const other=fake(pdf);assert.deepEqual(await importMailboxBatch({client:other.client,afterUid:42,expectedValidity:'123',retain:async()=>{}}),[]);assert.ok(!other.calls.includes('search'));
});

test('changed UIDVALIDITY refuses a stale cursor before retrieval',async()=>{const f=fake(pdf);await assert.rejects(importMailboxBatch({client:f.client,afterUid:1,expectedValidity:'999',retain:async()=>{}}));assert.ok(!f.calls.includes('search'));});

test('receipt is recorded only after every attachment is clean and retained',async()=>{
 const source=mime([{name:'one.pdf',bytes:pdf},{name:'two.pdf',bytes:pdf}]);let receipts=0;
 const record=async r=>{receipts++;assert.deepEqual(r.source,source);assert.equal(r.files.length,2);assert.equal(r.intakes.length,2);return {id:'receipt',state:'review'}};
 const good=await importMailboxBatch({client:fake(source).client,record,retain:async()=>({status:200,body:{id:'saved',verdict:'clean'}})});
 assert.equal(good[0].receiptId,'receipt');assert.equal(receipts,1);
 await importMailboxBatch({client:fake(source).client,record,retain:async()=>({status:503,body:{}})});
 assert.equal(receipts,1);
 const failed=await importMailboxBatch({client:fake(source).client,record:async()=>{throw Error('database offline')},retain:async()=>({status:200,body:{id:'saved',verdict:'clean'}})});
 assert.equal(failed[0].code,'partial');assert.equal(failed[0].receiptId,undefined);
});
