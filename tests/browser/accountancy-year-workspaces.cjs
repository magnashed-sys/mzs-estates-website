// Synthetic local integration only. Never authenticates against a real service.
const http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs'),crypto=require('node:crypto');
const admin='11111111-1111-4111-8111-111111111111',entity='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',docid='44444444-4444-4444-8444-444444444444';
const root='/admin/workspaces/accountancy/documents',bucket='mzs-private-accountancy-documents',now='2026-10-29T09:00:00Z';
const pdf=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n');
let role='admin',language='en',failed=false;const files=new Map();
const docs=[{id:docid,issuer_id:entity,fiscal_year:2023,title:'Synthetic balance 2023',original_name:'synthetic.pdf',category:'balance_sheet',period_label:'2023',document_date:'2024-09-13',review_status:'pending_review',notes:'Synthetic test only',file_path:`${entity}/2023/${docid}.pdf`,file_size_bytes:pdf.length,sha256:crypto.createHash('sha256').update(pdf).digest('hex'),created_at:now,updated_at:now,revision:1}];files.set(docs[0].file_path,pdf);
const events=[];const user={id:admin,aud:'authenticated',role:'authenticated',email:'archive@example.invalid',email_confirmed_at:now,created_at:now,app_metadata:{provider:'email'},user_metadata:{}};
const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:admin,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-signature'].join('.');
const yearId='55555555-5555-4555-8555-555555555555',supplierId='66666666-6666-4666-8666-666666666666';
const years=[{id:yearId,issuer_id:entity,fiscal_year:2026,purpose:'current',vat_treatment:'pending',vat_effective_from:null,vat_evidence:'',notes:'Synthetic annual notes',checks:{income:false,costs:false,bank:false,assets:false,financing:false,tax:false,documents:false},revision:1,updated_at:now}];
const costs=[],reviews=[],projects=[];
function source(){return {administration:years[0],snapshot_at:now,sales:{issuer:{id:entity,name:'Synthetic Estates'},snapshot_at:now,leases:[],bookings:[],external:[],services:[],credit_notes:[],rent_receipts:[],guest_receipts:[],external_receipts:[],service_receipts:[],imported_receipts:[],imported:[]},costs,reviews,projects,documents:[],capital_references:[]};}
const server=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,PUT,DELETE,OPTIONS');res.setHeader('Access-Control-Expose-Headers','Content-Range');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.end();return;}const chunks=[];for await(const b of req)chunks.push(b);const body=Buffer.concat(chunks);let data={};try{data=JSON.parse(body.toString()||'{}')}catch{}
 const url=new URL(req.url,'http://fixture'),path=url.pathname,one=req.headers.accept?.includes('application/vnd.pgrst.object+json');
 const send=(v,status=200)=>{res.statusCode=status;res.end(JSON.stringify(v))};const rows=v=>{res.setHeader('Content-Range',`0-${Math.max(0,v.length-1)}/${v.length}`);send(one?(v[0]??null):v)};
 if(path==='/auth/v1/user')return send(user);
 if(path==='/rest/v1/profiles')return send(one?{id:admin,role,is_active:true,full_name:'Synthetic Administrator'}:[{id:admin,role,is_active:true,full_name:'Synthetic Administrator'}]);
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
 if(path==='/rest/v1/mzs_accountancy_years'){
  let a=years.filter(y=>['id','revision'].every(k=>!url.searchParams.has(k)||'eq.'+y[k]===url.searchParams.get(k)));
  if(req.method==='PATCH'){for(const y of a)Object.assign(y,data,{revision:y.revision+1});return rows(a);}
  if(req.method==='POST')return send({code:'23505'},409);return rows(a);
 }
 if(path==='/rest/v1/mzs_accountancy_projects'&&req.method==='POST'){projects.push({...data,id:crypto.randomUUID()});return send(null,201);}
 if(path==='/rest/v1/mzs_lease_relationships')return rows([{id:supplierId,name:'Synthetic supplier'}]);
 if(path==='/rest/v1/mzs_ops_expense_drafts'&&req.method==='POST'){
  if(costs.some(c=>c.supplier_invoice_number===data.supplier_invoice_number))return send({code:'23505'},409);
  costs.push({...data,id:crypto.randomUUID(),supplier_name:'Synthetic supplier',property_name:null,gross_cents:data.net_cents+data.vat_cents,created_at:now,source_document_status:'missing'});return send(null,201);
 }
 if(path==='/rest/v1/mzs_accountancy_cost_reviews'&&req.method==='POST'){reviews.push({...data,revision:1,updated_at:now});return rows([data]);}
 if(path==='/rest/v1/rpc/mzs_accountancy_year_source'){if(failed)return send({message:'Synthetic unavailable'},503);return send(source());}
 if(path==='/rest/v1/rpc/mzs_admin_bookings_search_v2')return send({years:[2023,2026]});
 if(path.startsWith('/rest/v1/'))return rows([]);return send({error:'Unknown synthetic route: '+path},404);
});
(async()=>{
 await new Promise(r=>server.listen(3091,'127.0.0.1',r));const log=fs.openSync('/tmp/annual-local-server.log','w');const app=spawn('npm',['run','start','--','--hostname','127.0.0.1','--port','3090'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3091',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-test-key',VERCEL_ENV:'development'},stdio:['ignore',log,log]});
 try{
  for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:3090/login');break;}catch{await new Promise(r=>setTimeout(r,300));}}
  const cookie='sb-127-auth-token=base64-'+Buffer.from(JSON.stringify({access_token:token,refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})).toString('base64url');
  const annual='/admin/workspaces/accountancy/administrations',detail=annual+'/'+yearId,request=(p,auth=true)=>fetch('http://127.0.0.1:3090'+p,{headers:auth?{Cookie:cookie}:{},redirect:'manual'});
  const manifest=JSON.parse(fs.readFileSync('.next/server/server-reference-manifest.json','utf8'));
  async function action(name,fields){const id=Object.entries(manifest.node).find(([,v])=>v.exportedName===name)?.[0];assert.ok(id,name+' server action exists');const form=new FormData();for(const [k,v] of Object.entries(fields))form.set(k,String(v));const body=await require('next/dist/compiled/react-server-dom-webpack/client.node').encodeReply([form]);const r=await fetch('http://127.0.0.1:3090'+detail,{method:'POST',headers:{Cookie:cookie,Origin:'http://127.0.0.1:3090','Next-Action':id},body});const text=await r.text();assert.equal(r.status,200,text.slice(0,1000));return text;}
  let r=await request(detail+'/import');assert.equal(r.status,200);assert.match(await r.text(),/Prepare a cost import/);
  r=await request(annual);assert.equal(r.status,200);assert.match(await r.text(),/Year administrations/);
  r=await request(detail);assert.equal(r.status,200);let html=await r.text();assert.match(html,/Synthetic Estates/);assert.match(html,/Record a supplier cost/);assert.match(html,/Professional advice/);fs.writeFileSync('/tmp/annual-render-en.html',html);
  let result=await action('saveYear',{id:yearId,revision:1,vat_treatment:'pending',vat_effective_from:'',vat_evidence:'',notes:'Synthetic saved notes',check_income:'on'});assert.match(result,/"ok":true/);assert.equal(years[0].revision,2);assert.equal(years[0].notes,'Synthetic saved notes');assert.equal(years[0].checks.income,true);
  result=await action('saveYear',{id:yearId,revision:1,vat_treatment:'pending',vat_effective_from:'',vat_evidence:'',notes:'Stale update'});assert.match(result,/"code":"stale"/);assert.equal(years[0].notes,'Synthetic saved notes');
  result=await action('createProject',{year_id:yearId,name:'Synthetic renovation',kind:'renovation',property_id:'',source_reference:'TEST-ONLY'});assert.match(result,/"ok":true/);assert.equal(projects.length,1);
  const costFields={year_id:yearId,supplier_relationship_id:supplierId,supplier_invoice_number:'TEST-ONLY-1',invoice_date:'2026-04-10',property_id:'',category:'advice',description:'Synthetic advisory cost',net:'100.00',vat:'21.00'};
  result=await action('createCost',costFields);assert.match(result,/"ok":true/);assert.equal(costs.length,1);assert.equal(costs[0].cost_scope,'entity');assert.equal(costs[0].gross_cents,12100);
  result=await action('createCost',costFields);assert.match(result,/"code":"duplicate"/);assert.equal(costs.length,1);
  result=await action('saveCostReview',{year_id:yearId,draft_id:costs[0].id,revision:0,category:'advice',project_id:projects[0].id,review_status:'reviewed',evidence_reference:'Synthetic invoice reference',note:''});assert.match(result,/"ok":true/);assert.equal(reviews.length,1);
  language='es';r=await request(detail+'/import');assert.equal(r.status,200);assert.match(await r.text(),/Preparar una importación de costes/);r=await request(detail);html=await r.text();assert.equal(r.status,200);assert.match(html,/<html[^>]+lang="es"/);assert.match(html,/Administraciones anuales/);assert.match(html,/Asesoramiento profesional/);assert.match(html,/Synthetic saved notes/);assert.match(html,/TEST-ONLY-1/);assert.match(html,/121,00/);fs.writeFileSync('/tmp/annual-render-es.html',html);
  r=await request(detail+'?status=excluded');assert.match(await r.text(),/Ningún coste de proveedor coincide/);
  r=await request(detail+'/export');assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);const zip=Buffer.from(await r.arrayBuffer());assert.equal(zip.readUInt32LE(0),0x04034b50);assert.ok(zip.length>1000);
  failed=true;r=await request(detail+'/export');assert.equal(r.status,503);failed=false;
  role='client';assert.equal((await request(detail+'/import')).status,404);assert.equal((await request(detail)).status,404);assert.equal((await request(detail+'/export')).status,404);
  role='admin';assert.equal((await request(detail+'/import',false)).status,307);assert.equal((await request(detail,false)).status,307);assert.equal((await request(detail+'/export',false)).status,307);
  console.log('Annual administration HTTP integration passed: authenticated EN/ES screens; real Next save-year, stale-revision, create-cost, duplicate and review server actions; amounts and filters; real ZIP serialization; fail-closed export; client denial and anonymous redirects.');
 }finally{app.kill('SIGTERM');server.close();fs.closeSync(log);}
})().catch(e=>{console.error(e);process.exitCode=1});
