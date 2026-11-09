import type {InvoiceRow} from '../finance/invoice-register';
import type {CrmActivity} from '../relationships/crm-activities';
import type {PurchaseReviewItem} from '../accountancy/purchase-review';
import type {MonthCloseReadiness} from '../accountancy/month-close-readiness';

export const actionCategories=['invoices','purchases','crm','operations','requests','system'] as const;
export type ActionCategory=typeof actionCategories[number];
export const actionPriorities=['overdue','today','review','upcoming'] as const;
export type ActionPriority=typeof actionPriorities[number];
export type DailyAction={
 id:string;category:ActionCategory;priority:ActionPriority;title:string;detail:string;
 href:string;dueOn:string|null;entity?:string;amountCents?:number;
 count:number;kind:'record'|'queue';issues?:string[];
};
export type ActionFailure={source:string;category:ActionCategory|'month'};
export type MonthlyActionReview={id:string;entity:string;href:string;report:MonthCloseReadiness|null};
export type ActionSnapshot={today:string;items:DailyAction[];failures:ActionFailure[];months:MonthlyActionReview[]};
export type ActionFilters={category:ActionCategory|'all';priority:ActionPriority|'attention'|'all';q:string;page:number};
export const actionRoot='/admin/workspaces/group';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function verifiedDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw Error('Invalid action date');
 return value;
}
export function duePriority(due:string|null,today:string):ActionPriority{
 verifiedDate(today);if(!due)return 'review';verifiedDate(due);
 return due<today?'overdue':due===today?'today':'upcoming';
}
export function checkedActions(items:DailyAction[]){
 const seen=new Set<string>();
 for(const item of items){
  if(!item.id||seen.has(item.id)||!item.title||!actionCategories.includes(item.category)||!actionPriorities.includes(item.priority)||
   !item.href.startsWith('/admin/')||item.href.includes('\\')||/[\x00-\x1f]/.test(item.href)||
   !Number.isSafeInteger(item.count)||item.count<1||
   (item.amountCents!==undefined&&(!Number.isSafeInteger(item.amountCents)||item.amountCents<0)))throw Error('Unverified action source');
  if(item.dueOn)verifiedDate(item.dueOn);
  seen.add(item.id);
 }
 return items;
}
export function invoiceActions(rows:readonly InvoiceRow[],today:string):DailyAction[]{
 const seen=new Set<string>(),items:DailyAction[]=[];
 for(const row of rows){
  const key=row.source+':'+row.id;
  if(seen.has(key)||!Number.isSafeInteger(row.gross)||(row.balance!==null&&!Number.isSafeInteger(row.balance)))throw Error('Invalid invoice action source');
  seen.add(key);
  if(row.gross<=0||row.balance!==null&&row.balance<=0)continue;
  const unknown=row.balance===null;
  items.push({id:'invoice:'+key,category:'invoices',priority:unknown?'review':duePriority(row.dueOn,today),
   title:row.number,detail:row.customer,entity:row.issuer,href:row.href,dueOn:row.dueOn,
   amountCents:unknown?undefined:row.balance!,count:1,kind:'record',
   issues:[unknown?'payment_unknown':'recorded_balance',...(row.source==='archive'?['imported_balance']:[])]});
 }
 return checkedActions(items);
}
export function crmActions(rows:readonly CrmActivity[],names:ReadonlyMap<string,string>,today:string):DailyAction[]{
 return checkedActions(rows.filter(r=>r.kind==='task'&&r.status==='open').map(row=>{
  if(!uuid.test(row.id)||!uuid.test(row.relationship_id)||!names.has(row.relationship_id))throw Error('Unverified CRM relationship');
  return {id:'crm:'+row.id,category:'crm',priority:duePriority(row.due_on,today),title:row.title,
   detail:names.get(row.relationship_id)!,href:'/admin/relationships/activities?relationship='+row.relationship_id+'&scope=active&activity='+row.id+'#activity-'+row.id,
   dueOn:row.due_on,count:1,kind:'record'};
 }));
}
export function purchaseActions(rows:readonly PurchaseReviewItem[],yearId:string,entity:string):DailyAction[]{
 if(!uuid.test(yearId))throw Error('Invalid administration');
 return checkedActions(rows.map(row=>({id:'purchase:'+yearId+':'+row.id,category:'purchases',priority:'review',
  title:row.label,detail:'',entity,href:row.href,dueOn:null,count:1,kind:'record',issues:row.issues})));
}
export function actionFilters(q:Record<string,string|string[]|undefined>):ActionFilters{
 const one=(key:string,fallback:string)=>{if(q[key]===undefined)return fallback;if(typeof q[key]!=='string')throw Error('Invalid action filters');return q[key] as string;};
 const category=one('actionCategory','all'),priority=one('actionPriority','attention'),search=one('actionSearch','').trim(),page=one('actionPage','1');
 if(category!=='all'&&!actionCategories.includes(category as ActionCategory)||!['all','attention',...actionPriorities].includes(priority)||search.length>100||!/^\d{1,6}$/.test(page)||Number(page)<1)throw Error('Invalid action filters');
 return {category:category as ActionFilters['category'],priority:priority as ActionFilters['priority'],q:search,page:Number(page)};
}
export function actionHref(filters:ActionFilters,page=1){
 const q=new URLSearchParams({view:'actions'});
 if(filters.category!=='all')q.set('actionCategory',filters.category);
 if(filters.priority!=='attention')q.set('actionPriority',filters.priority);
 if(filters.q)q.set('actionSearch',filters.q);
 if(page>1)q.set('actionPage',String(page));
 return actionRoot+'?'+q.toString()+'#daily-actions';
}
export function selectActions(snapshot:ActionSnapshot,filters:ActionFilters,locale='en-GB'){
 const order=new Intl.Collator(locale,{sensitivity:'base',numeric:true}),search=filters.q.toLocaleLowerCase(locale);
 const rows=snapshot.items.filter(i=>(filters.category==='all'||i.category===filters.category)&&
  (filters.priority==='all'||filters.priority==='attention'&&i.priority!=='upcoming'||i.priority===filters.priority)&&
  (!search||[i.title,i.detail,i.entity??''].join(' ').toLocaleLowerCase(locale).includes(search)))
  .sort((a,b)=>actionPriorities.indexOf(a.priority)-actionPriorities.indexOf(b.priority)||
   (a.dueOn??'9999').localeCompare(b.dueOn??'9999')||order.compare(a.title,b.title)||a.id.localeCompare(b.id));
 const pages=Math.max(1,Math.ceil(rows.length/25)),page=Math.min(filters.page,pages);
 const counts=actionCategories.map(category=>({category,
  count:snapshot.failures.some(f=>f.category===category)?null:snapshot.items.filter(i=>i.category===category&&i.priority!=='upcoming').reduce((n,i)=>n+i.count,0)}));
 return {rows:rows.slice((page-1)*25,page*25),total:rows.length,page,pages,counts};
}
