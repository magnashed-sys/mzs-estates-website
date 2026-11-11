import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';

function load(path, require=()=>{throw Error('Unexpected import');}) {
 const exports={};
 new Function('exports','require','Response',ts.transpileModule(readFileSync(path,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText)(exports,require,Response);
 return exports;
}
const bytes=new TextEncoder().encode('Synthetic private image');
const asset={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
const api=load('lib/projects/private-visual-response.ts',name=>{
 if(name==='node:crypto')return {createHash};
 if(name==='./floraweg-private-assets')return {florawegPrivateAssets:{'test.webp':asset}};
 throw Error(name);
});
function fixture(options={}) {
 let sessions=0,privileged=0,downloads=0;const queries=[];
 const rows={profiles:{role:'client',is_active:true},projects:{id:'project-flora'},
  project_access:{project_id:'project-flora'},offering_access:[{offering_id:'offer-1'}],offerings:[{id:'offer-1'}],...options.rows};
 const db={auth:{getUser:async()=>options.auth||{data:{user:{id:'user-1'}},error:null}},from(table){
  const q={table,filters:[]};queries.push(q);
  const result=()=>({data:rows[table],error:options.errorTable===table?{message:'private database detail'}:null});
  const builder={select(){return this;},eq(...args){q.filters.push(args);return this;},in(...args){q.filters.push(args);return this;},limit(){return this;},
   single:async()=>result(),maybeSingle:async()=>result(),then:(resolve,reject)=>Promise.resolve(result()).then(resolve,reject)};
  return builder;
 }};
 const deps={session:async()=>{sessions++;if(options.sessionThrows)throw Error('offline');return db;},storage:()=>{
  privileged++;if(options.storageThrows)throw Error('secret unavailable');
  return {storage:{from(bucket){assert.equal(bucket,'mzs-private-project-visuals');return {download:async(path,transform,fetchOptions)=>{
   downloads++;assert.equal(path,'amsterdam-floraweg/do-2026/test.webp');assert.equal(fetchOptions.cache,'no-store');
   return {data:options.missing?null:new Blob([options.body||bytes]),error:options.storageError?{}:null};
  }};}}};
 }};
 return {run:(slug='amsterdam-floraweg',file='test.webp')=>api.privateVisualResponse(slug,file,deps),
  counts:()=>({sessions,privileged,downloads}),queries};
}
function noStore(response){
 assert.match(response.headers.get('cache-control'),/private.*no-store/);
 assert.equal(response.headers.get('vercel-cdn-cache-control'),'no-store');
 assert.equal(response.headers.get('vary'),'Cookie');
 assert.equal(response.headers.get('cross-origin-resource-policy'),'same-origin');
 assert.equal(response.headers.get('location'),null);
 assert.equal(response.headers.get('access-control-allow-origin'),null);
}
test('Unknown projects, filenames and path traversal never initialize a session or privileged client',async()=>{
 for(const [slug,file] of [['other','test.webp'],['amsterdam-floraweg','../test.webp'],['amsterdam-floraweg','__proto__'],['amsterdam-floraweg','missing.webp']]){
  const f=fixture(),r=await f.run(slug,file);assert.equal(r.status,404);noStore(r);assert.deepEqual(f.counts(),{sessions:0,privileged:0,downloads:0});
 }
});
test('Anonymous and expired sessions cannot fetch private image bytes',async()=>{
 for(const auth of [{data:{user:null},error:null},{data:{user:{id:'user-1'}},error:{message:'expired'}}]){
  const f=fixture({auth}),r=await f.run();assert.equal(r.status,401);noStore(r);assert.equal(f.counts().privileged,0);
 }
});
test('Inactive/unsupported accounts, revoked project grants and missing active offering grants fail closed',async()=>{
 for(const rows of [{profiles:{role:'client',is_active:false}},{profiles:{role:'staff',is_active:true}},
  {profiles:null},{projects:null},{project_access:null},{offering_access:[]},{offerings:[]}]){
  const f=fixture({rows}),r=await f.run();assert.equal(r.status,404);noStore(r);assert.equal(f.counts().privileged,0);
 }
 for(const errorTable of ['profiles','projects','project_access','offering_access','offerings']){
  const f=fixture({errorTable}),r=await f.run();assert.equal(r.status,404);assert.equal(f.counts().privileged,0);assert.equal(await r.text(),'');
 }
});
test('Authorized clients, partners and admins receive verified bytes only after the same project and offering checks',async()=>{
 for(const role of ['client','partner','admin']){
  const f=fixture({rows:{profiles:{role,is_active:true}}}),r=await f.run();
  assert.equal(r.status,200);noStore(r);assert.equal(r.headers.get('content-type'),'image/webp');
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes);assert.equal(f.counts().downloads,1);
  const query=table=>f.queries.find(q=>q.table===table).filters;
  assert.deepEqual(query('project_access'),[['project_id','project-flora'],['user_id','user-1']]);
  assert.deepEqual(query('offerings'),[['project_id','project-flora'],['status','active'],['id',['offer-1']]]);
 }
});
test('Missing, truncated or modified storage bytes never escape; backend exceptions reveal no details',async()=>{
 for(const options of [{missing:true},{storageError:true},{body:new Uint8Array(1)},{body:new Uint8Array(bytes.length)}]){
  const r=await fixture(options).run();assert.equal(r.status,404);noStore(r);assert.equal(await r.text(),'');
 }
 for(const options of [{sessionThrows:true},{storageThrows:true}]){
  const r=await fixture(options).run();assert.equal(r.status,503);noStore(r);assert.equal(await r.text(),'');
 }
});
test('The complete gallery uses cookie-authenticated image requests and no publicly deployed image files',()=>{
 const gallery=load('lib/floraweg-visuals.ts').florawegVisuals;
 const manifest=load('lib/projects/floraweg-private-assets.ts').florawegPrivateAssets;
 assert.equal(gallery.length,45);
 assert.deepEqual(gallery.map(x=>x.file).sort(),Object.keys(manifest).sort());
 for(const v of Object.values(manifest)){assert.match(v.sha256,/^[0-9a-f]{64}$/);assert.ok(v.bytes>0&&v.bytes<=2097152);}
 assert.equal(existsSync('public/properties/amsterdam-floraweg/do-2026'),false);
 const source=readFileSync('app/private/projects/[slug]/AmsterdamFlorawegInvestment.tsx','utf8');
 assert.match(source,/const base = "\/api\/project-visual\/amsterdam-floraweg"/);
 const ast=ts.createSourceFile('Gallery.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let count=0;
 function visit(node){if((ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node))&&node.tagName.getText(ast)==='Image'){
  count++;assert.ok(node.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(ast)==='unoptimized'),'Image optimization must not cache protected bytes');
 }ts.forEachChild(node,visit);}visit(ast);assert.equal(count,6);
 assert.doesNotMatch(source,/createSignedUrl|getPublicUrl|data:image/);
});
