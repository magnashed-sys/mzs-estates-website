import type {CompletenessItem} from './completeness';

export type PurchaseReviewGroup='originals'|'duplicates'|'suppliers'|'review';
export type PurchaseReviewItem=CompletenessItem&{category:PurchaseReviewGroup};

/** Source-backed, read-only prioritization. Original invoice concepts are never
 * approved or changed here; the source dossier owns all follow-up actions. */
export function purchaseReviewItems(items:readonly CompletenessItem[]):PurchaseReviewItem[]{
 const priority:Record<PurchaseReviewGroup,number>={originals:0,duplicates:1,suppliers:2,review:3};
 return items.filter(i=>i.id.startsWith('cost:')||i.id.startsWith('supplier:')).map(i=>{
  const category:PurchaseReviewGroup=i.issues.includes('missing_original')?'originals':
    i.issues.includes('possible_double_entry')||i.issues.includes('supplier_duplicate_check')?'duplicates':
    i.id.startsWith('supplier:')||i.issues.includes('supplier_unavailable')?'suppliers':'review';
  return {...i,category};
 }).sort((a,b)=>priority[a.category]-priority[b.category]||a.label.localeCompare(b.label)||a.id.localeCompare(b.id));
}
export function purchaseReviewCounts(items:readonly PurchaseReviewItem[]){
 return {total:items.length,originals:items.filter(i=>i.category==='originals').length,
  duplicates:items.filter(i=>i.category==='duplicates').length,
  suppliers:items.filter(i=>i.category==='suppliers').length,
  review:items.filter(i=>i.category==='review').length};
}
