// Bounded child process. Only invoked after an independent clean scanner verdict.
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
globalThis.fetch=async()=>{throw Error('Network disabled in PDF text extraction');};
const chunks=[];let size=0;
for await(const chunk of process.stdin){size+=chunk.length;if(size>4*1024*1024)throw Error('PDF too large');chunks.push(chunk);}
const bytes=new Uint8Array(Buffer.concat(chunks));
let task;
try{
 task=getDocument({data:bytes,isEvalSupported:false,useSystemFonts:false,disableFontFace:true,useWasm:false,useWorkerFetch:false,stopAtErrors:true,verbosity:0});
 const pdf=await task.promise;
 if(pdf.numPages<1||pdf.numPages>20)throw Error('Page limit');
 const pages=[];let chars=0;
 for(let n=1;n<=pdf.numPages;n++){
  const page=await pdf.getPage(n),content=await page.getTextContent();
  const text=content.items.map(x=>'str' in x?x.str+(x.hasEOL?'\n':' '):'').join('');
  chars+=text.length;if(chars>60000)throw Error('Text limit');pages.push({page:n,text});page.cleanup();
 }
 process.stdout.write(JSON.stringify({pages}));
}catch{process.stdout.write(JSON.stringify({error:'unreadable'}));process.exitCode=1;}finally{await task?.destroy();}
