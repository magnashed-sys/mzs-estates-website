import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {checkMailbox} from '../scripts/check-mase-mailbox.mjs';

function fake({authorized=true,auth='OK',inbox='OK',folder='OK',fragment=false}={}) {
  const writes=[];
  const connect=options=>{
    assert.equal(options.rejectUnauthorized,true);
    assert.equal(options.host,'mailspace.org');
    const socket=new EventEmitter();socket.authorized=authorized;
    socket.destroy=()=>{};
    function send(line) {
      queueMicrotask(()=>{
        if(fragment){socket.emit('data',Buffer.from(line.slice(0,7)));socket.emit('data',Buffer.from(line.slice(7)));}
        else socket.emit('data',Buffer.from(line));
      });
    }
    socket.write=line=>{
      writes.push(line);
      const tag=line.slice(0,2);
      send(tag+' '+({A1:auth,A2:inbox,A3:folder}[tag])+' result\r\n');
    };
    send('* OK [CAPABILITY IMAP4rev1 SASL-IR AUTH=PLAIN] ready\r\n');
    return socket;
  };
  return {connect,writes};
}
const env={MZS_MASE_IMAP_PASSWORD:'synthetic-password'};
test('missing password never opens a connection',async()=>{
  assert.equal((await checkMailbox({},()=>{throw Error('must not connect')})).code,'missing_password');
});
test('TLS, authentication and both folders pass with fragmented responses',async()=>{
  const f=fake({fragment:true});assert.equal((await checkMailbox(env,f.connect)).ok,true);
  assert.deepEqual(f.writes.map(x=>x.split(' ')[1]),['AUTHENTICATE','STATUS','STATUS']);
  assert.match(f.writes[2],/STATUS "Verwerkt"/);
});
test('untrusted TLS never sends credentials',async()=>{
  const f=fake({authorized:false});assert.equal((await checkMailbox(env,f.connect)).code,'invalid_greeting');assert.equal(f.writes.length,0);
});
test('authentication failure stops before folder access and redacts credentials',async()=>{
  const f=fake({auth:'NO'});const result=await checkMailbox(env,f.connect);
  assert.equal(result.code,'authentication_failed');assert.equal(f.writes.length,1);assert.ok(!JSON.stringify(result).includes(env.MZS_MASE_IMAP_PASSWORD));
});
test('missing inbox or processed folder prevents readiness',async()=>{
  for(const [options,code] of [[{inbox:'NO'},'inbox_unavailable'],[{folder:'NO'},'processed_folder_unavailable']]){
    const f=fake(options);assert.equal((await checkMailbox(env,f.connect)).code,code);
  }
});
