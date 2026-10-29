/** Advisory-only checks of existing supplier master data. Never create, merge or alter Relationships. */
export type SupplierIdentity={
 id:string;name:string;kind:string;
 company_details?:unknown;
};
export type SupplierCostReference={id:string;supplier_relationship_id:string};
export type SupplierSimilarity='same_tax_id'|'same_name';
export type SupplierIdentityMatch={id:string;name:string;reason:SupplierSimilarity};
export type SupplierCostSignal={
 draft_id:string;supplier_id:string;supplier_name:string;
 missing_record:boolean;missing_company_tax_id:boolean;
 possible_duplicate_records:SupplierIdentityMatch[];
};
const normalizedName=(value:string)=>value.normalize('NFKC').trim()
 .toLocaleLowerCase('en').replace(/[\p{P}\p{S}]/gu,' ').replace(/\s+/g,' ');
const normalizedTax=(raw:unknown)=>{
 if(typeof raw!=='string')return '';
 const result=raw.normalize('NFKC').toLocaleUpperCase('en').replace(/[^A-Z0-9]/g,'');
 // Prevent short placeholders such as 'N/A' or 1-4 character labels from matching.
 return result.length>=5&&result.length<=32?result:'';
};
function taxId(value:SupplierIdentity){
 if(value.kind!=='company'||!value.company_details||
  typeof value.company_details!=='object'||Array.isArray(value.company_details))return '';
 return normalizedTax((value.company_details as Record<string,unknown>).tax_id);
}
/** Only exact normalized names or verified tax-ID equality are candidates.
 * Distinct non-empty tax IDs override same-name appearance: never conflate them.
 */
export function supplierCostIntegrity(costs:readonly SupplierCostReference[],suppliers:readonly SupplierIdentity[]){
 const byId=new Map(suppliers.map(s=>[s.id,s]));
 const used=new Set(costs.map(c=>c.supplier_relationship_id));
 const signals:SupplierCostSignal[]=costs.map(c=>{
  const supplier=byId.get(c.supplier_relationship_id);
  if(!supplier)return {
   draft_id:c.id,supplier_id:c.supplier_relationship_id,supplier_name:'',
   missing_record:true,missing_company_tax_id:false,possible_duplicate_records:[]
  };
  const tax=taxId(supplier),name=normalizedName(supplier.name);
  const dup:SupplierIdentityMatch[]=[];
  if(supplier.kind==='company'){
   for(const other of suppliers){
    if(other.id===supplier.id||other.kind!=='company')continue;
    const otherTax=taxId(other),otherName=normalizedName(other.name);
    const sameTax=!!tax&&tax===otherTax;
    const sameName=!!name&&name===otherName&&(!tax||!otherTax||tax===otherTax);
    if(sameTax||sameName)dup.push({
     id:other.id,name:other.name,reason:sameTax?'same_tax_id':'same_name'
    });
   }
  }
  dup.sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  return {
   draft_id:c.id,supplier_id:supplier.id,supplier_name:supplier.name,
   missing_record:false,missing_company_tax_id:supplier.kind==='company'&&!tax,
   possible_duplicate_records:dup
  };
 });
 // Count suppliers (rather than invoice lines) to avoid overstating identity conflicts.
 const usedSignals=new Map(signals.filter(s=>used.has(s.supplier_id)).map(s=>[s.supplier_id,s]));
 return {
  signals,
  supplierCount:usedSignals.size,
  missingTaxIdSuppliers:[...usedSignals.values()].filter(s=>s.missing_company_tax_id).length,
  possibleDuplicateSuppliers:[...usedSignals.values()].filter(s=>s.possible_duplicate_records.length>0).length,
  missingRecords:[...usedSignals.values()].filter(s=>s.missing_record).length
 };
}
