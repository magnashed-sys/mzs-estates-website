/**
 * Property Operations in the Financial Cockpit.
 * Intentionally separate APPROVED SUPPLIER COSTS (invoice-date accrual)
 * from confirmed cashflows, loan interest, rental forecasts and booking quotes.
 * Never silently equate a cost invoice with an actual supplier payment.
 */
export type OpsDraft={
 id:string;property_id:string;legal_entity_id:string;
 invoice_date:string;net_cents:number|string;vat_cents:number|string;
 gross_cents:number|string;category:string;
};
export type OpsEvidence={id:string;draft_id:string;sha256:string};
export type OpsReview={id:string;draft_id:string;sequence_no:number;action:string};
export type OpsCorrection={id:string;draft_id:string};
export type OpsDecision={id:string;correction_id:string;decision:string};
export type OpsReplacement={id:string;correction_id:string;replacement_draft_id:string};
export type OpsCostSummary={
 year:number;entityId:string;
 approved:{netCents:number;vatCents:number;grossCents:number;count:number};
 pending:{count:number;grossCents:number};
 attention:{count:number;grossCents:number};
 months:{month:string;approvedNetCents:number;approvedVatCents:number;approvedGrossCents:number;approvedCount:number}[];
 properties:{propertyId:string;approvedGrossCents:number;count:number}[];
 categories:{category:string;approvedGrossCents:number;count:number}[];
 completeness:"verified-registers";cashPaidKnown:false;
};
const max=100000000000;
const cents=(v:number|string)=>{
 if((typeof v!=="number"&&typeof v!=="string")||!/^\d{1,12}$/.test(String(v)))throw Error("Invalid cost cents");
 const n=Number(v);
 if(!Number.isSafeInteger(n)||n<0||n>max)throw Error("Cost cents overflow");
 return n;
};
function sum(a:number,b:number){
 const n=a+b;if(!Number.isSafeInteger(n)||n>max)throw Error("Cost sum overflow");return n;
}
function mapUnique<T extends {id:string}>(rows:readonly T[],label:string){
 const m=new Map<string,T>();
 for(const row of rows){
  if(!row.id||m.has(row.id))throw Error("Duplicate "+label);
  m.set(row.id,row);
 }
 return m;
}
export function buildOpsCostSummary(input:{
 year:number;entityId:string;
 drafts:readonly OpsDraft[];documents:readonly OpsEvidence[];
 reviews:readonly OpsReview[];corrections:readonly OpsCorrection[];
 decisions:readonly OpsDecision[];replacements:readonly OpsReplacement[];
}):OpsCostSummary{
 const {year,entityId,drafts,documents,reviews,corrections,decisions,replacements}=input;
 if(!Number.isInteger(year)||year<2020||year>2100||
   !(entityId==="all"||entityId==="unassigned"||/^[0-9a-f-]{36}$/i.test(entityId)))
  throw Error("Invalid financial scope");
 const draftMap=mapUnique(drafts,"cost draft");
 const docMap=mapUnique(documents,"source document");
 const correctionMap=mapUnique(corrections,"correction");
 const decisionMap=mapUnique(decisions,"correction decision");
 mapUnique(replacements,"replacement");
 const documentByDraft=new Map<string,OpsEvidence>();
 for(const d of documents){
  if(!draftMap.has(d.draft_id)||documentByDraft.has(d.draft_id)||
    !/^[a-f0-9]{64}$/.test(d.sha256))throw Error("Unexpected or duplicate cost evidence");
  documentByDraft.set(d.draft_id,d);
 }
 const latest=new Map<string,OpsReview>(),reviewKeys=new Set<string>();
 for(const r of reviews){
  if(!draftMap.has(r.draft_id)||!Number.isSafeInteger(r.sequence_no)||r.sequence_no<=0||
     !["submitted","approved","rejected"].includes(r.action)||
     reviewKeys.has(r.draft_id+"|"+r.sequence_no))throw Error("Invalid or duplicate review");
  reviewKeys.add(r.draft_id+"|"+r.sequence_no);
  const prior=latest.get(r.draft_id);
  if(!prior||prior.sequence_no<r.sequence_no)latest.set(r.draft_id,r);
 }
 const correctionByDraft=new Map<string,OpsCorrection>();
 for(const c of corrections){
  if(!draftMap.has(c.draft_id)||correctionByDraft.has(c.draft_id))throw Error("Unexpected cost correction");
  correctionByDraft.set(c.draft_id,c);
 }
 const decisionsByCorrection=new Map<string,string>();
 for(const d of decisions){
  if(!correctionMap.has(d.correction_id)||decisionsByCorrection.has(d.correction_id)||
    !["declined","replacement_required"].includes(d.decision))
   throw Error("Invalid correction decision");
  decisionsByCorrection.set(d.correction_id,d.decision);
 }
 const replacementSources=new Set<string>(),replacementDrafts=new Set<string>();
 for(const r of replacements){
  const c=correctionMap.get(r.correction_id);
  if(!c||decisionsByCorrection.get(c.id)!=="replacement_required"||
    !draftMap.has(r.replacement_draft_id)||
    replacementSources.has(c.draft_id)||replacementDrafts.has(r.replacement_draft_id)||
    c.draft_id===r.replacement_draft_id)throw Error("Invalid replacement lineage");
  const original=draftMap.get(c.draft_id)!,newDraft=draftMap.get(r.replacement_draft_id)!;
  if(original.property_id!==newDraft.property_id||
     original.legal_entity_id!==newDraft.legal_entity_id||
     latest.get(newDraft.id)?.action!=="approved"||!documentByDraft.has(newDraft.id))
   throw Error("Unverified replacement");
  replacementSources.add(c.draft_id);replacementDrafts.add(r.replacement_draft_id);
 }
 const months=Array.from({length:12},(_,i)=>({
  month:year+"-"+String(i+1).padStart(2,"0"),
  approvedNetCents:0,approvedVatCents:0,approvedGrossCents:0,approvedCount:0
 }));
 const props=new Map<string,{propertyId:string;approvedGrossCents:number;count:number}>();
 const categories=new Map<string,{category:string;approvedGrossCents:number;count:number}>();
 const approved={netCents:0,vatCents:0,grossCents:0,count:0};
 const pending={count:0,grossCents:0},attention={count:0,grossCents:0};
 for(const d of drafts){
  if(!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(d.invoice_date)||
    Number.isNaN(Date.parse(d.invoice_date+"T00:00:00Z"))||
    new Date(d.invoice_date+"T00:00:00Z").toISOString().slice(0,10)!==d.invoice_date)
   throw Error("Invalid cost invoice date");
  const net=cents(d.net_cents),vat=cents(d.vat_cents),gross=cents(d.gross_cents);
  if(sum(net,vat)!==gross||gross===0||!d.property_id||!d.legal_entity_id||!d.category)
   throw Error("Invalid cost invoice source");
  if(Number(d.invoice_date.slice(0,4))!==year||
    (entityId!=="all"&&entityId!==d.legal_entity_id))continue;
  const review=latest.get(d.id)?.action??"draft";
  const correction=correctionByDraft.get(d.id);
  const decision=correction?decisionsByCorrection.get(correction.id):undefined;
  const excluded=!!correction&&decision!=="declined";
  const isApproved=review==="approved"&&!excluded;
  if(isApproved){
   if(!documentByDraft.has(d.id))throw Error("Approved cost lacks original document");
   const m=months[Number(d.invoice_date.slice(5,7))-1];
   m.approvedNetCents=sum(m.approvedNetCents,net);
   m.approvedVatCents=sum(m.approvedVatCents,vat);
   m.approvedGrossCents=sum(m.approvedGrossCents,gross);
   m.approvedCount++;
   approved.netCents=sum(approved.netCents,net);
   approved.vatCents=sum(approved.vatCents,vat);
   approved.grossCents=sum(approved.grossCents,gross);
   approved.count++;
   const p=props.get(d.property_id)??{propertyId:d.property_id,approvedGrossCents:0,count:0};
   p.approvedGrossCents=sum(p.approvedGrossCents,gross);p.count++;props.set(d.property_id,p);
   const c=categories.get(d.category)??{category:d.category,approvedGrossCents:0,count:0};
   c.approvedGrossCents=sum(c.approvedGrossCents,gross);c.count++;categories.set(d.category,c);
  }else if(review==="draft"||review==="submitted"){
   pending.count++;pending.grossCents=sum(pending.grossCents,gross);
  }else{
   attention.count++;attention.grossCents=sum(attention.grossCents,gross);
  }
 }
 return {year,entityId,approved,pending,attention,months,properties:[...props.values()].sort((a,b)=>
  b.approvedGrossCents-a.approvedGrossCents||a.propertyId.localeCompare(b.propertyId)),
  categories:[...categories.values()].sort((a,b)=>b.approvedGrossCents-a.approvedGrossCents||
   a.category.localeCompare(b.category)),completeness:"verified-registers",cashPaidKnown:false};
}
