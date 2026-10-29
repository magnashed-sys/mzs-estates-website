// Synthetic local integration only. Never authenticates against a real service.
const {chromium}=require(process.env.MZS_PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs'),crypto=require('node:crypto');
const admin='11111111-1111-4111-8111-111111111111',entity='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',docid='44444444-4444-4444-8444-444444444444';
const root='/admin/workspaces/accountancy/documents',bucket='mzs-private-accountancy-documents',now='2026-10-29T09:00:00Z';
const pdf=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n');
let role='admin',language='en',failed=false;const files=new Map();
const docs=[{id:docid,issuer_id:entity,fiscal_year:2023,title:'Synthetic balance 2023',original_name:'synthetic.pdf',category:'balance_sheet',period_label:'2023',document_date:'2024-09-13',review_status:'pending_review',notes:'Synthetic test only',file_path:`${entity}/2023/${docid}.pdf`,file_size_bytes:pdf.length,sha256:crypto.createHash('sha256').update(pdf).digest('hex'),created_at:now,updated_at:now,revision:1}];files.set(docs[0].file_path,pdf);
const events=[];const user={id:admin,aud:'authenticated',role:'authenticated',email:'archive@example.invalid',email_confirmed_at:now,created_at:now,app_metadata:{provider:'email'},user_metadata:{}};
const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:admin,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-signature'].join('.');
const server=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,PUT,DELETE,OPTIONS');res.setHeader('Access-Control-Expose-Headers','Content-Range');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.end();return;}const chunks=[];for await(const b of req)chunks.push(b);const body=Buffer.concat(chunks);let data={};try{data=JSON.parse(body.toString()||'{}')}catch{}
 const url=new URL(req.url,'http://fixture'),path=url.pathname,one=req.headers.accept?.includes('application/vnd.pgrst.object+json');
 const send=(v,status=200)=>{res.statusCode=status;res.end(JSON.stringify(v))};const rows=v=>{res.setHeader('Content-Range',`0-${Math.max(0,v.length-1)}/${v.length}`);send(one?(v[0]??null):v)};
 if(path==='/auth/v1/user')return send(user);
 if(path==='/rest/v1/profiles')return send(one?{id:admin,role,is_active:true,full_name:'Synthetic Administrator'}:[{id:admin,full_name:'Synthetic Administrator'}]);
 if(path==='/rest/v1/mzs_admin_language_preferences'){if(req.method==='POST'){language=data.language;return send(null,201);}return rows([{language}]);}
 if(path==='/rest/v1/mzs_lease_issuers'){let a=[{id:entity,name:'Synthetic Estates',tax_id:'TEST-ONLY'},{id:other,name:'Other Synthetic Entity',tax_id:'TEST-OTHER'}];if(url.searchParams.has('id'))a=a.filter(e=>'eq.'+e.id===url.searchParams.get('id'));return rows(a);}
 if(path==='/rest/v1/mzs_accountancy_document_events')return rows(events.filter(e=>'eq.'+e.document_id===url.searchParams.get('document_id')));
 if(path==='/rest/v1/mzs_accountancy_documents'){
  if(failed)return send({message:'Synthetic outage'},503);
  if(req.method==='POST'){
   if(docs.some(d=>d.issuer_id===data.issuer_id&&d.fiscal_year===data.fiscal_year&&d.sha256===data.sha256))return send({code:'23505',message:'Duplicate'},409);
   const d={...data,created_at:now,updated_at:now,revision:1};docs.push(d);events.push({id:crypto.randomUUID(),document_id:d.id,actor_id:admin,occurred_at:now,event_type:'created',after_data:{...d}});return send(null,201);
  }
  let a=docs.filter(d=>['id','issuer_id','fiscal_year','category','review_status','revision'].every(k=>!url.searchParams.has(k)||'eq.'+d[k]===url.searchParams.get(k)));
  if(req.method==='PATCH'){for(const d of a){Object.assign(d,data,{revision:d.revision+1});events.push({id:crypto.randomUUID(),document_id:d.id,actor_id:admin,occurred_at:now,event_type:'updated',after_data:{...d}});}return rows(a);}
  if(url.searchParams.has('title')){const q=url.searchParams.get('title').slice(7,-1);a=a.filter(d=>d.title.toLowerCase().includes(q.toLowerCase()));}return rows(a);
 }
 const storage='/storage/v1/object/';
 if(path.startsWith(storage+'sign/')){const key=decodeURIComponent(path.slice((storage+'sign/'+bucket+'/').length));if(!files.has(key))return send({},404);return send({signedURL:'/object/sign/'+bucket+'/'+key+'?token=synthetic-only'});}
 if(path.startsWith(storage+'authenticated/')){const key=decodeURIComponent(path.slice((storage+'authenticated/'+bucket+'/').length));res.setHeader('Content-Type','application/pdf');res.end(files.get(key)||Buffer.alloc(0));return;}
 if(path===storage+bucket&&req.method==='DELETE'){for(const p of data.prefixes??[])if(!docs.some(d=>d.file_path===p))files.delete(p);return send([]);}
 if(path.startsWith(storage+bucket+'/')&&req.method==='POST'){
  const key=decodeURIComponent(path.slice((storage+bucket+'/').length));if(files.has(key))return send({message:'Exists'},409);
  const start=body.indexOf('%PDF-'),end=body.indexOf('\r\n--',start);files.set(key,body.subarray(start,end<0?body.length:end));return send({Key:bucket+'/'+key},200);
 }
 if(path==='/rest/v1/rpc/mzs_admin_bookings_search_v2')return send({years:[2023,2026]});
 if(path.startsWith('/rest/v1/'))return rows([]);return send({error:'Unknown synthetic route: '+path},404);
});
(async()=>{
 await new Promise(r=>server.listen(3091,'127.0.0.1',r));const log=fs.openSync('/tmp/archive-local-server.log','w');const app=spawn('npm',['run','start','--','--hostname','127.0.0.1','--port','3090'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3091',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-test-key',VERCEL_ENV:'development'},stdio:['ignore',log,log]});let browser;
 try{
  for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:3090/login');break;}catch{await new Promise(r=>setTimeout(r,300));}}
  const cookie={name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify({access_token:token,refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})).toString('base64url'),url:'http://127.0.0.1:3090'};
  if(process.env.MZS_ARCHIVE_HTTP_ONLY==='1'){
   const request=(path,cookies=true)=>fetch('http://127.0.0.1:3090'+path,{headers:cookies?{Cookie:cookie.name+'='+cookie.value}:{},redirect:'manual'});
   let r=await request(root);assert.equal(r.status,200);let html=await r.text();assert.match(html,/Synthetic balance 2023/);assert.match(html,/target="_blank"/);assert.match(html,/Document archive/);fs.writeFileSync('/tmp/archive-render-en.html',html);
   r=await request(root+'?year=2022');assert.match(await r.text(),/No documents match these filters/);
   r=await request(root+'?entity='+other);assert.match(await r.text(),/No documents match these filters/);
   r=await request(root+'?year=bad');assert.match(await r.text(),/Invalid archive filters/);
   language='es';r=await request(root);html=await r.text();assert.match(html,/Archivo documental/);assert.match(html,/Balance de situación/);fs.writeFileSync('/tmp/archive-render-es.html',html);
   r=await request(root+'/'+docid);assert.equal(r.status,200);assert.match(await r.text(),/Historial de cambios/);
   r=await request(root+'/'+docid+'/file');assert.equal(r.status,302);assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('location'),/storage\/v1\/object\/sign/);
   r=await request(root+'/'+docid+'/file?download=1');assert.equal(r.status,302);
   role='client';assert.equal((await request(root)).status,404);assert.equal((await request(root+'/'+docid+'/file')).status,404);
   role='admin';assert.equal((await request(root+'/'+docid+'/file',false)).status,307);
   console.log('Archive HTTP integration passed: authenticated EN/ES rendering, entity/year/invalid filters, detail page, private signed open/download, client denial and anonymous redirect.');return;
  }
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.addCookies([cookie]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3090'+root);await page.getByRole('heading',{name:'Document archive',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Open PDF',exact:false}).getAttribute('target'),'_blank');
  await page.getByLabel('Financial year',{exact:true}).first().fill('2022');await page.getByRole('button',{name:'Apply filters'}).click();await page.getByText('No documents match these filters.').waitFor();
  await page.getByRole('link',{name:'Clear filters'}).click();await page.getByLabel('Entity',{exact:true}).first().selectOption(other);await page.getByRole('button',{name:'Apply filters'}).click();await page.getByText('No documents match these filters.').waitFor();
  await page.getByRole('link',{name:'Clear filters'}).click();await page.getByLabel('Archive language').selectOption('es');await page.getByRole('button',{name:'Save language'}).click();await page.getByRole('heading',{name:'Archivo documental'}).waitFor();assert.equal(language,'es');
  await page.reload();await page.getByRole('heading',{name:'Archivo documental'}).waitFor();
  await page.getByText('Añadir documento',{exact:true}).click();const form=page.locator('details form');await form.getByLabel('Entidad',{exact:true}).selectOption(entity);await form.getByLabel('Ejercicio',{exact:true}).fill('2023');await form.getByLabel('Título',{exact:true}).fill('Synthetic new report');
  const otherPdf=Buffer.from(pdf.toString()+'%different fixture\n');await form.getByLabel('Archivo PDF',{exact:false}).setInputFiles({name:'synthetic-new.pdf',mimeType:'application/pdf',buffer:otherPdf});await form.getByRole('button',{name:'Archivar documento'}).click();await page.getByText('Documento guardado.',{exact:true}).waitFor();assert.equal(docs.length,2);assert.equal(docs[1].sha256,crypto.createHash('sha256').update(otherPdf).digest('hex'));
  await form.getByLabel('Entidad',{exact:true}).selectOption(entity);await form.getByLabel('Ejercicio',{exact:true}).fill('2023');await form.getByLabel('Título',{exact:true}).fill('Duplicate attempt');await form.getByLabel('Archivo PDF',{exact:false}).setInputFiles({name:'duplicate.pdf',mimeType:'application/pdf',buffer:otherPdf});await form.getByRole('button',{name:'Archivar documento'}).click();await page.getByText('Este PDF ya está archivado para esta entidad y ejercicio.').waitFor();assert.equal(docs.length,2);assert.equal(files.size,2);
  await page.getByRole('link',{name:'Synthetic new report',exact:true}).click();await page.getByLabel('Estado de revisión').selectOption('needs_attention');await page.getByLabel('Notas para el asesor').fill('Synthetic follow-up');await page.getByRole('button',{name:'Guardar revisión'}).click();await page.waitForFunction(()=>document.body.textContent.includes('Requiere atención'));await page.reload();assert.equal(docs[1].notes,'Synthetic follow-up');await page.getByRole('heading',{name:'Historial de cambios'}).waitFor();
  const response=await context.request.get('http://127.0.0.1:3090'+root+'/'+docs[1].id+'/file',{maxRedirects:0});assert.equal(response.status(),302);assert.match(response.headers()['location'],/\/storage\/v1\/object\/sign\//);assert.match(response.headers()['cache-control'],/no-store/);
  await page.goto('http://127.0.0.1:3090'+root+'?year=2023');await page.screenshot({path:'/tmp/archive-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/archive-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  role='client';assert.equal((await page.goto('http://127.0.0.1:3090'+root)).status(),404);assert.equal((await context.request.get('http://127.0.0.1:3090'+root+'/'+docid+'/file',{maxRedirects:0})).status(),404);
  role='admin';failed=true;await page.goto('http://127.0.0.1:3090'+root);await page.getByRole('heading',{name:'Document archive unavailable / Archivo no disponible'}).waitFor();failed=false;
  await context.clearCookies();const signedOut=await context.request.get('http://127.0.0.1:3090'+root+'/'+docid+'/file',{maxRedirects:0});assert.equal(signedOut.status(),307);assert.match(signedOut.headers()['location'],/login/);
  assert.equal(errors.filter(e=>!e.includes('Server Components render')).length,0,errors.join('\n'));console.log('Archive browser journey passed: filters, language persistence, upload/server hash, duplicate cleanup, review/history, private download, mobile, denied roles and outage state.');
 }finally{if(browser)await browser.close();app.kill();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
