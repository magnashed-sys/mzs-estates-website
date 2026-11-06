import type {LineRole, PricingBasis, PricingLine} from './lease-pricing';
export type UnitContract={id:string;title:string;status:string;tenant_name:string;unit_ids:string[];lease_start:string;lease_end:string|null;first_period?:string;pricing_basis?:PricingBasis;line_roles?:LineRole[];lines:({amount:string}&Partial<PricingLine>)[]};
export function currentUnitContracts(contracts:UnitContract[],unitId:string,today:string){return contracts.filter(c=>c.status==='active'&&c.unit_ids.includes(unitId)&&c.lease_start<=today&&(!c.lease_end||c.lease_end>=today));}
export function contractNet(c:UnitContract){return c.lines.reduce((sum,l)=>sum+Math.round(Number(l.amount)*100),0)/100;}

export type UnitAllocation={rent:number;advance:number;other:number;all_in:number;net:number;tax:number;total:number};
/** Explicit complete line assignments only; never infer an equal split from unit count.
 * Amounts stay in cents and VAT follows the invoice generator's per-line rounding.
 */
export function unitAllocation(c:UnitContract,unitId:string):UnitAllocation|null {
 if(!c.unit_ids.includes(unitId)||!c.lines.length||!c.first_period||
    !['separate','all_in'].includes(c.pricing_basis||'')||c.line_roles?.length!==c.lines.length)return null;
 const seen=new Set<string>();
 const result:UnitAllocation={rent:0,advance:0,other:0,all_in:0,net:0,tax:0,total:0};
 for(let i=0;i<c.lines.length;i++){
  const line=c.lines[i],role=c.line_roles[i];
  if(!line.unit_id||!c.unit_ids.includes(line.unit_id)||
     !/^\d{1,10}(\.\d{1,2})?$/.test(line.amount)||
     !['exempt','0','9','21'].includes(line.vat||'')||
     !(c.pricing_basis==='all_in'?role==='all_in':['rent','advance','other'].includes(role)))return null;
  seen.add(line.unit_id);
  if(line.unit_id!==unitId)continue;
  const cents=Math.round(Number(line.amount)*100);
  result[role]+=cents;
  result.net+=cents;
  result.tax+=Math.round(cents*(line.vat==='exempt'?0:Number(line.vat))/100);
 }
 if(c.unit_ids.some(id=>!seen.has(id)))return null;
 result.total=result.net+result.tax;
 return result;
}
