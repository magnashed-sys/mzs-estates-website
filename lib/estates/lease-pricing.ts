export type PricingBasis = 'unclassified' | 'all_in' | 'separate';
export type LineRole = 'rent' | 'advance' | 'other' | 'all_in';
export type PricingLine = {description:string;amount:string;vat:string};
export type LeasePricing = {id:string;version:number;status:string;lines:PricingLine[];pricing_basis:PricingBasis;line_roles:LineRole[];indexation_review_on:string|null;indexation_clause:string};
export type Adjustment = {id:string;contract_id:string;revision:number;kind:'indexation'|'advance';effective_on:string;status:'proposed'|'approved'|'cancelled';base_lines:PricingLine[];new_lines:PricingLine[];calculation:Record<string,string|number|null>;evidence:string;approved_at:string|null;created_at:string};

/** A pricing classification never changes the original amounts. */
export function validPricing(basis:PricingBasis,roles:LineRole[],lineCount:number):boolean {
 if(basis==='unclassified')return roles.length===0;
 return roles.length===lineCount && roles.every(r=>basis==='all_in'?r==='all_in':['rent','advance','other'].includes(r)) && (basis==='all_in'||roles.includes('rent'));
}
export function effectiveLeaseLines(contract:{lines:PricingLine[]},adjustments:Adjustment[],date:string):PricingLine[]{
 return [...adjustments].filter(a=>a.status==='approved'&&a.effective_on<=date).sort((a,b)=>b.effective_on.localeCompare(a.effective_on)||b.revision-a.revision)[0]?.new_lines??contract.lines;
}
export function monthlyCents(lines:PricingLine[]):number {
 return lines.reduce((n,l)=>n+Math.round(Number(l.amount)*100),0);
}
export function nextIndexationReview(contract:Pick<LeasePricing,'indexation_review_on'>,adjustments:Adjustment[]):string|null {
 const latest=[...adjustments].filter(a=>a.status==='approved'&&a.kind==='indexation').sort((a,b)=>b.effective_on.localeCompare(a.effective_on))[0];
 if(!latest)return contract.indexation_review_on;
 return `${Number(latest.effective_on.slice(0,4))+1}${latest.effective_on.slice(4)}`;
}
