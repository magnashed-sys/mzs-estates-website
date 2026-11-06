import type {AdminTranslator} from '../../../../../lib/admin/translation';
import {effectiveLeaseLines, type Adjustment} from '../../../../../lib/estates/lease-pricing';
import {contractNet,unitAllocation,type UnitContract} from '../../../../../lib/estates/unit-contracts';
import {euros} from '../../../../../lib/estates/rent';
import s from '../properties/estates.module.css';

export default function ContractAmounts({contract,unitId,adjustments,today,t,locale,compact=false}:{
 contract:UnitContract;unitId:string;adjustments:Adjustment[];today:string;t:AdminTranslator;locale:string;compact?:boolean;
}){
 const date=contract.first_period&&contract.first_period>today?contract.first_period:today;
 const lines=effectiveLeaseLines({lines:contract.lines.map(l=>({...l,description:l.description||'',vat:l.vat||'0'}))},
  adjustments.filter(a=>a.contract_id===contract.id),date);
 const priced={...contract,lines};
 const allocated=unitAllocation(priced,unitId);
 if(!allocated)return <p>{euros(contractNet(priced),locale)} {t('net / month')}
  {contract.unit_ids.length>1?t(' · entire multi-unit agreement'):''}</p>;
 const rows:[string,number][]=[
  [contract.pricing_basis==='all_in'?'Monthly all-in price for this unit':'Monthly rent for this unit',
   contract.pricing_basis==='all_in'?allocated.all_in:allocated.rent],
  ...(contract.pricing_basis==='separate'?[['Monthly utilities advance for this unit',allocated.advance] as [string,number]]:[]),
  ...(allocated.other?[['Other charges for this unit',allocated.other] as [string,number]]:[]),
  ['VAT for this unit',allocated.tax],
  ['Monthly total for this unit',allocated.total]
 ];
 const starts=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(contract.first_period!+'T00:00:00Z'));
 return <div>
  <p><strong>{t('Per-unit allocation')}</strong> · {t('Allocation from {p0}',{p0:starts})}</p>
  <dl className={s.ownershipFacts}>{rows.map(([label,cents])=><div key={label}><dt>{t(label)}</dt><dd>{euros(cents/100,locale)}</dd></div>)}</dl>
  {!compact&&<p className={s.note}>{t('One invoice for the full agreement.')}</p>}
 </div>;
}
