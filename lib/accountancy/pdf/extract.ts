import 'server-only';
import {spawn} from 'node:child_process';
import path from 'node:path';
import type {ExtractedPage} from './model';
/** PDF.js runs with no application credentials in a memory/time-bounded child. */
export async function extractPurchasePdf(bytes:Uint8Array):Promise<ExtractedPage[]>{
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--max-old-space-size=192',path.join(process.cwd(),'scripts/extract-purchase-pdf.mjs')],{env:{NODE_ENV:'production',PATH:process.env.PATH??''},stdio:['pipe','pipe','pipe']});
  let output='',settled=false;const finish=(error?:Error,pages?:ExtractedPage[])=>{if(settled)return;settled=true;clearTimeout(timer);child.kill('SIGKILL');error?reject(error):resolve(pages!);};
  const timer=setTimeout(()=>finish(Error('PDF extraction timed out')),20000);
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>300000)finish(Error('PDF extraction too large'));});
  child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});child.on('error',()=>finish(Error('PDF extraction unavailable')));
  child.on('close',code=>{try{const data=JSON.parse(output);if(code!==0||!Array.isArray(data.pages)||data.pages.length>20||data.pages.some((p:ExtractedPage)=>!Number.isInteger(p.page)||typeof p.text!=='string')||data.pages.reduce((n:number,p:ExtractedPage)=>n+p.text.length,0)>60000)throw Error();finish(undefined,data.pages);}catch{finish(Error('PDF could not be read'));}});
  child.stdin.end(bytes);
 });
}
