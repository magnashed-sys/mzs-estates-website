import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {moveReviewedMessage} from '../lib/accountancy/mailbox/move.mjs';
import {sha256} from '../lib/accountancy/mailbox/receipts.mjs';
const source=Buffer.from('synthetic email only');
function harness({capabilities=['MOVE','UIDPLUS'],validity=11n,failMove=false,badDestination=false,missingMap=false,denyReview=false,denyClaim=false}={}){
 const events=[],receipt={id:'r',state:'review',mailbox:'mase@mzsgroup.eu',folder:'INBOX',uid:42,uid_validity:'11',source_sha256:sha256(source),attachments:[{id:'a'}]};
 const client={
  capabilities:new Set(capabilities),mailbox:null,
  async connect(){events.push('connect')},async status(){return {uidValidity:22n}},
  async getMailboxLock(path,o){this.mailbox={uidValidity:path==='INBOX'?validity:22n,readOnly:o.readOnly};return {release(){events.push('release')}}},
  async download(uid){return {content:Readable.from([uid===42?source:badDestination?Buffer.from('wrong'):source])}},
  async messageMove(uid,folder,o){events.push('MOVE');assert.equal(uid,'42');assert.equal(folder,'Verwerkt');assert.equal(o.uid,true);if(failMove)throw Error('lost acknowledgement');return {uidValidity:22n,uidMap:new Map(missingMap?[]:[[42,99]])}},
  close(){events.push('close')}
 };
 return {events,run:()=>moveReviewedMessage({client,service:{},receipt,
  verify:async()=>{events.push('verify');if(denyReview)throw Error('review required')},
  claim:async()=>{events.push('claim');if(denyClaim)throw Error('concurrent');return 'token'},
  finish:async(_s,id,token,state,destination)=>{events.push(state);if(state==='moved')assert.equal(destination.destination_uid,99)}
 })};
}
test('moves only reviewed retained originals with verified destination',async()=>{const h=harness();assert.equal((await h.run()).state,'moved');assert.deepEqual(h.events.filter(x=>['verify','claim','MOVE','moved'].includes(x)),['verify','claim','MOVE','moved']);});
test('missing review or concurrent claim prevents any mailbox access',async()=>{for(const opts of [{denyReview:true},{denyClaim:true}]){const h=harness(opts);await assert.rejects(h.run());assert.ok(!h.events.includes('connect'));}});
test('native MOVE capability and UIDVALIDITY are mandatory',async()=>{for(const opts of [{capabilities:['UIDPLUS']},{capabilities:['MOVE']},{validity:99n}]){const h=harness(opts);assert.equal((await h.run()).state,'review');assert.ok(!h.events.includes('MOVE'));}});
test('lost acknowledgement, absent UID mapping or corrupt destination never claim success',async()=>{for(const opts of [{failMove:true},{missingMap:true},{badDestination:true}]){const h=harness(opts);assert.equal((await h.run()).state,'uncertain');assert.equal(h.events.filter(x=>x==='MOVE').length,1);assert.ok(!h.events.includes('moved'));}});
