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
    throw new Error('CSV is te groot voor een lokale proefimport.');
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
      else throw new Error('Ongeldige aanhalingstekens in CSV.');
    }else if(!inside && char===';'){cols.push(value);value='';}
    else if(!inside && (char==='\n'||char==='\r')){
      if(char==='\r' && text[i+1]==='\n') i++;
      cols.push(value);value='';
      if(cols.some(v=>v.length>0)) result.push(cols);
      cols=[];
      if(result.length>5001)throw new Error('Maximaal 5000 regels per import.');
    }else{value+=char;if(value.length>2000)throw new Error('CSV-veld te lang.');}
  }
  if(inside)throw new Error('Onvolledig afgesloten CSV-veld.');
  cols.push(value);
  if(cols.some(v=>v.length>0))result.push(cols);
  return result;
}

function asCents(value:string, required:boolean):number|null {
  const v=value.trim();
  if(!v && !required)return null;
  if(!/^\d{1,10}(?:[,.]\d{1,2})?$/.test(v))throw new Error('Ongeldig bedrag: '+v.slice(0,30));
  const [a,b='']=v.replace(',','.').split('.');
  const cents=Number(a)*100+Number(b.padEnd(2,'0'));
  if(!Number.isSafeInteger(cents) || cents>100000000000)throw new Error('Bedrag buiten bereik.');
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
  if(records.length<2)throw new Error('Geen kostenregels gevonden.');
  if(records[0].length!==headers.length || headers.some((h,i)=>records[0][i]?.trim()!==h)) {
    throw new Error('De CSV-kolommen komen niet overeen met het testimportformaat.');
  }
  const seen=new Set<string>();
  const data:ImportedWeeklyCost[]=[];
  for(let i=1;i<records.length;i++){
    const c=records[i];
    if(c.length!==headers.length)throw new Error('Regel '+(i+1)+': onjuist aantal velden.');
    const [reference,y,w,from,until,originalLocation,category,description,cost,recharge,sourceRef,check,hours,charged,billingRef]=c.map(x=>x.trim());
    const year=Number(y),week=Number(w);
    if(!/^[A-Za-z0-9_-]{3,60}$/.test(reference)||seen.has(reference))throw new Error('Dubbele of ongeldige regelreferentie op regel '+(i+1)+'.');
    seen.add(reference);
    if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(week)||week<1||week>53||
      !validDate(from)||!validDate(until)||until<from||Number(from.slice(0,4))!==year) {
      throw new Error('Controleer jaar, week en periode op regel '+(i+1)+'.');
    }
    if(!originalLocation||originalLocation.length>180||!category||category.length>140||
      !description||description.length>500||sourceRef.length>150||check.length>500) {
      throw new Error('Locatie of omschrijving ontbreekt op regel '+(i+1)+'.');
    }
    if(!['Ja','Nee','Te beoordelen'].includes(recharge))throw new Error('Ongeldige factuurstatus op regel '+(i+1)+'.');
    const costCents=asCents(cost,true)!;
    const rechargeCents=asCents(charged,false);
    const estimateHours=hours ? Number(hours.replace(',','.')) : null;
    if(estimateHours!==null && (!Number.isInteger(estimateHours)||estimateHours<1||estimateHours>100)) {
      throw new Error('Ongeldige geschatte factureerbare uren op regel '+(i+1)+'.');
    }
    if((rechargeCents===null)!==(estimateHours===null) ||
      (rechargeCents!==null && (recharge!=='Ja'||!billingRef||billingRef.length>120))) {
      throw new Error('Inconsistente doorbelastingsgegevens op regel '+(i+1)+'.');
    }
    if(rechargeCents===null && billingRef)throw new Error('Factuurreferentie zonder doorbelasting op regel '+(i+1)+'.');
    data.push({reference,year,week,from,until,originalLocation,
      location:normalizedCostLocation(originalLocation),category,description,costCents,
      recharge:recharge as ImportedWeeklyCost['recharge'],sourceReference:sourceRef,
      check,estimateHours,rechargeCents,billingReference:billingRef});
  }
  return data;
}

export function summarizeWeeklyCosts(rows:readonly ImportedWeeklyCost[]) {
  if(!rows.length)throw new Error('Geen bronregels.');
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
  if(!Number.isSafeInteger(totalCostCents)||!Number.isSafeInteger(pricedRechargeCents))throw new Error('Bedragen buiten bereik.');
  return {rowCount:rows.length,totalCostCents,pricedRechargeCents,rechargeCount,reviewCount,
    confirmedNoCount,estimatedBillableHours,groups:[...groups.values()].sort((a,b)=>b.costCents-a.costCents||a.location.localeCompare(b.location,'nl'))};
}
