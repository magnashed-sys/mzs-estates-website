import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=ts.transpileModule(readFileSync('app/admin/workspaces/accountancy/documents/Forms.tsx','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
}).outputText;
const uuid='00000000-0000-4000-8000-000000000009';
class TestFile {
 constructor(name,source='%PDF-1.7\nSynthetic content'){this.name=name;this.bytes=new TextEncoder().encode(source);this.size=this.bytes.length;}
 async arrayBuffer(){return this.bytes.buffer.slice(this.bytes.byteOffset,this.bytes.byteOffset+this.bytes.byteLength);}
}
class TestFormData {
 constructor(form){this.entries=new Map(form?.values??[]);}
 get(name){return this.entries.get(name)??null;}
 set(name,value){this.entries.set(name,value);}
 delete(name){this.entries.delete(name);}
}
function find(node,predicate){
 if(!node||typeof node!=='object')return null;
 if(predicate(node))return node;
 const children=node.props?.children;
 for(const child of Array.isArray(children)?children:[children]){
  const found=find(child,predicate);if(found)return found;
 }
 return null;
}
async function scenario({linkOk=true,attachTo={kind:'cost',id:'00000000-0000-4000-8000-000000000006'}}={}){
 const calls=[],updates=[],exports={};
 const file=new TestFile('synthetic-original.pdf');
 const original=new TestFormData();
 for(const [k,v] of Object.entries({issuer_id:'00000000-0000-4000-8000-000000000003',fiscal_year:'2025',title:'Synthetic source',category:'supplier_invoice',review_status:'pending_review',period_label:'',document_date:'2025-01-01',notes:'',file}))original.set(k,v);
 const form={values:original.entries,reset(){calls.push(['reset']);}};
 const runtime={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 const db={storage:{from(bucket){assert.equal(bucket,'mzs-private-accountancy-documents');return {
  async upload(path,uploaded,options){calls.push(['upload',path,uploaded.name,options.upsert]);return {error:null};},
  async remove(paths){calls.push(['remove',paths]);return {error:null};}
 };}}};
 const noop=()=>null;
 vm.runInNewContext(source,{
  exports,File:TestFile,FormData:TestFormData,Uint8Array,TextDecoder,TextEncoder,crypto:{randomUUID:()=>uuid},
  require(name){
   if(name==='react')return {useRef:value=>({current:value}),useState:value=>[value,x=>updates.push(x)]};
   if(name==='next/navigation')return {useRouter:()=>({refresh:()=>calls.push(['refresh'])})};
   if(name==='react/jsx-runtime')return runtime;
   if(name.includes('supabase/client'))return {createClient:()=>db};
   if(name.includes('accountancy/archive'))return {
    ARCHIVE_BUCKET:'mzs-private-accountancy-documents',MAX_PDF_BYTES:20971520,ARCHIVE_ROOT:'/admin/workspaces/accountancy/documents',
    copy:{en:{saved:'Saved',savedAndLinked:'Archived and linked',savedButUnlinked:'Archived but linking unconfirmed',failed:'Failed',saving:'Saving',invalid_pdf:'Invalid PDF'}},
    categories:[],categoryLabels:{en:{}},statuses:[],statusLabels:{en:{}},
    validatePdf:bytes=>{if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('invalid_pdf')},
    documentPath:(entity,year,id)=>entity+'/'+year+'/'+id+'.pdf'
   };
   if(name.endsWith('/documents/actions')||name==='./actions')return {
    async registerDocument(f){calls.push(['register',f.get('original_name'),f.get('id')]);return {ok:true,id:uuid};},
    updateDocument:noop
   };
   if(name.endsWith('/links/actions')||name==='./links/actions')return {
    async saveDocumentLink(f){calls.push(['link',f.get('kind'),f.get('target_id'),f.get('document_id')]);return {ok:linkOk};}
   };
   if(name.endsWith('.module.css'))return {};
   throw Error('Unexpected import '+name);
  }
 });
 const element=exports.UploadForm({entities:[],language:'en',entity:'00000000-0000-4000-8000-000000000003',year:2025,attachTo});
 const node=find(element,x=>x.type==='form'&&typeof x.props.onSubmit==='function');
 assert.ok(node,'upload form should exist');
 await node.props.onSubmit({preventDefault(){},currentTarget:form});
 return {calls,updates};
}
test('new original is first archived then linked to exactly the selected dossier',async()=>{
 const {calls,updates}=await scenario();
 assert.deepEqual(calls.map(c=>c[0]),['upload','register','link','reset','refresh']);
 assert.deepEqual(calls.find(x=>x[0]==='link').slice(1),['cost','00000000-0000-4000-8000-000000000006',uuid]);
 assert.ok(updates.includes('Archived and linked'));
 assert.ok(!calls.some(x=>x[0]==='remove'));
});
test('a failed or ambiguous link never removes a registered original or claims it is linked',async()=>{
 const {calls,updates}=await scenario({linkOk:false});
 assert.ok(calls.some(x=>x[0]==='register'));
 assert.ok(calls.some(x=>x[0]==='link'));
 assert.ok(!calls.some(x=>x[0]==='remove'));
 assert.ok(updates.includes('Archived but linking unconfirmed'));
 assert.ok(!updates.includes('Archived and linked'));
});
test('uploading in the general archive creates no dossier association',async()=>{
 const {calls,updates}=await scenario({attachTo:null});
 assert.ok(calls.some(x=>x[0]==='register'));
 assert.ok(!calls.some(x=>x[0]==='link'));
 assert.ok(updates.includes('Saved'));
});
