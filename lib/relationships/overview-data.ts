import type {SupabaseClient} from '@supabase/supabase-js';
import {allRows} from '../property-operations/staff-data';
import {capitalDealsEnabled} from '../security/capital-deals';
import {contractInScope,overviewInvoices,type OverviewTarget,type OverviewRelation,type OverviewScope,type OverviewSection,type OverviewItem,type LinkedContract,type OverviewInvoice} from './overview';
type Profile={id:string;full_name:string|null;email:string;role:string;is_active:boolean};
type Cost={id:string;supplier_relationship_id:string;supplier_invoice_number:string;invoice_date:string;description:string;status:string};
type Grant={id:string;deal_id:string;party_role:string;is_active:boolean};
export async function loadRelationshipOverview(db:SupabaseClient,target:OverviewTarget){
 const read=<T,>(table:string,columns:string,filter:(q:any)=>any,order='id')=>allRows<T>((a,b)=>filter(db.from(table).select(columns,{count:'exact'})).order(order).range(a,b));
 const byIds=async<T,>(table:string,columns:string,key:string,ids:string[],order='id')=>{const out:T[]=[];const unique=[...new Set(ids)];for(let i=0;i<unique.length;i+=100)out.push(...await read<T>(table,columns,q=>q.in(key,unique.slice(i,i+100)),order));return out;};
 const one=async<T,>(table:string,columns:string,id:string)=>{const r=await db.from(table).select(columns).eq('id',id).maybeSingle();if(r.error)throw Error('Identity unavailable');return r.data as T|null;};
 let profile:Profile|null=null,selected:OverviewRelation|null=null,relations:OverviewRelation[]=[];
 const relationFields='id,name,kind,profile_id,email,phone,address,roles';
 if(target.kind==='profile'){
  profile=await one<Profile>('profiles','id,full_name,email,role,is_active',target.id);
  if(!profile||!['client','partner'].includes(profile.role))return null;
  relations=await read<OverviewRelation>('mzs_lease_relationships',relationFields,q=>q.eq('profile_id',profile!.id));
 }else{
  selected=await one<OverviewRelation>('mzs_lease_relationships',relationFields,target.id);if(!selected)return null;
  // A person with a login has one account overview. A company's contact does not expand its financial scope.
  if(selected.kind==='person'&&selected.profile_id)return {redirect:'/admin/relationships/overview?profile='+selected.profile_id} as const;
  relations=[selected];
 }
 const scope:OverviewScope={profileId:profile?.id??null,relationshipIds:relations.map(r=>r.id)};
 const sections:OverviewSection[]=[];
 async function section<T>(id:string,load:()=>Promise<T>,items:(value:T)=>OverviewItem[]){try{const value=await load();sections.push({id,items:items(value),unavailable:false});return value;}catch{sections.push({id,items:[],unavailable:true});return undefined;}}
 const results=await Promise.all([
  section('companies',async()=>profile?read<{id:string;legal_name:string;relationship_type:string}>('mzs_member_companies','id,legal_name,relationship_type',q=>q.eq('user_id',profile!.id)):[],declared=>[
   ...relations.filter(r=>r.id!==selected?.id).map(r=>({id:'crm:'+r.id,title:r.name,detail:r.kind,href:'/admin/relationships?edit='+r.id,basis:'crm'})),
   ...declared.map(c=>({id:'declared:'+c.id,title:c.legal_name,detail:c.relationship_type,href:'/admin/relationships/'+profile!.id,basis:'declared'}))]),
  section('contracts',async()=>{const linked=await byIds<LinkedContract>('mzs_lease_contracts','id,title,tenant_profile_id,tenant_relationship_id,property_id,status,lease_start,lease_end','tenant_relationship_id',scope.relationshipIds);const direct=profile?await read<LinkedContract>('mzs_lease_contracts','id,title,tenant_profile_id,tenant_relationship_id,property_id,status,lease_start,lease_end',q=>q.eq('tenant_profile_id',profile!.id)):[];return [...new Map([...linked,...direct].filter(c=>contractInScope(c,scope)).map(c=>[c.id,c])).values()];},rows=>rows.map(c=>({id:c.id,title:c.title,detail:c.lease_start+' → '+(c.lease_end??'—'),status:c.status,href:'/admin/group/estates/contracts?contract='+c.id,basis:'contract'}))),
  section('projects',async()=>{if(!profile)return [];const grants=await read<{project_id:string;granted_at:string}>('project_access','project_id,granted_at',q=>q.eq('user_id',profile!.id),'project_id');const projects=await byIds<{id:string;title:string;status:string}>('projects','id,title,status','id',grants.map(g=>g.project_id));if(projects.length!==grants.length)throw Error('Missing project');return projects;},rows=>rows.map(p=>({id:p.id,title:p.title,detail:'',status:p.status,href:'/admin/project-access?user='+profile!.id+'&project='+p.id,basis:'grant'}))),
  section('bookings',async()=>profile?read<{id:string;check_in:string;check_out:string;status:string;project_id:string}>('rental_bookings','id,check_in,check_out,status,project_id',q=>q.eq('user_id',profile!.id).eq('is_test',false)):[],rows=>rows.map(b=>({id:b.id,title:b.check_in+' → '+b.check_out,detail:'',status:b.status,href:'/admin/bookings/'+b.id,basis:'booking',date:b.check_in}))),
  section('purchases',()=>byIds<Cost>('mzs_ops_expense_drafts','id,supplier_relationship_id,supplier_invoice_number,invoice_date,description,status','supplier_relationship_id',scope.relationshipIds),rows=>rows.map(c=>({id:c.id,title:c.supplier_invoice_number,detail:c.description,date:c.invoice_date,status:c.status,href:'/admin/workspaces/accountancy/documents/links/cost/'+c.id,basis:'supplier'}))),
  section('entity_roles',async()=>{
   const issuers=await byIds<{id:string;name:string}>('mzs_lease_issuers','id,name','relationship_id',scope.relationshipIds);
   const links=await byIds<{id:string;property_id:string;legal_entity_id:string;relationship_type:string;effective_from:string;effective_until:string|null}>('mzs_ops_property_entity_links','id,property_id,legal_entity_id,relationship_type,effective_from,effective_until','legal_entity_id',issuers.map(e=>e.id));
   const ids=[...new Set(links.map(e=>e.property_id))];const properties=await byIds<{id:string;name:string}>('mzs_estate_properties','id,name','id',ids);if(properties.length!==ids.length)throw Error('Missing entity property');return {issuers,links,properties};
  },({issuers,links,properties})=>links.map(e=>({id:e.id,title:properties.find(p=>p.id===e.property_id)!.name,detail:issuers.find(i=>i.id===e.legal_entity_id)!.name+' · '+e.relationship_type+' · '+e.effective_from+' → '+(e.effective_until??'—'),href:'/admin/group/estates/properties/'+e.property_id,basis:'entity_property'}))),
  section('capital',async()=>{if(!profile)return {grants:[] as Grant[],deals:[] as {id:string;title:string;status:string}[]};if(!capitalDealsEnabled())throw Error('Capital unavailable');const grants=await read<Grant>('mzs_capital_client_access','id,deal_id,party_role,is_active',q=>q.eq('user_id',profile!.id));const deals=await byIds<{id:string;title:string;status:string}>('mzs_capital_deals','id,title,status','id',grants.map(g=>g.deal_id));if(deals.length!==new Set(grants.map(g=>g.deal_id)).size)throw Error('Missing loan');return {grants,deals};},({grants,deals})=>grants.map(g=>({id:g.id,title:deals.find(d=>d.id===g.deal_id)!.title,detail:g.party_role,status:g.is_active?(profile?.is_active?'active':'account_inactive'):'inactive',href:'/admin/group/capital/deals/'+g.deal_id,basis:'loan'})))
 ]);
 const contracts=results[1],bookings=results[3],costs=results[4],entities=results[5],capital=results[6];
 await Promise.all([
  section('properties',async()=>{if(!contracts)throw Error('Contracts unavailable');const ids=[...new Set(contracts.map(c=>c.property_id))];const rows=await byIds<{id:string;name:string;address:string}>('mzs_estate_properties','id,name,address','id',ids);if(rows.length!==ids.length)throw Error('Missing property');return rows;},rows=>rows.map(p=>({id:p.id,title:p.name,detail:p.address,href:'/admin/group/estates/properties/'+p.id,basis:'property'}))),
  section('sales',async()=>{
   if(!contracts||!bookings)throw Error('Invoice scope unavailable');
   type Invoice={id:string;issuer_id:string;number:string;issued_on:string;gross_cents:number;total:string;contract_id:string;booking_id:string};
   const [services,external,credits,rentals,bookingInvoices,archiveLinks]=await Promise.all([
    byIds<Invoice>('mzs_service_invoices','id,issuer_id,number,issued_on,gross_cents','customer_id',scope.relationshipIds),
    byIds<Invoice>('mzs_ops_external_sales_invoices','id,issuer_id,number,issued_on,gross_cents','customer_id',scope.relationshipIds),
    byIds<Invoice>('mzs_service_credit_notes','id,issuer_id,number,issued_on,gross_cents','customer_id',scope.relationshipIds),
    byIds<Invoice>('mzs_lease_invoices','id,issuer_id,number,issued_on,total,contract_id','contract_id',contracts.map(c=>c.id)),
    byIds<Invoice>('mzs_booking_invoices','id,issuer_id,number,issued_on,total,booking_id','booking_id',bookings.map(b=>b.id)),
    byIds<{invoice_id:string}>('mzs_invoice_archive_customers','invoice_id','relationship_id',scope.relationshipIds,'invoice_id')]);
   const archives=await byIds<Invoice>('mzs_invoice_archive_active','id,issuer_id,number,issued_on,gross_cents','id',archiveLinks.map(a=>a.invoice_id));
   const root='/admin/workspaces/accountancy/sales/';
   const mapped:OverviewInvoice[]=[...services.map(i=>({...i,gross:i.gross_cents,source:'service',basis:'customer',href:root+'issued/'+i.id})),...external.map(i=>({...i,gross:i.gross_cents,source:'external',basis:'customer',href:root+'standalone/'+i.id})),...credits.map(i=>({...i,gross:-i.gross_cents,source:'credit',basis:'customer',href:root+'credits/'+i.id})),...archives.map(i=>({...i,gross:i.gross_cents,source:'archive',basis:'archive',href:root+'imported/'+i.id})),...rentals.map(i=>({...i,gross:Math.round(Number(i.total)*100),source:'rental',basis:'contract',href:'/admin/group/estates/contracts?view=billing&contract='+i.contract_id+'&invoice='+i.id})),...bookingInvoices.map(i=>({...i,gross:Math.round(Number(i.total)*100),source:'booking',basis:'booking',href:'/admin/bookings/'+i.booking_id}))];
   return overviewInvoices(mapped);
  },rows=>rows),
  section('documents',async()=>{if(!costs||!capital||!entities)throw Error('Document scope unavailable');
   const links=await byIds<{document_id:string;is_active:boolean}>('mzs_accountancy_document_links','id,document_id,is_active','draft_id',costs.map(c=>c.id));
   const ids=[...new Set(links.filter(l=>l.is_active).map(l=>l.document_id))];
   const [docs,entityDocs,loanDocs]=await Promise.all([byIds<{id:string;title:string;review_status:string}>('mzs_accountancy_documents','id,title,review_status','id',ids),byIds<{id:string;title:string;review_status:string;fiscal_year:number}>('mzs_accountancy_documents','id,title,review_status,fiscal_year','issuer_id',entities.issuers.map(e=>e.id)),byIds<{id:string;deal_id:string;title:string;document_status:string}>('mzs_capital_documents','id,deal_id,title,document_status','deal_id',capital.deals.map(d=>d.id))]);
   if(docs.length!==ids.length)throw Error('Missing document');
   const entityDocIds=new Set(entityDocs.map(d=>d.id));const uniqueDocs=[...new Map([...docs,...entityDocs].map(d=>[d.id,d])).values()];
   return [...uniqueDocs.filter(d=>d.review_status!=='superseded').map(d=>({id:'accountancy:'+d.id,title:d.title,detail:'',status:d.review_status,href:'/admin/workspaces/accountancy/documents/'+d.id,basis:entityDocIds.has(d.id)?'entity_document':'document'})),...loanDocs.map(d=>({id:'capital:'+d.id,title:d.title,detail:capital.deals.find(x=>x.id===d.deal_id)!.title,status:d.document_status,href:'/admin/group/capital/deals/'+d.deal_id+'#documents',basis:'capital_document'}))];
  },rows=>rows)
 ]);
 const order=['companies','contracts','properties','entity_roles','projects','bookings','sales','purchases','capital','documents'];
 sections.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
 return {profile,selected,sections,name:selected?.name||profile?.full_name||profile?.email||'',email:selected?.email||profile?.email||'',scope};
}
