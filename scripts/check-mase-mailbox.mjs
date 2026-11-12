import tls from 'node:tls';
import {pathToFileURL} from 'node:url';

// Read-only: no SELECT, FETCH, STORE, MOVE, SMTP, or message content logging.
export function checkMailbox(env = process.env, connect = tls.connect) {
  if (!env.MZS_MASE_IMAP_PASSWORD) return Promise.resolve({ok:false,stage:'configuration',code:'missing_password'});
  return new Promise(resolve => {
    let socket, finished = false, buffer = '', stage = 'connect';
    const timer = setTimeout(() => finish(false, 'timeout'), 15000);
    function finish(ok, code) {
      if (finished) return;
      finished = true; clearTimeout(timer); socket?.destroy();
      resolve({ok,stage,code});
    }
    try {
      socket = connect({host:'mailspace.org',port:993,servername:'mailspace.org',rejectUnauthorized:true});
      socket.on('error', () => finish(false, 'connection_failed'));
      socket.on('close', () => finish(false, 'connection_closed'));
      socket.on('data', bytes => {
        if (finished) return;
        buffer += bytes.toString('utf8');
        if (buffer.length > 16384) return finish(false, 'unexpected_response');
        let end;
        while (!finished && (end = buffer.indexOf('\r\n')) !== -1) {
          const line = buffer.slice(0,end); buffer = buffer.slice(end+2);
          if (/^\* BYE\b/i.test(line)) return finish(false, 'server_closed');
          if (stage === 'connect') {
            if (!socket.authorized || !/^\* OK\b/i.test(line)) return finish(false, 'invalid_greeting');
            // Only use SASL initial response when explicitly advertised.
            if (!/\bSASL-IR\b/i.test(line) || !/\bAUTH=PLAIN\b/i.test(line)) return finish(false, 'unsupported_auth');
            stage = 'authentication';
            const auth = Buffer.from('\0mase@mzsgroup.eu\0' + env.MZS_MASE_IMAP_PASSWORD).toString('base64');
            socket.write('A1 AUTHENTICATE PLAIN ' + auth + '\r\n');
          } else if (stage === 'authentication' && /^A1 /i.test(line)) {
            if (!/^A1 OK\b/i.test(line)) return finish(false, 'authentication_failed');
            stage = 'inbox'; socket.write('A2 STATUS "INBOX" (MESSAGES UIDVALIDITY)\r\n');
          } else if (stage === 'inbox' && /^A2 /i.test(line)) {
            if (!/^A2 OK\b/i.test(line)) return finish(false, 'inbox_unavailable');
            stage = 'processed_folder'; socket.write('A3 STATUS "Verwerkt" (MESSAGES UIDVALIDITY)\r\n');
          } else if (stage === 'processed_folder' && /^A3 /i.test(line)) {
            return finish(/^A3 OK\b/i.test(line), /^A3 OK\b/i.test(line) ? 'ready' : 'processed_folder_unavailable');
          }
        }
      });
    } catch { finish(false, 'connection_failed'); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkMailbox();
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
}
