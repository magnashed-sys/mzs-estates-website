/**
 * Temporary in-browser weekly cost reconciliation.
 * CSV bytes stay on the user's device; no network or persistent storage.
 * Real visits are NOT reconstructed from amounts and "estimated billing hours".
 */
export type ImportedWeeklyCost = {
  reference: string;
  year: number;
  week: number;
  from: string;
  until: string;
  originalLocation: string;
  location: string;
  category: string;
  description: string;
  costCents: number;
  recharge: 'Ja' | 'Nee' | 'Te beoordelen';
  sourceReference: string;
  check: string;
  estimateHours: number | null;
  rechargeCents: number | null;
  billingReference: string;
};

const headers = [
  'referentie','jaar','week','van','tot','locatie','soort','omschrijving',
  'kosten_eur','doorfactureren','bronbericht','controle',
  'uren_schatting','doorbelasting_eur','factuur_referentie',
] as const;

function csvRecords(source: string): string[][] {
  if (typeof source !== 'string' || source.length > 1500000) {
    throw new Error("CSV is too large for a local trial import.");
  }
  const text = source.replace(/^\uFEFF/,'');
  const result: string[][] = [];
  let cols: string[] = [];
  let value = '';
  let inside = false;
  for(let i=0;i<text.length;i++) {
    const char=text[i];
    if(char === '"') {
      if(inside && text[i+1] === '"'){value+='"';i++;}
      else if(!inside && value.length===0){inside=true;}
      else if(inside){inside=false;}
      else throw new Error("Invalid quotation marks in CSV.");
    }else if(!inside && char===';'){cols.push(value);value='';}
    else if(!inside && (char==='\n'||char==='\r')){
      if(char==='\r' && text[i+1]==='\n') i++;
      cols.push(value);value='';
      if(cols.some(v=>v.length>0)) result.push(cols);
      cols=[];
      if(result.length>5001)throw new Error("Maximum 5000 rows per import.");
    }else{value+=char;if(value.length>2000)throw new Error('CSV field too long.');}
  }
  if(inside)throw new Error("Unterminated CSV field.");
  cols.push(value);
  if(cols.some(v=>v.length>0))result.push(cols);
  if(result.length>5001)throw new Error("Maximum 5000 rows per import.");
  return result;
}

function asCents(value:string, required:boolean):number|null {
  const v=value.trim();
  if(!v && !required)return null;
  if(!/^\d{1,10}(?:[,.]\d{1,2})?$/.test(v))throw new Error("Invalid amount: "+v.slice(0,30));
  const [a,b='']=v.replace(',','.').split('.');
  const cents=Number(a)*100+Number(b.padEnd(2,'0'));
  if(!Number.isSafeInteger(cents) || cents>100000000000)throw new Error("Amount out of range.");
  return cents;
}

function validDate(s:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const date=new Date(s+'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10)===s;
}

export function normalizedCostLocation(original:string):string {
  const value=original.trim();
  if(/^(?:zorg|zorgbalans|prettig thuis|prettighuis)(?:\s*[/+]\s*(?:zorgbalans|prettig thuis|prettighuis))?$/i.test(value)) {
    return 'Zorgbalans';
  }
  return value;
}

/** Reject incomplete imports rather than showing credible-looking partial totals. */
export function parseWeeklyCostsCsv(source:string):ImportedWeeklyCost[] {
  const records=csvRecords(source);
  if(records.length<2)throw new Error("No expense rows found.");
  if(records[0].length!==headers.length || headers.some((h,i)=>records[0][i]?.trim()!==h)) {
    throw new Error("The CSV columns do not match the trial import format.");
  }
  const seen=new Set<string>();
  const data:ImportedWeeklyCost[]=[];
  for(let i=1;i<records.length;i++){
    const c=records[i];
    if(c.length!==headers.length)throw new Error("Row "+(i+1)+": incorrect number of fields.");
    const [reference,y,w,from,until,originalLocation,category,description,cost,recharge,sourceRef,check,hours,charged,billingRef]=c.map(x=>x.trim());
    const year=Number(y),week=Number(w);
    if(!/^[A-Za-z0-9_-]{3,60}$/.test(reference)||seen.has(reference))throw new Error("Duplicate or invalid row reference on row "+(i+1)+'.');
    seen.add(reference);
    if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(week)||week<1||week>53||
      !validDate(from)||!validDate(until)||until<from||Number(from.slice(0,4))!==year) {
      throw new Error("Check the year, week and period on row "+(i+1)+'.');
    }
    if(!originalLocation||originalLocation.length>180||!category||category.length>140||
      !description||description.length>500||sourceRef.length>150||check.length>500) {
      throw new Error("Location or description missing on row "+(i+1)+'.');
    }
    if(!['Ja','Nee','Te beoordelen'].includes(recharge))throw new Error("Invalid invoice status on row "+(i+1)+'.');
    const costCents=asCents(cost,true)!;
    const rechargeCents=asCents(charged,false);
    const estimateHours=hours ? Number(hours.replace(',','.')) : null;
    if(estimateHours!==null && (!Number.isInteger(estimateHours)||estimateHours<1||estimateHours>100)) {
      throw new Error("Invalid estimated billable hours on row "+(i+1)+'.');
    }
    if((rechargeCents===null)!==(estimateHours===null) ||
      (rechargeCents!==null && (recharge!=='Ja'||!billingRef||billingRef.length>120))) {
      throw new Error("Inconsistent recharge data on row "+(i+1)+'.');
    }
    if(rechargeCents===null && billingRef)throw new Error("Invoice reference without recharge on row "+(i+1)+'.');
    data.push({reference,year,week,from,until,originalLocation,
      location:normalizedCostLocation(originalLocation),category,description,costCents,
      recharge:recharge as ImportedWeeklyCost['recharge'],sourceReference:sourceRef,
      check,estimateHours,rechargeCents,billingReference:billingRef});
  }
  return data;
}

export function summarizeWeeklyCosts(rows:readonly ImportedWeeklyCost[]) {
  if(!rows.length)throw new Error("No source rows.");
  const groups=new Map<string,{location:string;count:number;costCents:number;rechargeCount:number;rechargeCents:number;reviewCount:number}>();
  let totalCostCents=0,pricedRechargeCents=0,rechargeCount=0,reviewCount=0,confirmedNoCount=0,estimatedBillableHours=0;
  for(const r of rows){
    totalCostCents+=r.costCents;
    if(r.recharge==='Te beoordelen')reviewCount++;
    if(r.recharge==='Nee')confirmedNoCount++;
    if(r.rechargeCents!==null){pricedRechargeCents+=r.rechargeCents;rechargeCount++;estimatedBillableHours+=(r.estimateHours??0);}
    const entry=groups.get(r.location)??{location:r.location,count:0,costCents:0,rechargeCount:0,rechargeCents:0,reviewCount:0};
    entry.count++;entry.costCents+=r.costCents;
    if(r.rechargeCents!==null){entry.rechargeCount++;entry.rechargeCents+=r.rechargeCents;}
    if(r.recharge==='Te beoordelen')entry.reviewCount++;
    groups.set(r.location,entry);
  }
  if(!Number.isSafeInteger(totalCostCents)||!Number.isSafeInteger(pricedRechargeCents))throw new Error("Amounts out of range.");
  return {rowCount:rows.length,totalCostCents,pricedRechargeCents,rechargeCount,reviewCount,
    confirmedNoCount,estimatedBillableHours,groups:[...groups.values()].sort((a,b)=>b.costCents-a.costCents||a.location.localeCompare(b.location,'nl'))};
}

/** Fictional example only, generated locally with the exact accepted column order. */
export const weeklyCostsTemplate='\uFEFF'+headers.join(';')+'\r\n'+
 'VOORBEELD01;2026;7;2026-02-09;2026-02-15;Fictief object;Schoonmaak;Fictieve voorbeeldregel;50,00;Te beoordelen;voorbeeld;Alleen voorbeeld;;;\r\n';
