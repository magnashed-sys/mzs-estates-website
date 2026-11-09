import {effectiveLeaseLines, type Adjustment, type PricingLine} from './lease-pricing';

export type RentSnapshotContract = {
  id:string;
  status:string;
  lease_start:string;
  lease_end:string|null;
  pricing_basis:string|null;
  lines:PricingLine[] | null;
};

/**
 * Present recurring contract value, not collected cash, rent excluding separate
 * service advances, or a forecast for the next twelve calendar months.
 * Values are net of VAT. Unclassified contract lines are included as
 * contracted monthly charges, and the UI explicitly discloses that caveat.
 * No split across units: a multi-unit contract is counted exactly once.
 */
export function activeLeaseValue(
  contracts:RentSnapshotContract[],
  adjustments:Adjustment[],
  today:string,
):{monthlyCents:number; annualizedCents:number; activeContracts:number; unclassifiedContracts:number; complete:boolean}{
  let monthlyCents=0, activeContracts=0, unclassifiedContracts=0, complete=true;
  const seen=new Set<string>();
  const adjustmentsByContract=new Map<string,Adjustment[]>();
  for(const adjustment of adjustments){
    if(adjustment.status!=='approved')continue;
    const list=adjustmentsByContract.get(adjustment.contract_id)??[];
    list.push(adjustment);adjustmentsByContract.set(adjustment.contract_id,list);
  }
  for(const contract of contracts){
    if(contract.status!=='active'||contract.lease_start>today||
       (contract.lease_end&&contract.lease_end<today))continue;
    activeContracts++;
    if(!contract.id||seen.has(contract.id)||!contract.lease_start||
       !/^\d{4}-\d{2}-\d{2}$/.test(contract.lease_start)||
       (contract.lease_end!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(contract.lease_end))){
      complete=false;continue;
    }
    seen.add(contract.id);
    if(contract.pricing_basis!=='all_in'&&contract.pricing_basis!=='separate')unclassifiedContracts++;
    const lines=effectiveLeaseLines(
      {lines:contract.lines??[]},adjustmentsByContract.get(contract.id)??[],today
    );
    if(!Array.isArray(lines)||lines.length===0){complete=false;continue;}
    let amount=0,invalid=false;
    for(const line of lines){
      const raw=line?.amount;
      if(typeof raw!=='string'||!/^\d{1,10}(?:\.\d{1,2})?$/.test(raw)){
        invalid=true;break;
      }
      const cents=Math.round(Number(raw)*100);
      if(!Number.isSafeInteger(cents)||!Number.isSafeInteger(amount+cents)){invalid=true;break;}
      amount+=cents;
    }
    if(invalid||!Number.isSafeInteger(monthlyCents+amount)){
      complete=false;continue;
    }
    monthlyCents+=amount;
  }
  const annualizedCents=monthlyCents*12;
  if(!Number.isSafeInteger(annualizedCents))complete=false;
  return {monthlyCents,annualizedCents,activeContracts,unclassifiedContracts,complete};
}
