export type UnitContract={id:string;title:string;status:string;tenant_name:string;unit_ids:string[];lease_start:string;lease_end:string|null;lines:{amount:string}[]};
export function currentUnitContracts(contracts:UnitContract[],unitId:string,today:string){return contracts.filter(c=>c.status==='active'&&c.unit_ids.includes(unitId)&&c.lease_start<=today&&(!c.lease_end||c.lease_end>=today));}
export function contractNet(c:UnitContract){return c.lines.reduce((sum,l)=>sum+Math.round(Number(l.amount)*100),0)/100;}
